#!/usr/bin/env python3
"""Download official covers. Do not overwrite photographed hardcovers.

HARDCOVER_LOCK: skip slugs that already have a photographed cover.
"""

from __future__ import annotations

import hashlib
import io
import json
import math
import random
import ssl
import urllib.error
import urllib.request
from pathlib import Path

from concurrent.futures import ThreadPoolExecutor, as_completed

from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageFont, ImageOps, ImageChops

ROOT = Path(__file__).resolve().parents[1]
CATALOG = ROOT / "data" / "dansArchive.json"
OUT_MARKETING = ROOT / "img" / "dans-covers"
OUT_PROTO = ROOT / "agent_work" / "product" / "desk_os" / "workflows" / "archive" / "covers"
BOOKS_JSON = ROOT / "agent_work" / "product" / "desk_os" / "workflows" / "archive" / "books.json"

W, H = 600, 800
CTX = ssl.create_default_context()
UA = {"User-Agent": "MindCraftArchive/1.0 (+https://joinmindcraft.com/dans-archive.html)"}

SERIF = ImageFont.truetype("/usr/share/fonts/truetype/liberation/LiberationSerif-Bold.ttf", 54)
SERIF_SM = ImageFont.truetype("/usr/share/fonts/truetype/liberation/LiberationSerif-Bold.ttf", 36)
SANS = ImageFont.truetype("/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf", 16)
SANS_B = ImageFont.truetype("/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf", 15)

PALETTES = {
    "math": ((20, 58, 46), (196, 245, 71), (247, 241, 227)),
    "cs": ((29, 58, 138), (196, 245, 71), (247, 241, 227)),
    "eng": ((116, 64, 86), (245, 211, 72), (247, 241, 227)),
    "sci": ((36, 122, 77), (196, 245, 71), (247, 241, 227)),
    "life": ((43, 92, 58), (180, 210, 90), (247, 241, 227)),
    "biz": ((201, 150, 63), (20, 58, 46), (247, 241, 227)),
    "hist": ((116, 64, 86), (245, 211, 72), (247, 241, 227)),
    "lang": ((125, 111, 168), (247, 241, 227), (247, 241, 227)),
    "health": ((193, 18, 31), (247, 241, 227), (247, 241, 227)),
    "ai": ((29, 58, 138), (196, 245, 71), (247, 241, 227)),
    "other": ((20, 58, 46), (196, 245, 71), (247, 241, 227)),
}


def family(subject: str, title: str) -> str:
    s = f"{subject} {title}".lower()
    if any(k in s for k in ("math", "calculus", "algebra", "geometry", "trig", "stat", "function", "linear")):
        return "math"
    if any(k in s for k in ("health", "medicine", "dementia", "seizure", "public health")):
        return "health"
    if any(k in s for k in ("bio", "ecology", "genetic", "moss", "hydropon", "food")):
        return "life"
    if any(k in s for k in ("physics", "chem", "forensic", "science")):
        return "sci"
    if any(k in s for k in ("circuit", "electron", "robot", "engineer", "dsp", "signal", "semicon", "microcontrol", "3d print")):
        return "eng"
    if any(k in s for k in ("history", "heritage", "clan", "geography", "government")):
        return "hist"
    if any(k in s for k in ("language", "dakota", "ojibwe", "asl", "english", "reading")):
        return "lang"
    if any(k in s for k in ("business", "finance", "econom", "investor", "entrepreneur")):
        return "biz"
    if any(k in s for k in ("ai", "llm", "agent", "prompt", "generative", "machine learning", "deep learning")):
        return "ai"
    if any(k in s for k in ("computer", "python", "linux", "graph", "database", "network", "cyber")):
        return "cs"
    return "other"


def fetch(url: str, timeout: float = 14) -> bytes | None:
    try:
        req = urllib.request.Request(url, headers=UA)
        with urllib.request.urlopen(req, timeout=timeout, context=CTX) as r:
            ctype = (r.headers.get("Content-Type") or "").lower()
            data = r.read()
        if len(data) < 800:
            return None
        if "html" in ctype or data[:15].lstrip().lower().startswith(b"<!doctype") or data[:6].lstrip().lower().startswith(b"<html"):
            return None
        return data
    except (urllib.error.URLError, TimeoutError, ssl.SSLError, ValueError):
        return None


def candidates(book: dict) -> list[str]:
    url = book["url"].rstrip("/")
    slug = book["slug"]
    paths = [
        "/img/cover.png",
        "/img/cover.jpg",
        "/img/cover.jpeg",
        "/img/cover.webp",
        "/img/cover-image.png",
        "/img/cover-image.jpg",
        f"/img/{slug}-cover.png",
        "/img/cover-social-media-preview.png",
        "/img/cover-social-media.png",
        "/img/cover-social-media.jpg",
        "/img/social-preview-cover.png",
        "/img/cover-landscape.png",
        "/img/site-cover.jpg",
        "/img/cover-wide-small.jpg",
        "/assets/images/social/index.png",
        "/img/social-card.png",
        "/img/logo.png",
    ]
    out = [url + p for p in paths]
    # a few known one-offs
    extras = {
        "deep-learning-course": [f"{url}/img/cover-image.png"],
        "mccreary-heritage": [f"{url}/img/site-cover.jpg"],
        "systems-thinking": [f"{url}/img/cover-wide-small.jpg", f"{url}/img/cover.jpg", f"{url}/img/cover.png"],
        "personal-finance": [f"{url}/img/cover.png", f"{url}/img/cover-landscape.png"],
        "graph-algorithms": [f"{url}/img/cover.webp", f"{url}/img/cover.png"],
        "seizure-safe-schools": [f"{url}/img/cover.png", f"{url}/assets/images/social/index.png"],
        "GED-Science-prep": [f"{url}/img/cover.png", f"{url}/assets/images/social/index.png"],
        "chatgpt-for-teachers": [f"{url}/img/cover.png", f"{url}/assets/images/social/index.png"],
        "asl-book": [f"{url}/img/cover.png", f"{url}/assets/images/social/index.png"],
        "dakota-textbook": [f"{url}/img/cover.png"],
        "ojibwe-textbook": [f"{url}/img/cover.png"],
        "umn-senior-design": [f"{url}/img/cover.png"],
        "i-book-v1": [f"{url}/img/cover.png"],
        "Intelligent_Textbook": [f"{url}/img/cover.png"],
        "ir-textbook": [f"{url}/img/cover.png"],
        "ee-microsims": [f"{url}/img/cover.png"],
        "ai-racing-league": [f"{url}/img/cover.png", f"{url}/assets/images/social/index.png"],
        "clan-macquarrie": [f"{url}/img/cover.png", f"{url}/img/site-cover.jpg"],
        "beginning-electronics": [f"{url}/img/cover.png"],
        "circuits": [f"{url}/img/cover.png"],
        "cmm-for-genai": [f"{url}/img/cover.png"],
        "mini-mba-for-startups": [f"{url}/img/cover.png"],
        "neurodiversity-course": [f"{url}/img/cover.png"],
        "stem-classroom-admin": [f"{url}/img/cover.png"],
        "stem-robots": [f"{url}/img/cover.png"],
        "trigonometric-functions": [
            "https://dmccreary.github.io/trig/img/cover.png",
            "https://dmccreary.github.io/trigonometry/img/cover.png",
        ],
    }
    for extra in extras.get(slug, []):
        if extra not in out:
            out.insert(0, extra)
    return out


def _is_logo(im: Image.Image) -> bool:
    small = im.resize((48, 48), Image.Resampling.BILINEAR)
    colors = small.getcolors(48 * 48)
    if colors and len(colors) <= 14:
        return True
    px = list(small.getdata())
    white = sum(1 for r, g, b in px if r > 240 and g > 240 and b > 240)
    return white / len(px) > 0.72


def _letterbox(im: Image.Image) -> Image.Image:
    w, h = im.size
    bg = im.resize((1, 1), Image.Resampling.BOX).getpixel((0, 0))
    canvas = Image.new("RGB", (W, H), bg)
    scale = min(W / w, H / h)
    nw, nh = max(1, int(w * scale)), max(1, int(h * scale))
    fitted = im.resize((nw, nh), Image.Resampling.LANCZOS)
    canvas.paste(fitted, ((W - nw) // 2, (H - nh) // 2))
    return canvas


def to_cover(data: bytes) -> Image.Image | None:
    try:
        im = Image.open(io.BytesIO(data))
        im = ImageOps.exif_transpose(im)
        im = im.convert("RGB")
    except Exception:
        return None
    w, h = im.size
    if w < 80 or h < 80:
        return None
    if _is_logo(im):
        return None
    target = W / H
    src = w / h
    if abs(src - target) < 0.08:
        return im.resize((W, H), Image.Resampling.LANCZOS)
    if src > 1.25:
        return None  # caller composes a book plate around the landscape art
    return _letterbox(im)


def wrap(draw: ImageDraw.ImageDraw, text: str, font, max_w: int) -> list[str]:
    words = text.split()
    lines, cur = [], ""
    for word in words:
        trial = (cur + " " + word).strip()
        if draw.textlength(trial, font=font) <= max_w:
            cur = trial
        else:
            if cur:
                lines.append(cur)
            cur = word
    if cur:
        lines.append(cur)
    return lines[:5]


def draw_emblem(draw: ImageDraw.ImageDraw, kind: str, ink, accent, rng: random.Random, box):
    x0, y0, x1, y1 = box
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    if kind == "graph":
        pts = []
        for i in range(7):
            x = x0 + 20 + i * (x1 - x0 - 40) / 6
            y = cy + rng.randint(-70, 70)
            pts.append((x, y))
        draw.line(pts, fill=ink, width=3)
        for p in pts:
            draw.ellipse((p[0] - 5, p[1] - 5, p[0] + 5, p[1] + 5), fill=accent, outline=ink)
    elif kind == "circuit":
        for i in range(4):
            y = y0 + 40 + i * 70
            draw.line((x0 + 30, y, x1 - 30, y), fill=ink, width=2)
            draw.rectangle((cx - 28, y - 14, cx + 28, y + 14), outline=ink, width=2)
        draw.line((cx, y0 + 20, cx, y1 - 20), fill=ink, width=2)
    elif kind == "leaf":
        draw.ellipse((cx - 70, cy - 110, cx + 70, cy + 110), outline=ink, width=3)
        draw.line((cx, cy - 110, cx, cy + 110), fill=ink, width=2)
        for i in range(-4, 5):
            draw.line((cx, cy + i * 18, cx + (50 if i % 2 == 0 else -50), cy + i * 18 - 20), fill=ink, width=2)
    elif kind == "hex":
        r = 70
        for k in range(3):
            rr = r - k * 18
            pts = [
                (cx + rr * math.cos(math.radians(a)), cy + rr * math.sin(math.radians(a)))
                for a in range(0, 360, 60)
            ]
            draw.polygon(pts, outline=ink)
    elif kind == "wave":
        pts = []
        for i in range(40):
            x = x0 + 20 + i * (x1 - x0 - 40) / 39
            y = cy + 50 * math.sin(i / 4 + rng.random())
            pts.append((x, y))
        draw.line(pts, fill=ink, width=3)
    elif kind == "map":
        draw.rounded_rectangle((x0 + 40, y0 + 30, x1 - 40, y1 - 30), 12, outline=ink, width=3)
        for _ in range(8):
            x, y = rng.randint(int(x0) + 60, int(x1) - 60), rng.randint(int(y0) + 50, int(y1) - 50)
            draw.ellipse((x - 6, y - 6, x + 6, y + 6), fill=accent, outline=ink)
    elif kind == "book":
        draw.rectangle((cx - 80, cy - 100, cx + 70, cy + 100), outline=ink, width=3)
        draw.rectangle((cx - 88, cy - 108, cx - 80, cy + 100), fill=ink)
        for i in range(5):
            draw.line((cx - 60, cy - 70 + i * 28, cx + 50, cy - 70 + i * 28), fill=ink, width=2)
    elif kind == "chip":
        draw.rounded_rectangle((cx - 90, cy - 60, cx + 90, cy + 60), 8, outline=ink, width=3)
        for i in range(6):
            draw.line((cx - 90, cy - 40 + i * 16, cx - 110, cy - 40 + i * 16), fill=ink, width=2)
            draw.line((cx + 90, cy - 40 + i * 16, cx + 110, cy - 40 + i * 16), fill=ink, width=2)
        draw.rectangle((cx - 30, cy - 20, cx + 30, cy + 20), fill=accent, outline=ink)
    else:
        draw.ellipse((cx - 80, cy - 80, cx + 80, cy + 80), outline=ink, width=3)
        draw.ellipse((cx - 40, cy - 40, cx + 40, cy + 40), fill=accent)


EMBLEM = {
    "math": "graph",
    "cs": "hex",
    "eng": "circuit",
    "sci": "wave",
    "life": "leaf",
    "biz": "book",
    "hist": "map",
    "lang": "book",
    "health": "leaf",
    "ai": "chip",
    "other": "hex",
}


def generate_cover(book: dict) -> Image.Image:
    fam = family(book["subject"], book["title"])
    ink, accent, paper = PALETTES[fam]
    rng = random.Random(int(hashlib.sha1(book["slug"].encode()).hexdigest()[:8], 16))
    im = Image.new("RGB", (W, H), paper)
    noise = Image.effect_noise((W, H), 18).convert("RGB")
    im = ImageChops.blend(im, noise, 0.08)
    im = im.filter(ImageFilter.SMOOTH)
    draw = ImageDraw.Draw(im)
    draw.rectangle((18, 18, W - 19, H - 19), outline=ink, width=3)
    draw.rectangle((26, 26, W - 27, H - 27), outline=ink, width=1)
    # corner marks
    for x, y, dx, dy in ((26, 26, 18, 18), (W - 27, 26, -18, 18), (26, H - 27, 18, -18), (W - 27, H - 27, -18, -18)):
        draw.line((x, y, x + dx, y), fill=ink, width=2)
        draw.line((x, y, x, y + dy), fill=ink, width=2)

    title = book["title"].upper()
    font = SERIF if len(title) < 22 else SERIF_SM
    lines = wrap(draw, title, font, W - 80)
    y = 56
    for line in lines:
        tw = draw.textlength(line, font=font)
        draw.text(((W - tw) / 2, y), line, fill=ink, font=font)
        y += font.size + 6
    sub = book["subject"].upper()
    sw = draw.textlength(sub, font=SANS_B)
    draw.line((80, y + 8, W / 2 - sw / 2 - 12, y + 8), fill=ink, width=1)
    draw.line((W / 2 + sw / 2 + 12, y + 8, W - 80, y + 8), fill=ink, width=1)
    draw.text(((W - sw) / 2, y), sub, fill=ink, font=SANS_B)

    draw_emblem(draw, EMBLEM[fam], ink, accent, rng, (70, y + 50, W - 70, H - 140))

    foot = "OPEN LEARNING ARCHIVE"
    fw = draw.textlength(foot, font=SANS)
    draw.line((70, H - 88, W - 70, H - 88), fill=ink, width=1)
    draw.text(((W - fw) / 2, H - 72), foot, fill=ink, font=SANS)
    return ImageEnhance.Contrast(im).enhance(1.05)


def save_jpg(im: Image.Image, dest: Path) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    rgb = im.convert("RGB")
    rgb.save(dest, "JPEG", quality=84, optimize=True, progressive=True)


def cover_with_banner(book: dict, banner: Image.Image) -> Image.Image:
    """Official landscape social card + title plate so it reads as a book."""
    base = generate_cover(book)
    band_h = 300
    scale = W / banner.width
    nw, nh = W, max(1, int(banner.height * scale))
    banner = banner.resize((nw, nh), Image.Resampling.LANCZOS)
    if nh > band_h:
        top = (nh - band_h) // 2
        banner = banner.crop((0, top, W, top + band_h))
    elif nh < band_h:
        pad = Image.new("RGB", (W, band_h), banner.resize((1, 1)).getpixel((0, 0)))
        pad.paste(banner, (0, (band_h - nh) // 2))
        banner = pad
    y = 210
    base.paste(banner, (0, y))
    draw = ImageDraw.Draw(base)
    draw.rectangle((18, y, W - 19, y + band_h), outline=(20, 58, 46), width=2)
    return base


def cover_with_logo(book: dict, logo: Image.Image) -> Image.Image:
    base = generate_cover(book)
    logo = logo.convert("RGB")
    max_w, max_h = 360, 320
    scale = min(max_w / logo.width, max_h / logo.height, 1.0)
    nw, nh = max(1, int(logo.width * scale)), max(1, int(logo.height * scale))
    logo = logo.resize((nw, nh), Image.Resampling.LANCZOS)
    x = (W - nw) // 2
    y = 250
    # punch a cream plate so the logo reads
    plate = Image.new("RGB", (nw + 24, nh + 24), (247, 241, 227))
    base.paste(plate, (x - 12, y - 12))
    base.paste(logo, (x, y))
    return base


HARDCOVER_LOCK = {
    "algebra-1", "biology", "calculus", "chemistry", "circuits", "computer-science",
    "fft-benchmarking", "beginning-electronics", "geometry-course", "hydroponics",
    "linear-algebra", "learning-micropython", "intro-to-physics-course",
    "learning-python", "quantum-computing", "raspberry-pi-stem",
    "trigonometric-functions", "asl-book", "ai-racing-league", "blockchain",
    "clan-macquarrie", "clocks-and-watches", "conversational-ai", "dakota-textbook",
    "umn-senior-design", "Digital-Transformation-with-AI-Spring-2026",
    "GED-Science-prep", "genai-arch-patterns", "chatgpt-for-teachers",
    "graph-data-modeling-course", "graph-lms", "graph-rag", "intro-to-graph",
    "i-book-v1", "Intelligent_Textbook", "ir-textbook", "ee-microsims",
    "neurodiversity-course", "ojibwe-textbook", "mini-mba-for-startups",
    "pre-calc", "robot-day", "seizure-safe-schools", "signal-processing",
    "spectrum-analyzer", "stem-robots", "us-geography",
}


def resolve_book(book: dict) -> tuple[dict, Image.Image, str]:
    locked = OUT_MARKETING / f"{book['slug']}.jpg"
    if book["slug"] in HARDCOVER_LOCK and locked.exists():
        return book, Image.open(locked).convert("RGB"), "hardcover"
    logo = None
    for url in candidates(book):
        data = fetch(url)
        if not data:
            continue
        try:
            raw = Image.open(io.BytesIO(data))
            raw = ImageOps.exif_transpose(raw).convert("RGB")
        except Exception:
            continue
        if _is_logo(raw) or "/logo." in url.lower() or url.lower().endswith("logo.png"):
            if logo is None:
                logo = raw
            continue
        if raw.width / raw.height > 1.25:
            return book, cover_with_banner(book, raw), url
        im = to_cover(data)
        if im:
            return book, im, url
    if logo is not None:
        return book, cover_with_logo(book, logo), "logo+series"
    return book, generate_cover(book), "generated"


def main() -> None:
    catalog = json.loads(CATALOG.read_text())
    official = 0
    generated = 0
    resolved: dict[str, tuple[Image.Image, str]] = {}
    with ThreadPoolExecutor(max_workers=16) as ex:
        futs = [ex.submit(resolve_book, book) for book in catalog["books"]]
        for fut in as_completed(futs):
            book, im, source = fut.result()
            resolved[book["slug"]] = (im, source)
            print(f"{'OFF' if source != 'generated' else 'GEN'}  {book['slug']:40s}  {source}")

    for book in catalog["books"]:
        slug = book["slug"]
        fname = f"{slug}.jpg"
        im, source = resolved[slug]
        if source == "generated":
            generated += 1
        else:
            official += 1
        save_jpg(im, OUT_MARKETING / fname)
        save_jpg(im, OUT_PROTO / fname)
        book["cover"] = f"img/dans-covers/{fname}"
        book["coverSource"] = source

    CATALOG.write_text(json.dumps(catalog, indent=2, ensure_ascii=False) + "\n")
    proto_books = []
    for book in catalog["books"]:
        proto_books.append({
            "slug": book["slug"],
            "title": book["title"],
            "subject": book["subject"],
            "description": book["description"],
            "stats": book.get("stats") or "",
            "url": book["url"],
            "cover": f"covers/{book['slug']}.jpg",
        })
    BOOKS_JSON.write_text(json.dumps({"books": proto_books}, indent=2, ensure_ascii=False) + "\n")
    print(f"\n{len(catalog['books'])} books  official={official}  generated={generated}")


if __name__ == "__main__":
    main()
