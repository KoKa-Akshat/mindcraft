#!/usr/bin/env python3
"""AUDIT TOOLING (read-only) — reproduces the numbers in
`agent_work/engine/CLASSIFIER_INGREDIENT_AUDIT.md`.

Writes nothing into `ml/data/` and never touches `bank_index.npz` /
`bank_index_meta.json` (those ship to the HF Space and cannot be rebuilt there).
All output goes to stdout, plus an optional JSON dump via --out.

    cd ml && source mindcraft/bin/activate
    python scripts/audit_classifier_ingredient.py                # everything
    python scripts/audit_classifier_ingredient.py --section A    # classifier only
    python scripts/audit_classifier_ingredient.py --section B    # enrichment only

Sections
  A  bank k-NN classifier: leak check, k/weighting sweep, error breakdown,
     within-concept ingredient separability
  B  misconception→ingredient map: live-bank join, provenance split, the
     unreached-ingredient census, and the Eedi distractor-recovery headroom
"""
from __future__ import annotations

import argparse
import csv
import json
import random
import re
import statistics
import sys
from collections import Counter, defaultdict
from pathlib import Path

import numpy as np

REPO = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO / "ml"))

APP_DATA = REPO / "app/src/data"
ML_DATA = REPO / "ml/data"
ONTOLOGY = ML_DATA / "5_level_ontology/01_mindcraft_concept_ontology_v2_6_with_combinations.json"
MAP_PATH = ML_DATA / "misconception_ingredient_map.json"
EEDI_TRAIN = REPO / "data/eedi/train.csv"
EEDI_MISC = REPO / "data/eedi/misconception_mapping.csv"

STOPWORDS = {"the", "a", "an", "of", "to", "when", "that", "in", "is", "as", "at", "by", "it"}


def eedi_slug(text: str, max_tokens: int = 5) -> str:
    """Mirror of ingest_eedi.slug — kept local so the audit never imports the ingester."""
    words = re.sub(r"[^a-z0-9\s]", "", text.lower()).split()
    return "_".join([w for w in words if w not in STOPWORDS][:max_tokens]) or "unknown"


def load_ontology() -> dict:
    return json.loads(ONTOLOGY.read_text())


def concept_alias_registry(ont: dict) -> dict[str, str]:
    reg = {c["id"]: c["id"] for c in ont["concepts"]}
    for c in ont["concepts"]:
        for a in c.get("aliases") or []:
            reg[a] = c["id"]
    return reg


# --------------------------------------------------------------------------- A
def section_a(results: dict) -> None:
    from mindcraft_graph.problem_classifier import _normalize_rows, strip_math_delimiters
    from mindcraft_graph.representation import embeddings
    from scripts.build_bank_index import load_bank_rows

    ont = load_ontology()
    alias = concept_alias_registry(ont)
    rows = load_bank_rows()
    print(f"[A] bank rows loaded: {len(rows)}")
    print(f"    by source: {dict(Counter(r['source'] for r in rows))}")

    committed = json.loads((ML_DATA / "bank_index_meta.json").read_text())
    cur_ids = {r["id"] for r in rows}
    old_ids = {r["id"] for r in committed}
    old_c = {r["id"]: r["conceptId"] for r in committed}
    cur_c = {r["id"]: r["conceptId"] for r in rows}
    drift = [k for k in old_ids & cur_ids if old_c[k] != cur_c[k]]
    print(f"[A] shipped bank_index_meta.json: {len(committed)} rows; "
          f"in index but not in bank: {len(old_ids - cur_ids)}; "
          f"in bank but not in index: {len(cur_ids - old_ids)}; conceptId drift: {len(drift)}")

    def norm(t: str) -> str:
        return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9]+", " ", strip_math_delimiters(t).lower())).strip()

    normed = [norm(r["text"]) for r in rows]
    groups = defaultdict(list)
    for i, n in enumerate(normed):
        groups[n].append(i)
    dups = {k: v for k, v in groups.items() if len(v) > 1}
    print(f"[A] exact-normalized duplicate text groups in the bank: {len(dups)} "
          f"({sum(len(v) for v in dups.values())} rows)")

    by_concept = defaultdict(list)
    for i, r in enumerate(rows):
        by_concept[r["conceptId"]].append(i)
    rng = random.Random(7)  # same seed/split as scripts/eval_problem_classifier.py
    hold: set[int] = set()
    for idx in by_concept.values():
        s = idx[:]
        rng.shuffle(s)
        hold.update(s[: max(1, int(len(s) * 0.2))])
    train = [i for i in range(len(rows)) if i not in hold]
    test = sorted(hold)

    model = embeddings.load_sentence_transformer()
    V = _normalize_rows(embeddings.embed_texts(model, [r["text"] for r in rows]))
    TV, TM = V[train], [rows[i] for i in train]

    train_norm = defaultdict(list)
    for i in train:
        train_norm[normed[i]].append(i)
    twinned = [i for i in test if normed[i] in train_norm]
    print(f"[A] LEAK CHECK — test items with an exact-normalized twin in train: "
          f"{len(twinned)}/{len(test)}")

    def knn(k: int, weighted: bool, keep=None, canon=False) -> tuple[int, int]:
        idxs = test if keep is None else [i for i in test if keep(rows[i])]
        hits = 0
        for i in idxs:
            s = TV @ V[i]
            order = np.argsort(-s)[:k]
            votes: Counter[str] = Counter()
            for j in order:
                votes[TM[int(j)]["conceptId"]] += float(s[int(j)]) if weighted else 1.0
            pred, true = votes.most_common(1)[0][0], rows[i]["conceptId"]
            if canon:
                pred, true = alias.get(pred, pred), alias.get(true, true)
            hits += int(pred == true)
        return hits, len(idxs)

    print("\n[A] k / weighting sweep (top-1 concept, held-out)")
    print("    k  weighted  all            ACT-only       Eedi-only")
    for k in (3, 5, 7, 10, 15):
        for w in (False, True):
            a = knn(k, w)
            b = knn(k, w, lambda r: r["examTag"] == "ACT")
            c = knn(k, w, lambda r: r["source"] == "eediQuestions.json")
            print(f"    {k:<3}{str(w):<10}{a[0]}/{a[1]}={a[0]/a[1]:.3f}    "
                  f"{b[0]}/{b[1]}={b[0]/b[1]:.3f}    {c[0]}/{c[1]}={c[0]/c[1]:.3f}")

    ship = knn(10, False)
    ship_c = knn(10, False, canon=True)
    claim = knn(5, True, canon=True)
    dense = {c for c, v in by_concept.items() if len(v) >= 20}
    claim_dense = knn(5, True, lambda r: r["conceptId"] in dense, canon=True)
    print(f"\n[A] SHIPPED config (k=10, majority, raw ids, all concepts): "
          f"{ship[0]}/{ship[1]} = {ship[0]/ship[1]:.4f}   (alias-canonicalized: {ship_c[0]/ship_c[1]:.4f})")
    print(f"[A] CLAIM config  (k=5, weighted, canonicalized, all concepts): {claim[0]/claim[1]:.4f}")
    print(f"[A] CLAIM config restricted to the {len(dense)} concepts with >=20 bank rows: "
          f"{claim_dense[0]}/{claim_dense[1]} = {claim_dense[0]/claim_dense[1]:.4f}")

    # load_bank_rows() drops `level`; recover it so the breakdown can use it
    levels: dict[str, object] = {}
    for path in ("eediQuestions.json", "actMasterQuestionBank.generated.json", "generatedQuestions.json"):
        for q in json.loads((APP_DATA / path).read_text()):
            levels[str(q.get("id"))] = q.get("level")
    for mt in re.finditer(r"\{\s*id:'(?P<id>[^']+)'(?P<body>.*?)(?=\n\s*\{ id:'|\n\])",
                          (REPO / "app/src/lib/questionBank.ts").read_text(), re.S):
        lv = re.search(r"level:\s*(\d+)", mt.group("body"))
        levels[mt.group("id")] = int(lv.group(1)) if lv else None

    recs = []
    for i in test:
        s = TV @ V[i]
        order = np.argsort(-s)[:10]
        votes = [TM[int(j)]["conceptId"] for j in order]
        pred, count = Counter(votes).most_common(1)[0]
        recs.append({"true": rows[i]["conceptId"], "pred": pred,
                     "correct": pred == rows[i]["conceptId"],
                     "confidence": count / 10, "source": rows[i]["source"],
                     "format": rows[i]["format"], "level": levels.get(rows[i]["id"]),
                     "examTag": rows[i]["examTag"] or "None"})

    def breakdown(key: str) -> None:
        d = defaultdict(lambda: [0, 0])
        for r in recs:
            d[str(r[key])][0] += r["correct"]
            d[str(r[key])][1] += 1
        for k, (h, n) in sorted(d.items(), key=lambda kv: -kv[1][1]):
            print(f"      {k:36s} {h:4d}/{n:<4d} = {h/n:.3f}")

    for key in ("source", "examTag", "format", "level"):
        print(f"\n[A] shipped-config accuracy by {key}:")
        breakdown(key)

    print("\n[A] vote-confidence gating (shipped k=10):")
    for t in (0.5, 0.6, 0.7, 0.8):
        s = [r for r in recs if r["confidence"] >= t]
        print(f"      >={t}: kept {len(s)}/{len(recs)} ({len(s)/len(recs):.1%}), "
              f"precision {sum(r['correct'] for r in s)/max(1,len(s)):.3f}")

    # ---- within-concept ingredient separability
    ing_rows = [{"id": i["id"], "concept": c["id"],
                 "text": " ".join(filter(None, [i.get("label"), i.get("description"), i.get("failure_mode")]))}
                for c in ont["concepts"] for i in c.get("ingredients", [])]
    ing_by_concept = defaultdict(list)
    for k, r in enumerate(ing_rows):
        ing_by_concept[r["concept"]].append(k)
    IV = _normalize_rows(embeddings.embed_texts(model, [r["text"] for r in ing_rows]))

    mp = json.loads(MAP_PATH.read_text())["map"]
    eedi = json.loads((APP_DATA / "eediQuestions.json").read_text())
    labeled = [{"text": strip_math_delimiters(q["question"]), "ing": mp[q["misconception_id"]][0]["ingredient_id"],
                "concept": mp[q["misconception_id"]][0]["concept_id"],
                "prov": mp[q["misconception_id"]][0]["provenance"]}
               for q in eedi if q.get("misconception_id") in mp]
    QV = _normalize_rows(embeddings.embed_texts(model, [r["text"] for r in labeled]))

    per_prov = defaultdict(lambda: [0, 0, 0.0])
    margins: list[float] = []
    for k, r in enumerate(labeled):
        cand = ing_by_concept.get(r["concept"], [])
        if len(cand) < 2:
            continue
        s = IV[cand] @ QV[k]
        o = np.argsort(-s)
        per_prov[r["prov"]][0] += int(ing_rows[cand[int(o[0])]]["id"] == r["ing"])
        per_prov[r["prov"]][1] += 1
        per_prov[r["prov"]][2] += 1.0 / len(cand)
        margins.append(float(s[o[0]] - s[o[1]]))

    CM = _normalize_rows(np.vstack([IV[ing_by_concept[c["id"]]].mean(axis=0) for c in ont["concepts"]]))
    cids = [c["id"] for c in ont["concepts"]]
    chits, cmarg = 0, []
    for k, r in enumerate(labeled):
        s = CM @ QV[k]
        o = np.argsort(-s)
        chits += int(cids[int(o[0])] == r["concept"])
        cmarg.append(float(s[o[0]] - s[o[1]]))

    print(f"\n[A] within-concept ingredient recovery (oracle concept), n={len(labeled)} labeled questions")
    for p in ("human", "llm", "embedding"):
        h, n, rb = per_prov[p]
        if n:
            print(f"      {p:10s} {h:4d}/{n:<5d} = {h/n:.3f}   random={rb/n:.3f}   lift={h/n/(rb/n):.2f}x")
    print(f"      ingredient top1-vs-top2 cosine margin: mean={statistics.mean(margins):.4f} "
          f"median={statistics.median(margins):.4f}")
    print(f"      concept top-1 in the SAME space: {chits/len(labeled):.3f}, "
          f"margin mean={statistics.mean(cmarg):.4f} median={statistics.median(cmarg):.4f}")

    results["A"] = {
        "bank_rows": len(rows), "test_n": len(test), "twinned_test_items": len(twinned),
        "dup_groups": len(dups), "shipped_top1": ship[0] / ship[1],
        "claim_config_dense_top1": claim_dense[0] / claim_dense[1],
        "ingredient_margin_median": statistics.median(margins),
        "concept_margin_median": statistics.median(cmarg),
    }


# --------------------------------------------------------------------------- B
def section_b(results: dict) -> None:
    ont = load_ontology()
    alias = concept_alias_registry(ont)
    ing2concept = {i["id"]: c["id"] for c in ont["concepts"] for i in c.get("ingredients", [])}
    ing_by_concept = {c["id"]: [i["id"] for i in c.get("ingredients", [])] for c in ont["concepts"]}
    concept_level = {c["id"]: c["level"] for c in ont["concepts"]}

    mp = json.loads(MAP_PATH.read_text())["map"]
    eedi = json.loads((APP_DATA / "eediQuestions.json").read_text())
    prov = Counter(v[0]["provenance"] for v in mp.values())
    reached = {v[0]["ingredient_id"] for v in mp.values()}
    print(f"[B] map entries: {len(mp)}  provenance: {dict(prov)}  ingredients reached: {len(reached)}/179")

    bank_mis = {q["misconception_id"] for q in eedi if q.get("misconception_id")}
    for q in eedi:
        for d in q.get("distractor_taxonomy") or []:
            if d.get("misconception_id"):
                bank_mis.add(d["misconception_id"])
    print(f"[B] distinct misconceptions reachable from the live bank: {len(bank_mis)}")
    print(f"    mapped AND reachable: {len(set(mp) & bank_mis)}/{len(mp)}  "
          f"(inert map entries: {len(set(mp) - bank_mis)})")
    print(f"    bank misconceptions with NO ingredient mapping: {len(bank_mis - set(mp))}")

    tagged = [(q["id"], mp[q["misconception_id"]][0]) for q in eedi if q.get("misconception_id") in mp]
    print(f"[B] bank questions gaining an ingredient tag by pure join: {len(tagged)} "
          f"({len(tagged)/1942:.1%} of the 1,942-row bank)  "
          f"provenance {dict(Counter(t[1]['provenance'] for t in tagged))}")
    per_ing = Counter(t[1]["ingredient_id"] for t in tagged)
    for n in (1, 5, 10, 20):
        print(f"      ingredients with >={n} labeled examples: {sum(1 for v in per_ing.values() if v >= n)}")

    # ontology diagnostic_tags as an independent check on the map
    agree, elig = Counter(), Counter()
    tag_owner = defaultdict(list)
    for c in ont["concepts"]:
        for i in c.get("ingredients", []):
            for key in [i.get("canonical_misconception_family")] + (i.get("diagnostic_tags") or []):
                if isinstance(key, str) and key.startswith("mis_"):
                    tag_owner[key].append(i["id"])
    agree_sc, elig_sc = Counter(), Counter()
    for mid, ents in mp.items():
        truth = tag_owner.get(mid)
        if not truth:
            continue
        p = ents[0]["provenance"]
        elig[p] += 1
        agree[p] += int(ents[0]["ingredient_id"] in truth)
        # C-1 forbids crossing concepts, so a tag owned only by another concept's
        # ingredient is structurally unreachable — score that subset separately.
        same = [t for t in truth if ing2concept[t] == ents[0]["concept_id"]]
        if same:
            elig_sc[p] += 1
            agree_sc[p] += int(ents[0]["ingredient_id"] in same)
    print("\n[B] agreement with the ontology's own diagnostic_tags / canonical_misconception_family:")
    print("      (strict = every tagged misconception; same-concept = only those whose")
    print("       tag owner is inside the concept C-1 restricts the pipeline to)")
    for p in ("human", "llm", "embedding"):
        if elig[p]:
            print(f"      {p:10s} strict {agree[p]:3d}/{elig[p]:<3d} = {agree[p]/elig[p]:.3f}   "
                  f"same-concept {agree_sc[p]:3d}/{elig_sc[p]:<3d} = {agree_sc[p]/max(1,elig_sc[p]):.3f}")
    print(f"      {'POOLED':10s} strict {sum(agree.values())}/{sum(elig.values())} = "
          f"{sum(agree.values())/max(1,sum(elig.values())):.3f}   "
          f"same-concept {sum(agree_sc.values())}/{sum(elig_sc.values())} = "
          f"{sum(agree_sc.values())/max(1,sum(elig_sc.values())):.3f}")

    unreached = sorted(set(ing2concept) - reached)
    bank_q: Counter[str] = Counter()
    for path in ("eediQuestions.json", "actMasterQuestionBank.generated.json", "generatedQuestions.json"):
        for q in json.loads((APP_DATA / path).read_text()):
            bank_q[alias.get(q["conceptId"], q["conceptId"])] += 1
    for mt in re.finditer(r"conceptId:'([^']+)'", (REPO / "app/src/lib/questionBank.ts").read_text()):
        bank_q[alias.get(mt.group(1), mt.group(1))] += 1
    print(f"\n[B] unreached ingredients: {len(unreached)}/179")
    by_c = Counter(ing2concept[i] for i in unreached)
    lvl = Counter()
    for c, n in by_c.most_common():
        lvl[concept_level[c]] += n
        print(f"      {c:32s} {n:2d}/{len(ing_by_concept[c]):<2d}  {concept_level[c]:13s} bank_qs={bank_q.get(c,0)}")
    print(f"      by concept level: {dict(lvl)}")
    print(f"      in concepts with ZERO bank questions: "
          f"{sum(n for c, n in by_c.items() if bank_q.get(c,0)==0)}/{len(unreached)}")

    # ---- Eedi distractor-recovery headroom
    if not EEDI_TRAIN.exists():
        print("\n[B] data/eedi/train.csv not present — skipping distractor-recovery headroom")
        return
    src = {int(r["QuestionId"]): r for r in csv.DictReader(open(EEDI_TRAIN))}
    names = {int(r["MisconceptionId"]): r["MisconceptionName"] for r in csv.DictReader(open(EEDI_MISC))}
    cols = ["MisconceptionAId", "MisconceptionBId", "MisconceptionCId", "MisconceptionDId"]
    slots = avail = current = resolved = 0
    minted: set[str] = set()
    ceiling_concepts: set[str] = set()
    for q in eedi:
        r = src[int(q["id"].split("_")[1])]
        ci = "ABCD".index(r["CorrectAnswer"])
        current += sum(1 for d in q.get("distractor_taxonomy") or [] if d.get("misconception_id"))
        for i, col in enumerate(cols):
            if i == ci:
                continue
            slots += 1
            if not r[col].strip():
                continue
            avail += 1
            mid = f"mis_{q['conceptId']}__{eedi_slug(names[int(float(r[col]))])}"
            minted.add(mid)
            if mid in mp:
                resolved += 1
            else:
                ceiling_concepts.add(alias.get(q["conceptId"], q["conceptId"]))
    ceiling = {i for c in ceiling_concepts for i in ing_by_concept.get(c, []) if i not in reached}
    print(f"\n[B] Eedi distractor-recovery headroom (source data already on disk)")
    print(f"      wrong-answer slots across the 1,508 ingested questions: {slots}")
    print(f"      currently tagged in the app bank: {current} ({current/slots:.1%})")
    print(f"      present in data/eedi/train.csv:   {avail} ({avail/slots:.1%})")
    print(f"      RECOVERABLE with no model:        {avail-current}")
    print(f"      distinct minted misconception ids over all wrong slots: {len(minted)} "
          f"(already mapped: {len(minted & set(mp))}, unmapped: {len(minted - set(mp))})")
    print(f"      distractor slots that resolve to an ingredient TODAY: {resolved}")
    print(f"      unreached ingredients that mapping the remainder could reach (same-concept ceiling): "
          f"{len(ceiling)}  -> hard ceiling {len(reached)+len(ceiling)}/179")

    results["B"] = {
        "map_entries": len(mp), "provenance": dict(prov), "ingredients_reached": len(reached),
        "questions_tagged_by_join": len(tagged), "unreached": len(unreached),
        "distractor_slots": slots, "tagged_now": current, "available_in_source": avail,
        "resolved_to_ingredient": resolved, "eedi_ingredient_ceiling": len(reached) + len(ceiling),
    }


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--section", choices=["A", "B", "all"], default="all")
    ap.add_argument("--out", type=Path, default=None)
    args = ap.parse_args()
    results: dict = {}
    if args.section in ("A", "all"):
        section_a(results)
    if args.section in ("B", "all"):
        print()
        section_b(results)
    if args.out:
        args.out.write_text(json.dumps(results, indent=2))
        print(f"\nwrote {args.out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
