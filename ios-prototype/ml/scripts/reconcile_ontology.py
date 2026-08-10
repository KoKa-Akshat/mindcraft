#!/usr/bin/env python3
"""
Read-only reconciliation of the generated ingredient_ontology.json against the
canonical ontology_complete.json (ONTOLOGY_COMPLETE).

Produces ml/scripts/output/ontology_reconciliation.md with:
  1. Concept matching table   (generated concept -> best complete concept)
  2. Ingredient matching table (generated ingredient -> best complete ingredient)
  3. Combination remapping     (combination ids rewritten into complete IDs)
  4. Gap list                  (genuinely NEW concepts/ingredients, in complete schema)

Matching is deterministic token-overlap on name + description (+ tags). No LLM.
This script MODIFIES NEITHER ontology file. It only writes the markdown report.

Run:  cd ml && python3 scripts/reconcile_ontology.py
"""

from __future__ import annotations

import json
import pathlib
import re

ML_DIR = pathlib.Path(__file__).resolve().parent.parent
COMPLETE_PATH = ML_DIR / "data" / "ontology.json"
GENERATED_PATH = ML_DIR / "data" / "ingredient_ontology.json"
OUT_PATH = ML_DIR / "scripts" / "output" / "ontology_reconciliation.md"

# Verdict thresholds. Tuned to be conservative: when in doubt, flag UNSURE so a
# human reviews rather than the script silently merging or splitting a concept.
CONCEPT_SAME = 0.30
CONCEPT_NEW = 0.18
INGREDIENT_SAME = 0.45
INGREDIENT_NEW = 0.25

STOPWORDS = {
    "the", "a", "an", "of", "to", "as", "is", "are", "and", "or", "in", "on",
    "for", "with", "that", "this", "by", "from", "its", "it", "be", "can",
    "must", "into", "at", "one", "two", "whose", "when", "where", "which",
    "each", "any", "their", "they", "you", "your", "value", "values", "using",
    "use", "used", "given", "than", "then", "out", "not", "but", "has", "have",
}


def tokenize(text: str) -> set[str]:
    """Lowercase, split snake_case/words, drop stopwords, crude singularize."""
    if not text:
        return set()
    raw = re.split(r"[^a-z0-9]+", text.lower())
    toks = set()
    for t in raw:
        if len(t) < 3 or t in STOPWORDS:
            continue
        # crude plural strip: cats->cat, but keep -ss (class) intact
        if len(t) > 4 and t.endswith("s") and not t.endswith("ss"):
            t = t[:-1]
        toks.add(t)
    return toks


def overlap_score(a: set[str], b: set[str]) -> float:
    """Blend of Jaccard and containment. 0..1. Symmetric-ish, length-robust."""
    if not a or not b:
        return 0.0
    inter = len(a & b)
    if inter == 0:
        return 0.0
    jaccard = inter / len(a | b)
    containment = inter / min(len(a), len(b))
    return 0.5 * jaccard + 0.5 * containment


def verdict(score: float, same_t: float, new_t: float) -> str:
    if score >= same_t:
        return "SAME"
    if score < new_t:
        return "NEW"
    return "UNSURE"


# ── Load ──

complete = json.loads(COMPLETE_PATH.read_text())
generated = json.loads(GENERATED_PATH.read_text())


# ── Build complete-side documents ──

# complete concepts: doc = name + id words + aggregated ingredient text
complete_concepts = []
complete_ingredients = []  # flat: (id, concept_id, label, tokens)
for c in complete["concepts"]:
    cdoc = tokenize(c["name"] + " " + c["id"].replace("_", " "))
    for ing in c.get("ingredients", []):
        itoks = tokenize(
            ing.get("label", "") + " " + ing.get("description", "")
        )
        cdoc |= itoks
        complete_ingredients.append(
            {
                "id": ing["id"],
                "concept_id": c["id"],
                "label": ing.get("label", ""),
                "tokens": itoks,
            }
        )
    complete_concepts.append({"id": c["id"], "name": c["name"], "tokens": cdoc})


# ── Build generated-side documents ──

# generated concepts are implied by concept_id on ingredients; build doc from
# the concept slug + the names/descriptions/tags of its member ingredients.
gen_by_concept: dict[str, list[dict]] = {}
gen_ingredients = []
for i in generated["ingredients"]:
    toks = tokenize(
        i.get("name", "")
        + " "
        + i.get("description", "")
        + " "
        + " ".join(i.get("tags", []))
    )
    rec = {
        "id": i["id"],
        "concept_id": i["concept_id"],
        "name": i.get("name", ""),
        "tokens": toks,
    }
    gen_ingredients.append(rec)
    gen_by_concept.setdefault(i["concept_id"], []).append(rec)

gen_concepts = []
for cid, members in gen_by_concept.items():
    cdoc = tokenize(cid.replace("_", " "))
    for m in members:
        cdoc |= m["tokens"]
    gen_concepts.append(
        {"id": cid, "tokens": cdoc, "n_ingredients": len(members)}
    )


# ── 1. Concept matching ──

def best_matches(query_tokens, candidates, top=2):
    scored = [
        (cand, overlap_score(query_tokens, cand["tokens"])) for cand in candidates
    ]
    scored.sort(key=lambda x: -x[1])
    return scored[:top]


concept_rows = []
for gc in sorted(gen_concepts, key=lambda x: x["id"]):
    matches = best_matches(gc["tokens"], complete_concepts, top=2)
    (m1, s1) = matches[0]
    (m2, s2) = matches[1] if len(matches) > 1 else ({"id": "-"}, 0.0)
    concept_rows.append(
        {
            "gen_id": gc["id"],
            "n_ing": gc["n_ingredients"],
            "best_id": m1["id"],
            "best_score": s1,
            "second_id": m2["id"],
            "second_score": s2,
            "verdict": verdict(s1, CONCEPT_SAME, CONCEPT_NEW),
        }
    )


# ── 2. Ingredient matching ──

ingredient_rows = []
# map generated ingredient id -> chosen complete id (for combination remap)
gen_to_complete: dict[str, dict] = {}
for gi in sorted(gen_ingredients, key=lambda x: (x["concept_id"], x["id"])):
    matches = best_matches(gi["tokens"], complete_ingredients, top=2)
    (m1, s1) = matches[0]
    (m2, s2) = matches[1] if len(matches) > 1 else ({"id": "-", "concept_id": "-"}, 0.0)
    v = verdict(s1, INGREDIENT_SAME, INGREDIENT_NEW)
    row = {
        "gen_id": gi["id"],
        "gen_concept": gi["concept_id"],
        "best_id": m1["id"],
        "best_concept": m1["concept_id"],
        "best_score": s1,
        "second_id": m2["id"],
        "second_score": s2,
        "verdict": v,
    }
    ingredient_rows.append(row)
    gen_to_complete[gi["id"]] = row


# ── 3. Combination remapping ──

combo_blocks = []
for cb in generated["combinations"]:
    lines = []
    unmappable = []
    remapped_order = []
    for iid in cb.get("apply_order", cb["ingredients"]):
        row = gen_to_complete.get(iid)
        if row is None:
            remapped_order.append(f"??{iid}")
            unmappable.append(f"{iid} (not in generated ingredients)")
            continue
        if row["verdict"] == "SAME":
            remapped_order.append(row["best_id"])
        else:
            remapped_order.append(f"[{row['verdict']}:{iid}->{row['best_id']}?]")
            unmappable.append(
                f"{iid} -> {row['best_id']} (verdict {row['verdict']}, "
                f"score {row['best_score']:.2f})"
            )
    combo_blocks.append(
        {
            "id": cb["id"],
            "spans": cb.get("spans_concepts", []),
            "confidence": cb.get("confidence"),
            "orig_order": cb.get("apply_order", cb["ingredients"]),
            "remapped_order": remapped_order,
            "unmappable": unmappable,
        }
    )


# ── 4. Gap list (genuinely NEW) ──

new_concepts = [r for r in concept_rows if r["verdict"] == "NEW"]
new_ingredients = [r for r in ingredient_rows if r["verdict"] == "NEW"]


# ── Aggregate counts ──

def counts(rows):
    out = {"SAME": 0, "NEW": 0, "UNSURE": 0}
    for r in rows:
        out[r["verdict"]] += 1
    return out


cc = counts(concept_rows)
ic = counts(ingredient_rows)
fully_mappable = sum(1 for b in combo_blocks if not b["unmappable"])


# ── Emit markdown ──

def fmt(s):
    return f"{s:.2f}"


md = []
md.append("# Ontology Reconciliation Report")
md.append("")
md.append("**READ-ONLY.** Neither ontology file was modified. Generated by "
          "`scripts/reconcile_ontology.py` via deterministic token-overlap on "
          "name + description (no LLM).")
md.append("")
md.append(f"- ONTOLOGY_COMPLETE: `data/ontology_complete.json` "
          f"({len(complete['concepts'])} concepts, {len(complete_ingredients)} "
          f"nested ingredients)")
md.append(f"- GENERATED: `data/ingredient_ontology.json` "
          f"({len(gen_concepts)} implied concepts, {len(gen_ingredients)} "
          f"ingredients, {len(generated['combinations'])} combinations)")
md.append("")
md.append("## Summary")
md.append("")
md.append(f"- **Concepts:** SAME {cc['SAME']} / UNSURE {cc['UNSURE']} / "
          f"NEW {cc['NEW']}  (of {len(concept_rows)})")
md.append(f"- **Ingredients:** SAME {ic['SAME']} / UNSURE {ic['UNSURE']} / "
          f"NEW {ic['NEW']}  (of {len(ingredient_rows)})")
md.append(f"- **Combinations fully remappable to complete IDs:** "
          f"{fully_mappable} / {len(combo_blocks)} "
          f"(rest reference UNSURE/NEW ingredients — see §3)")
md.append("")
md.append(f"Verdict thresholds — concept: SAME>={CONCEPT_SAME}, NEW<{CONCEPT_NEW}; "
          f"ingredient: SAME>={INGREDIENT_SAME}, NEW<{INGREDIENT_NEW}. "
          "Everything between is UNSURE and needs your manual call.")
md.append("")

# Section 1
md.append("## 1. Concept matching")
md.append("")
md.append("| generated_id | #ing | best_match_in_complete | score | 2nd candidate | 2nd | verdict |")
md.append("|---|---|---|---|---|---|---|")
for r in sorted(concept_rows, key=lambda x: (x["verdict"], -x["best_score"])):
    md.append(
        f"| `{r['gen_id']}` | {r['n_ing']} | `{r['best_id']}` | {fmt(r['best_score'])} "
        f"| `{r['second_id']}` | {fmt(r['second_score'])} | **{r['verdict']}** |"
    )
md.append("")

# Section 2
md.append("## 2. Ingredient matching")
md.append("")
md.append("Generated ingredient (bare-slug ID) -> best match among the 144 "
          "namespaced complete ingredients. `best_concept` shows which complete "
          "concept the match lives under — a mismatch there is a red flag.")
md.append("")
md.append("| generated_id | gen_concept | best_match_complete | best_concept | score | verdict |")
md.append("|---|---|---|---|---|---|")
for r in sorted(ingredient_rows, key=lambda x: (x["verdict"], -x["best_score"])):
    md.append(
        f"| `{r['gen_id']}` | {r['gen_concept']} | `{r['best_id']}` "
        f"| {r['best_concept']} | {fmt(r['best_score'])} | **{r['verdict']}** |"
    )
md.append("")

# Section 3
md.append("## 3. Combination remapping")
md.append("")
md.append("Each combination's `apply_order` rewritten into complete IDs. A token "
          "like `[UNSURE:gen->complete?]` means that ingredient could not be "
          "confidently remapped and the combination is **not yet safe to add**.")
md.append("")
for b in combo_blocks:
    status = "FULLY MAPPABLE" if not b["unmappable"] else "BLOCKED"
    md.append(f"### `{b['id']}`  ({status}, conf {b['confidence']}, spans {b['spans']})")
    md.append("")
    md.append(f"- original order: {' -> '.join(b['orig_order'])}")
    md.append(f"- remapped order: {' -> '.join(b['remapped_order'])}")
    if b["unmappable"]:
        md.append("- **blockers:**")
        for u in b["unmappable"]:
            md.append(f"    - {u}")
    md.append("")

# Section 4
md.append("## 4. Gap list — genuinely NEW (would need adding to complete)")
md.append("")
md.append("Empirical fields (`learning_vector`, `failure_mode`, `failure_prior`, "
          "`comes_from`) are flagged TODO — they must not be fabricated.")
md.append("")
md.append(f"### NEW concepts ({len(new_concepts)})")
md.append("")
if new_concepts:
    for r in new_concepts:
        md.append(f"- `{r['gen_id']}` — closest complete was `{r['best_id']}` "
                  f"@ {fmt(r['best_score'])} (below NEW threshold)")
else:
    md.append("_none — every generated concept had a plausible complete match_")
md.append("")
md.append(f"### NEW ingredients ({len(new_ingredients)})")
md.append("")
if new_ingredients:
    md.append("```json")
    for r in new_ingredients[:50]:
        gi = next(g for g in gen_ingredients if g["id"] == r["gen_id"])
        stub = {
            "id": f"<concept>__{r['gen_id']}",
            "label": gi["name"],
            "description": "TODO copy/refine from generated",
            "comes_from": "new",
            "failure_mode": "TODO (empirical)",
            "failure_prior": "TODO (empirical)",
            "learning_vector": "TODO (empirical)",
        }
        md.append(json.dumps(stub))
    md.append("```")
else:
    md.append("_none_")
md.append("")

OUT_PATH.write_text("\n".join(md))

# ── stdout summary ──
print(f"Wrote {OUT_PATH.relative_to(ML_DIR)}")
print(f"Concepts:    SAME {cc['SAME']}  UNSURE {cc['UNSURE']}  NEW {cc['NEW']}  (of {len(concept_rows)})")
print(f"Ingredients: SAME {ic['SAME']}  UNSURE {ic['UNSURE']}  NEW {ic['NEW']}  (of {len(ingredient_rows)})")
print(f"Combinations fully remappable: {fully_mappable} / {len(combo_blocks)}")
