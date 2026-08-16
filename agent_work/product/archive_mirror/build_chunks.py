#!/usr/bin/env python3
"""Build a richer, sim-linked chunks.json for the Archive workflow's local
search, from the full mirror output (agent_work/product/archive_mirror/out/).

The current agent_work/product/desk_os/workflows/archive/chunks.json has
only 216 entries total across 113 books (very sparse - most searches find
nothing and fall back to the plain cover grid). The mirror pipeline
(mirror_book.py) already pulled thousands of real text chunks + a verified
sim catalog per book; this script picks a bounded, good subset per book
and links pages to sims by slug/title token overlap (the raw mirror data
has no explicit page<->sim cross-links - McCreary's sites don't expose
that relationship directly, so this is a heuristic, not ground truth).

Usage:
    python3 build_chunks.py [--per-book N] [--out PATH]

Rerunnable: safe to run again any time the mirror output changes.
"""
import argparse
import json
import re
from pathlib import Path

MIRROR_OUT = Path(__file__).parent / "out"
DESK_OS_ARCHIVE = Path(__file__).parent.parent / "desk_os" / "workflows" / "archive"
BOOKS_JSON = DESK_OS_ARCHIVE / "books.json"

# Sitemap includes internal project-management pages (task lists, prompt
# logs, learning-graph tooling) alongside real reading content - these
# aren't something a student searching "calculus" should ever surface.
SKIP_PREFIXES = ("sims/", "todos", "prompts/", "learning-graph/", "references/", "quiz/", "glossary")
MIN_TEXT_LEN = 80
STOP = {"the", "and", "for", "with", "that", "this", "from", "page", "chapter", "section"}


def tokens(s: str) -> set[str]:
    return {w for w in re.split(r"[^a-z0-9]+", s.lower()) if len(w) > 2 and w not in STOP}


def load_sims(slug: str) -> list[dict]:
    path = MIRROR_OUT / slug / "sims.json"
    if not path.exists():
        return []
    data = json.loads(path.read_text())
    sims = []
    for s in data.get("sims", []):
        if s.get("error"):
            continue
        sims.append({
            "slug": s["slug"],
            "tokens": tokens(s["slug"].replace("-", " ")),
            "embed_url": s["embed_url"],
        })
    return sims


def best_sim_for(chunk_tokens: set[str], sims: list[dict]) -> dict | None:
    best, best_overlap = None, 0
    for sim in sims:
        overlap = len(chunk_tokens & sim["tokens"])
        if overlap > best_overlap:
            best, best_overlap = sim, overlap
    # Require at least 2 shared meaningful words - a single generic word
    # ("function", "graph") isn't enough signal to claim a real match.
    return best if best_overlap >= 2 else None


def build_book_chunks(slug: str, book_title: str, per_book: int) -> list[dict]:
    pages_path = MIRROR_OUT / slug / "pages.jsonl"
    if not pages_path.exists():
        return []
    sims = load_sims(slug)

    candidates = []
    with pages_path.open(encoding="utf-8") as f:
        for line in f:
            row = json.loads(line)
            location = row.get("location", "")
            if location.startswith(SKIP_PREFIXES):
                continue
            text = row.get("text", "")
            if len(text) < MIN_TEXT_LEN:
                continue
            title = row.get("title", "")
            chunk_tok = tokens(title) | tokens(location.replace("/", " "))
            sim = best_sim_for(chunk_tok, sims)
            candidates.append({
                "bookSlug": slug,
                "bookTitle": book_title,
                "pageTitle": title,
                "location": location,
                "pageUrl": row.get("url", ""),
                "quote": text[:600],
                "_hasSim": sim is not None,
                "_len": len(text),
                **({"simUrl": sim["embed_url"].rsplit("main.html", 1)[0], "simId": sim["slug"]} if sim else {}),
            })

    # Sim-linked chunks first (most valuable - real interactive content),
    # then longer/more substantial pages, deduped by page title so one
    # book doesn't crowd out variety with near-identical short sections.
    seen_titles = set()
    ranked = sorted(candidates, key=lambda c: (not c["_hasSim"], -c["_len"]))
    out = []
    for c in ranked:
        if c["pageTitle"] in seen_titles:
            continue
        seen_titles.add(c["pageTitle"])
        c.pop("_hasSim", None)
        c.pop("_len", None)
        out.append(c)
        if len(out) >= per_book:
            break
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--per-book", type=int, default=24)
    ap.add_argument("--out", default=str(DESK_OS_ARCHIVE / "chunks.json"))
    args = ap.parse_args()

    books = json.loads(BOOKS_JSON.read_text())["books"]
    all_chunks = []
    sim_linked = 0
    for b in books:
        rows = build_book_chunks(b["slug"], b["title"], args.per_book)
        sim_linked += sum(1 for r in rows if "simUrl" in r)
        all_chunks.extend(rows)

    out_path = Path(args.out)
    payload = {
        "source": (
            "Dan McCreary intelligent textbooks — chunks selected from a full-site "
            "mirror (mirror_book.py), linked to MicroSims by slug/title token "
            "overlap where confident. Original pages remain on dmccreary.github.io. "
            "MindCraft does not rehost full books."
        ),
        "builtBy": "build_chunks.py",
        "chunkCount": len(all_chunks),
        "simLinkedCount": sim_linked,
        "chunks": all_chunks,
    }
    out_path.write_text(json.dumps(payload, ensure_ascii=False, indent=1))
    size_kb = out_path.stat().st_size / 1024
    print(f"{len(all_chunks)} chunks ({sim_linked} sim-linked) across {len(books)} books -> {out_path} ({size_kb:.0f} KB)")


if __name__ == "__main__":
    main()
