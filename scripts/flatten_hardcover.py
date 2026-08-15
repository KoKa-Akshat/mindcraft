#!/usr/bin/env python3
"""Warp a photographed book to a face-forward 3:4 cover."""

from __future__ import annotations

import sys
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

W, H = 600, 800
SRC = Path("/opt/cursor/artifacts/assets")
DESTS = [
    Path("/workspace/img/dans-covers"),
    Path("/workspace/agent_work/product/desk_os/workflows/archive/covers"),
]


def order_pts(pts: np.ndarray) -> np.ndarray:
    s = pts.sum(axis=1)
    diff = np.diff(pts, axis=1).reshape(-1)
    return np.array(
        [pts[np.argmin(s)], pts[np.argmin(diff)], pts[np.argmax(s)], pts[np.argmax(diff)]],
        dtype=np.float32,
    )


def cover_quad(bgr: np.ndarray) -> np.ndarray | None:
    h, w = bgr.shape[:2]
    hsv = cv2.cvtColor(bgr, cv2.COLOR_BGR2HSV)
    # cream / paper
    light = cv2.inRange(hsv, (0, 0, 150), (40, 90, 255))
    light = cv2.morphologyEx(light, cv2.MORPH_CLOSE, np.ones((15, 15), np.uint8))
    cnts, _ = cv2.findContours(light, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not cnts:
        return None
    c = max(cnts, key=cv2.contourArea)
    if cv2.contourArea(c) < 0.18 * w * h:
        return None
    peri = cv2.arcLength(c, True)
    approx = cv2.approxPolyDP(c, 0.02 * peri, True)
    if len(approx) == 4:
        return order_pts(approx.reshape(4, 2))
    rect = cv2.minAreaRect(c)
    box = cv2.boxPoints(rect)
    return order_pts(box)


def flatten(path: Path) -> Image.Image:
    raw = cv2.imdecode(np.fromfile(path, dtype=np.uint8), cv2.IMREAD_COLOR)
    if raw is None:
        raise RuntimeError(f"unreadable {path}")
    quad = cover_quad(raw)
    if quad is not None:
        dst = np.array([[0, 0], [W - 1, 0], [W - 1, H - 1], [0, H - 1]], dtype=np.float32)
        m = cv2.getPerspectiveTransform(quad, dst)
        out = cv2.warpPerspective(raw, m, (W, H), flags=cv2.INTER_LANCZOS4)
    else:
        out = cv2.resize(raw, (W, H), interpolation=cv2.INTER_LANCZOS4)
    rgb = cv2.cvtColor(out, cv2.COLOR_BGR2RGB)
    return Image.fromarray(rgb)


def save(im: Image.Image, name: str) -> None:
    for dest in DESTS:
        dest.mkdir(parents=True, exist_ok=True)
        im.save(dest / name, "JPEG", quality=84, optimize=True, progressive=True)


def main() -> None:
    names = sys.argv[1:]
    if not names:
        names = [p.name for p in SRC.glob("*.jpg")]
    for name in names:
        src = SRC / name
        if not src.exists():
            print("MISSING", name)
            continue
        im = flatten(src)
        save(im, name)
        print("flat", name, (DESTS[0] / name).stat().st_size // 1024, "KB")


if __name__ == "__main__":
    main()
