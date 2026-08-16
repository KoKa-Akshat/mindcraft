#!/usr/bin/env python3
"""Mirror pipeline for Dan McCreary's open textbooks.

Pulls a book's full structured text (via mkdocs-material's search_index.json),
discovers its MicroSims (via sitemap.xml), and downloads each sim's real
assets (main.html + its own local JS - CDN libraries like p5.js are left as
external references, not re-hosted) into a clean, RAG-ingestible local
folder. Rerunnable: safe to re-run per book at any time, overwrites that
book's output only.

Usage:
    python3 mirror_book.py <book_slug> <base_url>
    python3 mirror_book.py calculus https://dmccreary.github.io/calculus/

Output (per book): agent_work/product/archive_mirror/out/<slug>/
    manifest.json    - book metadata + attribution + fetch timestamp
    pages.jsonl       - one JSON object per indexed section (location, title, text)
    sims.json         - catalog of discovered MicroSim pages + local asset paths
    sims/<sim-slug>/  - each sim's main.html + its own local JS/CSS/data assets
"""
import json
import re
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urljoin, urlparse

import requests

OUT_ROOT = Path(__file__).parent / "out"
UA = "Mozilla/5.0 (compatible; MindCraftArchiveMirror/0.1; +https://joinmindcraft.com)"
LOCAL_ASSET_RE = re.compile(r'(?:src|href)="([^"]+)"')


def fetch(url: str, timeout: int = 20) -> bytes:
    resp = requests.get(url, headers={"User-Agent": UA}, timeout=timeout)
    resp.raise_for_status()
    return resp.content


def fetch_json(url: str) -> dict:
    return json.loads(fetch(url).decode("utf-8"))


def strip_html(text: str) -> str:
    return re.sub(r"<[^>]+>", " ", text or "").replace("\xa0", " ")


def mirror_sim(sim_slug: str, page_url: str, book_host: str, out_dir: Path) -> dict:
    """Download one sim's main.html plus any same-host local assets it references.
    External CDN references (jsdelivr, unpkg, etc.) are kept as-is, not mirrored."""
    embed_url = urljoin(page_url if page_url.endswith("/") else page_url + "/", "main.html")
    sim_dir = out_dir / "sims" / sim_slug
    sim_dir.mkdir(parents=True, exist_ok=True)

    result = {"slug": sim_slug, "page_url": page_url, "embed_url": embed_url,
              "local_main": None, "local_assets": [], "error": None}
    try:
        html = fetch(embed_url).decode("utf-8", errors="replace")
    except Exception as exc:  # noqa: BLE001
        result["error"] = str(exc)
        return result

    (sim_dir / "main.html").write_text(html, encoding="utf-8")
    result["local_main"] = f"sims/{sim_slug}/main.html"

    for ref in LOCAL_ASSET_RE.findall(html):
        if ref in (".", "..") or ref.startswith("#"):
            continue
        asset_url = urljoin(embed_url, ref)
        if urlparse(asset_url).netloc != book_host:
            continue  # external CDN (p5.js etc.) - left as a live reference, not mirrored
        asset_name = Path(urlparse(asset_url).path).name
        if not asset_name:
            continue
        try:
            data = fetch(asset_url)
            (sim_dir / asset_name).write_bytes(data)
            result["local_assets"].append(f"sims/{sim_slug}/{asset_name}")
        except Exception as exc:  # noqa: BLE001
            result.setdefault("asset_errors", []).append(f"{asset_name}: {exc}")

    return result


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
    book_host = urlparse(base_url).netloc

    sims = []
    sim_errors = 0
    for u in sim_urls:
        m = re.search(r"/sims/([^/]+)/?$", u)
        sim_slug = m.group(1) if m else u
        result = mirror_sim(sim_slug, u, book_host, out_dir)
        if result["error"]:
            sim_errors += 1
        sims.append(result)

    sims_path = out_dir / "sims.json"
    sims_path.write_text(json.dumps({"count": len(sims), "sims": sims}, indent=2), encoding="utf-8")

    manifest = {
        "slug": slug,
        "source_base_url": base_url,
        "fetched_at": datetime.now(timezone.utc).isoformat(),
        "page_count_indexed": len(docs),
        "page_count_sitemap": len(all_urls),
        "sim_count": len(sims),
        "sim_errors": sim_errors,
        "attribution": "Dan McCreary — open intelligent textbook. Original: " + base_url,
        "mirror_kind": "text + full sim assets (main.html + local JS/CSS; external CDN libs like p5.js referenced, not re-hosted)",
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
