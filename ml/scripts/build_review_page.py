#!/usr/bin/env python3
"""Build a searchable HTML review page for all questions and concept stories.

Usage:
  cd ml && python scripts/build_review_page.py
  # → writes review-questions.html to repo root
"""
from __future__ import annotations

import json
import re
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]

BANKS = [
    ("act_master",  REPO / "app/src/data/actMasterQuestionBank.generated.json"),
    ("eedi",        REPO / "app/src/data/eediQuestions.json"),
    ("generated",   REPO / "app/src/data/generatedQuestions.json"),
]

STORIES_PATH   = REPO / "app/src/data/conceptStories.json"
ONTOLOGY_PATH  = REPO / "ml/data/5_level_ontology/01_mindcraft_concept_ontology_v2_6_with_combinations.json"
OUTPUT_PATH    = REPO / "review-questions.html"


def load_inline_ts() -> list[dict]:
    src = (REPO / "app/src/lib/questionBank.ts").read_text()
    questions = []
    for m in re.finditer(
        r"\{\s*id:'([^']+)',\s*conceptId:'([^']+)',\s*level:([123])([\s\S]*?)\}(?=,?\s*\{|,?\s*\])",
        src,
    ):
        block = m.group(0)
        q_m   = re.search(r"question:'((?:[^'\\]|\\.)*)'", block)
        exp_m = re.search(r"explanation:'((?:[^'\\]|\\.)*)'", block)
        ci_m  = re.search(r"correctIndex:(\d)", block)
        if not q_m:
            continue
        questions.append({
            "id":           m.group(1),
            "conceptId":    m.group(2),
            "level":        int(m.group(3)),
            "source":       "inline_ts",
            "question":     q_m.group(1).replace("\\'", "'"),
            "correctIndex": int(ci_m.group(1)) if ci_m else 0,
            "explanation":  exp_m.group(1).replace("\\'", "'") if exp_m else "",
            "choices":      [],
        })
    return questions


def esc(s: str) -> str:
    return (s or "").replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace('"', "&quot;")


def build() -> None:
    # Load questions
    all_q: list[dict] = load_inline_ts()
    for src_name, path in BANKS:
        if not path.exists():
            continue
        for q in json.loads(path.read_text()):
            q.setdefault("source", src_name)
            all_q.append(q)

    # Load ontology for concept names + descriptions
    ontology = json.loads(ONTOLOGY_PATH.read_text())
    concept_meta: dict[str, dict] = {
        c["id"]: {"name": c.get("name", c["id"]), "level": c.get("level", ""), "desc": c.get("description", "")}
        for c in ontology.get("concepts", [])
    }

    # Load stories if they exist
    stories: dict[str, dict] = {}
    if STORIES_PATH.exists():
        stories = json.loads(STORIES_PATH.read_text())

    # Group by concept
    by_concept: dict[str, list[dict]] = {}
    for q in all_q:
        cid = q.get("conceptId") or q.get("concept_id", "unknown")
        by_concept.setdefault(cid, []).append(q)

    # Build HTML
    rows_html: list[str] = []
    concept_nav: list[str] = []

    for cid in sorted(by_concept.keys()):
        meta   = concept_meta.get(cid, {"name": cid, "level": "", "desc": ""})
        cname  = meta["name"]
        clevel = meta["level"]
        qs     = by_concept[cid]
        story  = stories.get(cid, {}).get("story", "")

        concept_nav.append(
            f'<a href="#{cid}" class="nav-pill">{esc(cname)} <span class="badge">{len(qs)}</span></a>'
        )

        q_cards: list[str] = []
        for q in sorted(qs, key=lambda x: (x.get("level", 1), x.get("id", ""))):
            choices     = q.get("choices") or q.get("options") or []
            correct_idx = q.get("correctIndex", q.get("correct_index", 0))
            qtext       = esc(q.get("question", ""))
            exp         = esc(q.get("explanation") or q.get("solution") or "")
            misc        = esc(q.get("misconception_label", ""))
            src         = q.get("source", "")
            lvl         = q.get("level", 1)
            fmt         = q.get("format", "")
            qid         = q.get("id", "")

            choices_html = ""
            for i, c in enumerate(choices):
                mark = "correct" if i == correct_idx else "wrong"
                choices_html += f'<li class="{mark}">{chr(65+i)}. {esc(c)}</li>'

            misc_html = f'<div class="misc">⚠ Common trap: {misc}</div>' if misc else ""
            exp_html  = f'<div class="exp">Explanation: {exp[:400]}{"…" if len(exp) > 400 else ""}</div>' if exp else ""

            q_cards.append(f"""
              <div class="qcard" data-level="{lvl}" data-source="{esc(src)}" data-format="{esc(fmt)}">
                <div class="qcard-meta">
                  <span class="tag lvl">L{lvl}</span>
                  <span class="tag src">{esc(src)}</span>
                  {"<span class='tag fmt'>" + esc(fmt) + "</span>" if fmt else ""}
                  <span class="qid">{esc(qid)}</span>
                </div>
                <div class="qtext">{qtext}</div>
                {"<ul class='choices'>" + choices_html + "</ul>" if choices_html else ""}
                {exp_html}
                {misc_html}
              </div>""")

        story_html = ""
        if story:
            story_html = f"""
            <div class="story-box">
              <div class="story-label">Fable 5 story</div>
              <p>{esc(story)}</p>
            </div>"""

        rows_html.append(f"""
        <section class="concept-section" id="{cid}">
          <div class="concept-header">
            <h2>{esc(cname)}</h2>
            <span class="concept-meta">{clevel} · {len(qs)} questions · <code>{cid}</code></span>
          </div>
          {story_html}
          <div class="qgrid">{"".join(q_cards)}</div>
        </section>""")

    total = len(all_q)
    concepts = len(by_concept)
    src_breakdown = {}
    for q in all_q:
        s = q.get("source", "?")
        src_breakdown[s] = src_breakdown.get(s, 0) + 1

    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>MindCraft Question Bank Review</title>
<style>
:root{{--ink:#171412;--muted:#6b6460;--wine:#3b1022;--forest:#063f33;--green:#5aa85f;--cream:#f6f1e8;--line:#e0d8cc}}
*{{box-sizing:border-box;margin:0;padding:0}}
body{{font-family:system-ui,sans-serif;background:var(--cream);color:var(--ink);font-size:14px;line-height:1.5}}
a{{color:var(--forest);text-decoration:none}}
.top{{background:var(--forest);color:#fff;padding:20px 32px;display:flex;justify-content:space-between;align-items:center;position:sticky;top:0;z-index:10}}
.top h1{{font-size:18px;font-weight:800}}
.stats{{font-size:12px;opacity:.7;display:flex;gap:16px}}
.controls{{background:#fff;border-bottom:1px solid var(--line);padding:12px 32px;display:flex;gap:12px;align-items:center;flex-wrap:wrap;position:sticky;top:61px;z-index:9}}
input[type=search]{{flex:1;min-width:200px;border:1px solid var(--line);border-radius:8px;padding:8px 12px;font-size:13px}}
select{{border:1px solid var(--line);border-radius:8px;padding:8px 10px;font-size:13px;background:#fff}}
.nav-strip{{background:#fff;border-bottom:1px solid var(--line);padding:10px 32px;display:flex;gap:8px;flex-wrap:wrap;max-height:80px;overflow-y:auto}}
.nav-pill{{background:var(--cream);border:1px solid var(--line);border-radius:20px;padding:4px 12px;font-size:12px;font-weight:700;color:var(--wine);white-space:nowrap}}
.nav-pill .badge{{background:var(--forest);color:#fff;border-radius:10px;padding:1px 6px;font-size:10px;margin-left:4px}}
.main{{max-width:1200px;margin:0 auto;padding:32px}}
.concept-section{{margin-bottom:52px}}
.concept-header{{display:flex;align-items:baseline;gap:16px;margin-bottom:12px;padding-bottom:10px;border-bottom:1px solid var(--line)}}
.concept-header h2{{font-size:20px;font-weight:800;color:var(--wine)}}
.concept-meta{{font-size:12px;color:var(--muted)}}
.story-box{{background:linear-gradient(135deg,#f0faf0,#e8f5e8);border:1px solid #c0e0c0;border-radius:12px;padding:20px 24px;margin-bottom:16px}}
.story-label{{font-size:10px;font-weight:900;text-transform:uppercase;letter-spacing:.1em;color:var(--forest);margin-bottom:8px}}
.story-box p{{font-style:italic;color:#2a4a2a;line-height:1.7}}
.qgrid{{display:grid;grid-template-columns:repeat(auto-fill,minmax(360px,1fr));gap:14px}}
.qcard{{background:#fff;border:1px solid var(--line);border-radius:12px;padding:16px;display:flex;flex-direction:column;gap:10px}}
.qcard-meta{{display:flex;gap:6px;flex-wrap:wrap;align-items:center}}
.tag{{font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.08em;padding:2px 8px;border-radius:20px}}
.lvl{{background:#e8f0fe;color:#1a56db}}
.src{{background:#fef3c7;color:#92400e}}
.fmt{{background:#f3e8ff;color:#6d28d9}}
.qid{{font-size:10px;color:var(--muted);margin-left:auto}}
.qtext{{font-weight:600;line-height:1.5}}
.choices{{list-style:none;display:grid;gap:5px;padding-left:4px}}
.choices li{{font-size:13px;padding:4px 8px;border-radius:6px}}
.choices li.correct{{background:#d1fae5;color:#065f46;font-weight:700}}
.choices li.wrong{{color:var(--muted)}}
.exp{{font-size:12px;color:var(--muted);background:var(--cream);border-radius:6px;padding:8px 10px;line-height:1.6}}
.misc{{font-size:12px;color:#7c2d12;background:#fff7ed;border:1px solid #fed7aa;border-radius:6px;padding:6px 10px}}
.hidden{{display:none}}
</style>
</head>
<body>
<div class="top">
  <h1>MindCraft Question Bank</h1>
  <div class="stats">
    <span><strong>{total}</strong> questions</span>
    <span><strong>{concepts}</strong> concepts</span>
    {"".join(f"<span>{esc(k)}: {v}</span>" for k,v in sorted(src_breakdown.items()))}
  </div>
</div>
<div class="controls">
  <input type="search" id="srch" placeholder="Search questions, concepts, answers…">
  <select id="filterLevel">
    <option value="">All levels</option>
    <option value="1">Level 1</option>
    <option value="2">Level 2</option>
    <option value="3">Level 3</option>
  </select>
  <select id="filterSource">
    <option value="">All sources</option>
    {"".join(f'<option value="{esc(s)}">{esc(s)}</option>' for s in sorted(src_breakdown))}
  </select>
</div>
<div class="nav-strip">{"".join(concept_nav)}</div>
<div class="main" id="main">
{"".join(rows_html)}
</div>
<script>
const srch = document.getElementById('srch')
const lvlF = document.getElementById('filterLevel')
const srcF = document.getElementById('filterSource')
function applyFilters() {{
  const q = srch.value.toLowerCase()
  const lv = lvlF.value
  const sr = srcF.value
  document.querySelectorAll('.qcard').forEach(card => {{
    const txt = card.textContent.toLowerCase()
    const matchQ = !q || txt.includes(q)
    const matchL = !lv || card.dataset.level === lv
    const matchS = !sr || card.dataset.source === sr
    card.classList.toggle('hidden', !(matchQ && matchL && matchS))
  }})
  document.querySelectorAll('.concept-section').forEach(sec => {{
    const visible = [...sec.querySelectorAll('.qcard')].some(c => !c.classList.contains('hidden'))
    sec.classList.toggle('hidden', !visible)
  }})
}}
srch.addEventListener('input', applyFilters)
lvlF.addEventListener('change', applyFilters)
srcF.addEventListener('change', applyFilters)
</script>
</body>
</html>"""

    OUTPUT_PATH.write_text(html)
    print(f"Written: {OUTPUT_PATH.relative_to(REPO)}")
    print(f"  {total} questions across {concepts} concepts")
    print(f"  Open in browser: open {OUTPUT_PATH}")


if __name__ == "__main__":
    build()
