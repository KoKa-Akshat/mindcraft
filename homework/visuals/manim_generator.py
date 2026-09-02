"""
visuals/manim_generator.py

Generates visual assets for homework cards — either runnable Manim CE Python
code or a static SVG fallback. All LLM calls go through utils.claude_client.
"""

from __future__ import annotations
import ast, logging

from utils.claude_client import call_claude

logger = logging.getLogger(__name__)

MAX_RETRIES = 2

# ── System prompts ─────────────────────────────────────────────────────────────

MANIM_SYSTEM = """\
You are a Manim CE animation author. You write Python code using the Manim Community Edition library.

You will receive a visual_description — a natural language description of an animation that should
help a student build mathematical intuition.

Rules:
1. Output ONLY Python code. No explanation, no markdown, no backticks.
2. The scene class must be named `ConceptScene` and extend `Scene`.
3. Use `self.play()` for animations, `self.wait()` for pauses.
4. Keep animations under 15 seconds total.
5. Use ManimCE colors: BLUE, YELLOW, GREEN, RED, WHITE. Background: BLACK (default).
6. Label key elements clearly using `Text()` or `MathTex()`.
7. Animate step by step — reveal one concept at a time.
8. Use `GrowFromCenter`, `Create`, `FadeIn`, `Transform` for motion.
9. For coordinate systems, use `Axes()` with explicit `x_range` and `y_range`.
10. End with a still frame holding the key insight visible for at least 2 seconds.
11. Import everything you use from `manim`. Never invent method names.

Output: raw Python code only, starting with `from manim import *`
"""

SVG_SYSTEM = """\
You are a mathematical diagram author. You generate clean SVG diagrams that help students build intuition.

Rules:
1. Output ONLY valid SVG code. No explanation, no markdown.
2. viewBox="0 0 400 300". Background rect fill="#080810".
3. Colors: #6366F1 (indigo), #F0F0F5 (primary text), #A0A0B0 (secondary),
   #58CC02 (green), #FF6B6B (red), #F0C060 (gold).
4. Clear labels using <text> elements, font-family="DM Sans, sans-serif".
5. Use <line>, <circle>, <path>, <polygon> for geometry.
6. Include at least 2 labeled elements naming key mathematical objects.
7. Subtle title at top: font-size="13" fill="#A0A0B0".
8. Keep it clean and purposeful. Every element should teach something.
9. Maximum 40 SVG elements total.

Output: raw SVG code only, starting with `<svg`
"""

# ── Manim generation ───────────────────────────────────────────────────────────

async def generate_manim_code(visual_description: str) -> str:
    """
    Generate runnable Manim CE Python code for a visual description.

    Validates syntax with ast.parse and retries once on failure.

    Args:
        visual_description: Natural language description of the animation.

    Returns:
        A Python source string starting with `from manim import *`.

    Raises:
        RuntimeError: If syntax validation fails after MAX_RETRIES attempts.
    """
    for attempt in range(MAX_RETRIES):
        code = await call_claude(
            system_prompt = MANIM_SYSTEM,
            user_message  = f"Visual description:\n{visual_description}",
            temperature   = 0.1,   # deterministic — code must run
            max_tokens    = 2048,
        )

        # Strip markdown fences if model added them
        if "```" in code:
            for part in code.split("```"):
                part = part.strip()
                if part.startswith("python"):
                    part = part[6:].strip()
                if "from manim import" in part or "class ConceptScene" in part:
                    code = part
                    break

        try:
            ast.parse(code)
            logger.info("Manim code generated (%d chars, attempt %d)", len(code), attempt + 1)
            return code
        except SyntaxError as exc:
            logger.warning("Manim syntax error attempt %d: %s", attempt + 1, exc)
            if attempt == MAX_RETRIES - 1:
                raise RuntimeError(
                    f"Manim code syntax invalid after {MAX_RETRIES} attempts: {exc}"
                ) from exc

    raise RuntimeError("Manim generation exhausted retries")


# ── SVG fallback ───────────────────────────────────────────────────────────────

FALLBACK_SVG_TEMPLATE = (
    '<svg viewBox="0 0 400 300" xmlns="http://www.w3.org/2000/svg">'
    '<rect width="400" height="300" fill="#080810"/>'
    '<text x="200" y="150" text-anchor="middle" fill="#A0A0B0" '
    'font-family="sans-serif" font-size="14">{label}</text></svg>'
)


async def generate_svg_fallback(visual_description: str, concept: str) -> str:
    """
    Generate a static SVG diagram as a fallback when Manim is unavailable.

    Args:
        visual_description: Natural language description of the diagram.
        concept:            Concept key used in the fallback label.

    Returns:
        Raw SVG string starting with `<svg`.
    """
    svg = await call_claude(
        system_prompt = SVG_SYSTEM,
        user_message  = f"Concept: {concept}\nVisual description:\n{visual_description}",
        temperature   = 0.3,
        max_tokens    = 1500,
    )

    # Strip markdown fences if present
    if "```" in svg:
        for part in svg.split("```"):
            part = part.strip()
            if part.startswith("svg"):
                part = part[3:].strip()
            if part.startswith("<svg"):
                svg = part
                break

    if not svg.strip().startswith("<svg"):
        label = concept.replace("_", " ").title()
        svg = FALLBACK_SVG_TEMPLATE.format(label=label)

    logger.info("SVG fallback generated (%d chars)", len(svg))
    return svg
