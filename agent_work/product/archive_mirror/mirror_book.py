#!/usr/bin/env python3
"""Pilot mirror pipeline for Dan McCreary's open textbooks.

Pulls a book's full structured text (via mkdocs-material's search_index.json)
and catalogs its MicroSims (via sitemap.xml, filtering for /sims/{slug}/
pages) into a clean, RAG-ingestible local folder. Does NOT byte-mirror the
live interactive sim assets (JS/p5.js/etc.) yet - that's a separate,
heavier follow-up once this text pipeline + the Drive destination are
validated. Rerunnable: safe to re-run per book at any time, overwrites
that book's output only.

Usage:
    python3 mirror_book.py <book_slug> <base_url>
    python3 mirror_book.py calculus https://dmccreary.github.io/calculus/

Output (per book): agent_work/product/archive_mirror/out/<slug>/
    manifest.json  - book metadata + attribution + fetch timestamp
    pages.jsonl     - one JSON object per indexed section (location, title, text)
    sims.json       - catalog of discovered MicroSim pages
"""
import json
import re
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urljoin

import requests

OUT_ROOT = Path(__file__).parent / "out"
UA = "Mozilla/5.0 (compatible; MindCraftArchiveMirror/0.1; +https://joinmindcraft.com)"


def fetch(url: str, timeout: int = 20) -> bytes:
    resp = requests.get(url, headers={"User-Agent": UA}, timeout=timeout)
    resp.raise_for_status()
    return resp.content


def fetch_json(url: str) -> dict:
    return json.loads(fetch(url).decode("utf-8"))


def strip_html(text: str) -> str:
    return re.sub(r"<[^>]+>", " ", text or "").replace("\xa0", " ")


def mirror_book(slug: str, base_url: str) -> dict:
    if not base_url.endswith("/"):
        base_url += "/"

    out_dir = OUT_ROOT / slug
    out_dir.mkdir(parents=True, exist_ok=True)

    # 1. Full structured text via mkdocs-material's search index.
    search_url = urljoin(base_url, "search/search_index.json")
    docs = []
    try:
        index = fetch_json(search_url)
        docs = index.get("docs", [])
    except Exception as exc:  # noqa: BLE001 - pilot script, surface and continue
        print(f"  ! search_index.json failed for {slug}: {exc}")

    pages_path = out_dir / "pages.jsonl"
    with pages_path.open("w", encoding="utf-8") as f:
        for d in docs:
            row = {
                "location": d.get("location", ""),
                "title": d.get("title", ""),
                "text": strip_html(d.get("text", "")).strip(),
                "url": urljoin(base_url, d.get("location", "")),
            }
            if row["text"]:
                f.write(json.dumps(row, ensure_ascii=False) + "\n")

    # 2. Full page list + MicroSim catalog via sitemap.xml.
    sitemap_url = urljoin(base_url, "sitemap.xml")
    all_urls = []
    try:
        raw = fetch(sitemap_url).decode("utf-8")
        all_urls = re.findall(r"<loc>([^<]+)</loc>", raw)
    except Exception as exc:  # noqa: BLE001
        print(f"  ! sitemap.xml failed for {slug}: {exc}")

    sim_urls = [u for u in all_urls if re.search(r"/sims/[^/]+/?$", u)]
    sims = []
    for u in sim_urls:
        m = re.search(r"/sims/([^/]+)/?$", u)
        sim_slug = m.group(1) if m else u
        sims.append({
            "slug": sim_slug,
            "page_url": u,
            "embed_url": urljoin(u if u.endswith("/") else u + "/", "main.html"),
        })

    sims_path = out_dir / "sims.json"
    sims_path.write_text(json.dumps({"count": len(sims), "sims": sims}, indent=2), encoding="utf-8")

    manifest = {
        "slug": slug,
        "source_base_url": base_url,
        "fetched_at": datetime.now(timezone.utc).isoformat(),
        "page_count_indexed": len(docs),
        "page_count_sitemap": len(all_urls),
        "sim_count": len(sims),
        "attribution": "Dan McCreary — open intelligent textbook. Original: " + base_url,
        "mirror_kind": "text+sim-catalog (pilot) — sim JS/assets not yet mirrored",
    }
    (out_dir / "manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    return manifest


if __name__ == "__main__":
    if len(sys.argv) != 3:
        print(__doc__)
        sys.exit(1)
    slug, url = sys.argv[1], sys.argv[2]
    started = time.time()
    result = mirror_book(slug, url)
    result["elapsed_seconds"] = round(time.time() - started, 1)
    print(json.dumps(result, indent=2))
