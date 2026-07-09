#!/usr/bin/env python3
"""Pre-compute keyword/theme signals for the ~1,500 bank questions.

Reads:
  app/src/data/eediQuestions.json
  app/src/data/actMasterQuestionBank.generated.json

Writes:
  ml/data/enriched/question_signals.json
  ml/data/enriched/question_signals_schema.json  (contract spec, written once
    per run — cheap to regenerate, documents the scoring formula Product's
    questionMatch.ts implements)

Deterministic keyword/theme extraction only (no LLM) unless --score-skins is
passed, in which case an optional Groq pass rates story_skin_score in
batches of 20.

CLI:
    python3 ml/scripts/enrich_question_signals.py
    python3 ml/scripts/enrich_question_signals.py --limit 100
    python3 ml/scripts/enrich_question_signals.py --dry-run
    python3 ml/scripts/enrich_question_signals.py --score-skins
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
ML_DIR = SCRIPT_DIR.parent
REPO_ROOT = ML_DIR.parent

EEDI_PATH = REPO_ROOT / "app" / "src" / "data" / "eediQuestions.json"
ACT_MASTER_PATH = REPO_ROOT / "app" / "src" / "data" / "actMasterQuestionBank.generated.json"
OUT_DIR = ML_DIR / "data" / "enriched"
OUT_PATH = OUT_DIR / "question_signals.json"
SCHEMA_PATH = OUT_DIR / "question_signals_schema.json"

MATH_THEME_TAGS = [
    "ratio", "proportion", "pattern", "growth", "geometry", "measurement",
    "probability", "sequence", "balance", "transformation", "symmetry",
    "counting", "area", "number_theory",
]

# Copied exactly from app/src/lib/storyMatch.ts STOPWORDS.
STOPWORDS = {
    'the', 'a', 'an', 'and', 'or', 'of', 'to', 'in', 'for', 'is', 'are', 'was', 'were',
    'what', 'which', 'how', 'if', 'find', 'value', 'given', 'following', 'shown', 'below',
    'above', 'figure', 'table', 'diagram', 'problem', 'question', 'choose', 'select',
}

MATH_THEME_MAP = {
    'ratio': 'ratio', 'proportion': 'proportion', 'fraction': 'ratio',
    'percent': 'ratio', 'pattern': 'pattern', 'growth': 'growth',
    'area': 'area', 'volume': 'area', 'perimeter': 'geometry',
    'angle': 'geometry', 'triangle': 'geometry', 'circle': 'geometry',
    'polygon': 'geometry', 'transform': 'transformation', 'reflect': 'transformation',
    'rotate': 'transformation', 'translate': 'transformation', 'symmetr': 'symmetry',
    'probabilit': 'probability', 'chance': 'probability', 'sequence': 'sequence',
    'mean': 'measurement', 'median': 'measurement', 'average': 'measurement',
    'measure': 'measurement', 'length': 'measurement', 'count': 'counting',
    'number': 'number_theory', 'prime': 'number_theory', 'factor': 'number_theory',
    'balance': 'balance', 'equal': 'balance',
}

SCHEMA_CONTRACT = {
    "_schema_version": "1.0",
    "_contract": (
        "rankQuestionsForContext scoring weights: 0.35 × concept_affinity_scores[conceptId] "
        "from matchedTale + 0.25 × jaccard(keywords, tale.keywords+tale.themes) + 0.20 × "
        "math_theme overlap count/max(len) + 0.10 × format fit (table→ledger/counting tale, "
        "diagram→spatial tale) + 0.10 × engine gap severity or tutor focus boost. Product "
        "implements this in app/src/lib/questionMatch.ts."
    ),
    "_math_theme_tags": MATH_THEME_TAGS,
}


def strip_latex(text: str) -> str:
    text = re.sub(r"\$\$[\s\S]*?\$\$", " ", text)
    text = re.sub(r"\$[^$\n]+\$", " ", text)
    # Eedi/ACT stems also use bare \(...\) / \[...\] LaTeX delimiters.
    text = re.sub(r"\\\[[\s\S]*?\\\]", " ", text)
    text = re.sub(r"\\\([\s\S]*?\\\)", " ", text)
    return text


def extract_keywords(stem: str) -> list[str]:
    text = strip_latex(stem).lower()
    text = re.sub(r"[^a-z0-9\s]", " ", text)
    words = text.split()
    seen = []
    seen_set = set()
    for w in words:
        if len(w) > 2 and w not in STOPWORDS and w not in seen_set:
            seen_set.add(w)
            seen.append(w)
    return seen


def extract_math_signals(stem: str) -> list[str]:
    lower = strip_latex(stem).lower()
    out = []
    seen = set()
    for term, tag in MATH_THEME_MAP.items():
        if term in lower and tag not in seen:
            seen.add(tag)
            out.append(tag)
    return out


def load_json_array(path: Path) -> list[dict]:
    if not path.exists():
        print(f"  [warn] not found: {path}")
        return []
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)
    if isinstance(data, dict):
        # tolerate a wrapper object with a "questions" key
        data = data.get("questions", [])
    if not isinstance(data, list):
        print(f"  [warn] unexpected shape in {path}: {type(data)}")
        return []
    return data


def build_record(q: dict) -> dict | None:
    qid = q.get("id") or q.get("questionId")
    if not qid:
        return None
    stem = q.get("question") or q.get("stem") or ""
    concept_id = q.get("conceptId") or q.get("concept_id")
    fmt = q.get("format")
    keywords = extract_keywords(stem)
    math_signals = extract_math_signals(stem)
    # math_theme_tags mirrors the same theme vocabulary as math_signals here —
    # both derived from MATH_THEME_MAP against the stem text.
    math_theme_tags = list(math_signals)

    return {
        "questionId": qid,
        "conceptId": concept_id,
        "format": fmt,
        "keywords": keywords,
        "math_signals": math_signals,
        "math_theme_tags": math_theme_tags,
        "story_skin_score": None,
        "misconception_id": q.get("misconception_id"),
    }


def load_all_questions(limit: int | None = None) -> list[dict]:
    eedi = load_json_array(EEDI_PATH)
    act_master = load_json_array(ACT_MASTER_PATH)
    print(f"  loaded {len(eedi)} from eediQuestions.json, {len(act_master)} from actMasterQuestionBank.generated.json")
    combined = eedi + act_master
    if limit is not None:
        combined = combined[:limit]
    return combined


def build_signals(limit: int | None = None) -> list[dict]:
    questions = load_all_questions(limit=limit)
    records = []
    seen_ids = set()
    for q in questions:
        rec = build_record(q)
        if rec is None:
            continue
        if rec["questionId"] in seen_ids:
            continue
        seen_ids.add(rec["questionId"])
        records.append(rec)
    return records


# ---------------------------------------------------------------------------
# Optional Groq skin-scoring pass
# ---------------------------------------------------------------------------

SKIN_SYSTEM_PROMPT = """You are rating how easily each math question can be wrapped in a folk tale narrative.
For each question, rate 0.0-1.0: 1.0 = concrete real-world quantities that map perfectly to story objects.
Output a JSON array of objects: [{"id": "...", "score": 0.0}, ...]"""


def _extract_json_array(text: str):
    text = text.strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    fenced = re.search(r"```(?:json)?\s*(\[.*?\])\s*```", text, re.S)
    if fenced:
        try:
            return json.loads(fenced.group(1))
        except json.JSONDecodeError:
            pass
    bracket = re.search(r"\[.*\]", text, re.S)
    if bracket:
        try:
            return json.loads(bracket.group(0))
        except json.JSONDecodeError:
            pass
    return None


def score_skins(records: list[dict], questions_by_id: dict[str, dict], batch_size: int = 20) -> None:
    sys.path.insert(0, str(ML_DIR))
    from generation.llm_client import complete  # noqa: E402

    scored = 0
    for i in range(0, len(records), batch_size):
        batch = records[i : i + batch_size]
        payload = [
            {
                "id": r["questionId"],
                "stem_text_first_150_chars": (questions_by_id.get(r["questionId"], {}).get("question")
                                               or questions_by_id.get(r["questionId"], {}).get("stem")
                                               or "")[:150],
            }
            for r in batch
        ]
        prompt = "Rate these questions:\n" + json.dumps(payload, ensure_ascii=False)
        try:
            raw = complete(prompt, system=SKIN_SYSTEM_PROMPT, max_tokens=800, temperature=0.3)
        except Exception as exc:  # noqa: BLE001
            print(f"  [warn] Groq skin-scoring call failed for batch starting at {i}: {exc}")
            continue
        parsed = _extract_json_array(raw)
        if parsed is None:
            print(f"  [warn] could not parse skin-score JSON for batch starting at {i}. Raw: {raw[:200]!r}")
            continue
        scores_by_id = {}
        for item in parsed:
            if isinstance(item, dict) and "id" in item and "score" in item:
                try:
                    scores_by_id[item["id"]] = max(0.0, min(1.0, float(item["score"])))
                except (TypeError, ValueError):
                    continue
        for r in batch:
            if r["questionId"] in scores_by_id:
                r["story_skin_score"] = scores_by_id[r["questionId"]]
                scored += 1
        if (i // batch_size) % 5 == 0:
            print(f"  ...scored {scored}/{len(records)} so far")

    print(f"Skin-scored {scored}/{len(records)} questions via Groq.")


def write_schema() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    with open(SCHEMA_PATH, "w", encoding="utf-8") as f:
        json.dump(SCHEMA_CONTRACT, f, indent=2, ensure_ascii=False)
        f.write("\n")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--limit", type=int, default=None, help="limit number of questions processed")
    parser.add_argument("--dry-run", action="store_true", help="print count + sample, no writes")
    parser.add_argument("--score-skins", action="store_true", help="also run Groq skin scoring")
    args = parser.parse_args()

    print("Building question signals...")
    records = build_signals(limit=args.limit)
    print(f"Total signal records: {len(records)}")

    if args.dry_run:
        print("Sample record:")
        print(json.dumps(records[0] if records else {}, indent=2, ensure_ascii=False))
        print("--dry-run: no files written.")
        return

    if args.score_skins:
        questions = load_all_questions(limit=args.limit)
        questions_by_id = {}
        for q in questions:
            qid = q.get("id") or q.get("questionId")
            if qid:
                questions_by_id[qid] = q
        score_skins(records, questions_by_id)

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    with open(OUT_PATH, "w", encoding="utf-8") as f:
        json.dump(records, f, indent=2, ensure_ascii=False)
        f.write("\n")
    print(f"Wrote {len(records)} records to {OUT_PATH}")

    write_schema()
    print(f"Wrote schema contract to {SCHEMA_PATH}")


if __name__ == "__main__":
    main()
