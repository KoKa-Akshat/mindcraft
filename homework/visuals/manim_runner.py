"""
visuals/manim_runner.py

Executes Manim scenes and caches results by concept hash.
Falls back to SVG if Manim is not installed or render fails.

Cache: visuals/output/{hash}/ConceptScene.gif
"""

from __future__ import annotations
import subprocess, hashlib, os, logging, asyncio, base64
from pathlib import Path

from visuals.manim_generator import generate_manim_code, generate_svg_fallback

logger = logging.getLogger(__name__)

SCENES_DIR  = Path(__file__).parent / "scenes"
OUTPUT_DIR  = Path(__file__).parent / "output"
MANIM_TIMEOUT = 45  # seconds


def _concept_hash(concept_key: str) -> str:
    return hashlib.md5(concept_key.encode()).hexdigest()[:10]


def _is_manim_available() -> bool:
    try:
        result = subprocess.run(
            ["manim", "--version"],
            capture_output=True, text=True, timeout=5
        )
        return result.returncode == 0
    except (FileNotFoundError, subprocess.TimeoutExpired):
        return False


def _run_manim_sync(scene_code: str, scene_path: Path, output_dir: Path) -> Path:
    """Synchronous Manim render call."""
    scene_path.write_text(scene_code)
    result = subprocess.run(
        [
            "manim", str(scene_path), "ConceptScene",
            "--format", "gif",
            "--output_dir", str(output_dir),
            "-q", "m",               # medium quality, fast
            "--disable_caching",
            "--no_latex_cleanup",
        ],
        capture_output=True, text=True, timeout=MANIM_TIMEOUT
    )
    if result.returncode != 0:
        raise RuntimeError(f"Manim render failed:\n{result.stderr[-500:]}")

    # Find the output gif
    gifs = list(output_dir.glob("**/*.gif"))
    if not gifs:
        raise RuntimeError("Manim produced no gif output")
    return gifs[0]


async def render_visual(
    visual_description: str,
    concept_key: str,
) -> dict:
    """
    Returns a dict with keys:
      type: "gif" | "svg"
      data: base64-encoded gif bytes OR raw SVG string
      cached: bool
    """
    h = _concept_hash(concept_key)
    gif_dir = OUTPUT_DIR / h
    gif_path = gif_dir / "ConceptScene.gif"

    # Cache hit
    if gif_path.exists():
        logger.info("Visual cache hit: %s", concept_key)
        data = base64.b64encode(gif_path.read_bytes()).decode()
        return {"type": "gif", "data": data, "cached": True}

    # Try Manim if available
    if _is_manim_available():
        try:
            SCENES_DIR.mkdir(parents=True, exist_ok=True)
            gif_dir.mkdir(parents=True, exist_ok=True)
            scene_path = SCENES_DIR / f"{h}.py"

            manim_code = await generate_manim_code(visual_description)

            # Run in thread pool to avoid blocking the event loop
            loop = asyncio.get_running_loop()
            rendered_path = await loop.run_in_executor(
                None,
                _run_manim_sync,
                manim_code,
                scene_path,
                gif_dir,
            )

            data = base64.b64encode(rendered_path.read_bytes()).decode()
            logger.info("Manim render success: %s", concept_key)
            return {"type": "gif", "data": data, "cached": False}

        except Exception as exc:
            logger.warning("Manim failed (%s), falling back to SVG: %s", concept_key, exc)

    # SVG fallback — always works
    svg = await generate_svg_fallback(visual_description, concept_key)
    return {"type": "svg", "data": svg, "cached": False}
