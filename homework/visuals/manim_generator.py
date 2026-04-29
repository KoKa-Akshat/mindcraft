"""
visuals/manim_generator.py

Two outputs per visual request:
  1. Manim CE Python code — for animation rendering (slow, beautiful)
  2. Fallback SVG — for immediate display (fast, always works)

Temperatures:
  Manim code: 0.1  (deterministic — code must run)
  SVG:        0.3  (slightly creative — diagrams can vary)
"""

from __future__ import annotations
import ast, os, logging
import anthropic

logger = logging.getLogger(__name__)

MODEL     = "claude-sonnet-4-5"
MAX_RETRIES = 2

MANIM_SYSTEM = """\
You are a Manim CE animation author. You write Python code using the Manim Community Edition library (manim CE, not 3b1b's private version).

You will receive a visual_description — a natural language description of an animation that should help a student build mathematical intuition.

Your job: write a complete, runnable Manim CE Python scene that implements this animation.

Rules:
1. Output ONLY Python code. No explanation, no markdown, no backticks.
2. The scene class must be named `ConceptScene` and extend `Scene`.
3. Use `self.play()` for animations, `self.wait()` for pauses.
4. Keep animations under 15 seconds total.
5. Use ManimCE color palette: BLUE, YELLOW, GREEN, RED, WHITE. Background: BLACK (default).
6. Label key elements clearly using `Text()` or `MathTex()`.
7. Animate step by step — reveal one concept at a time. Never show everything at once.
8. Use `GrowFromCenter`, `Create`, `FadeIn`, `Transform`, `MoveAlongPath` for motion.
9. For coordinate systems, use `Axes()` with `x_range` and `y_range` set explicitly.
10. End with a clean still frame holding the key insight visible for at least 2 seconds.
11. The code must run without errors. Import everything you use from `manim`.
12. I will only use Manim CE classes and methods I am certain exist. I will not invent method names.

Output: raw Python code only, starting with `from manim import *`
"""

SVG_SYSTEM = """\
You are a mathematical diagram author. You generate clean SVG diagrams that help students build intuition.

You will receive a visual_description of a mathematical concept to illustrate.

Rules:
1. Output ONLY valid SVG code. No explanation, no markdown.
2. viewBox="0 0 400 300". Background rect fill="#080810".
3. Use colors: #6366F1 (indigo accent), #F0F0F5 (primary text), #A0A0B0 (secondary), #58CC02 (green), #FF6B6B (red), #F0C060 (gold).
4. Include clear labels using <text> elements, font-family="DM Sans, sans-serif".
5. Use <line>, <circle>, <path>, <polygon> for geometry.
6. Include at least 2 labeled elements that name the key mathematical objects.
7. Add a subtle title at top: font-size="13" fill="#A0A0B0".
8. Keep it clean and purposeful. Every line should teach something.
9. Maximum 40 SVG elements total.

Output: raw SVG code only, starting with `<svg`
"""


async def generate_manim_code(visual_description: str) -> str:
    """Generate Manim scene code with syntax validation and one retry."""
    client = anthropic.AsyncAnthropic(api_key=os.environ["ANTHROPIC_API_KEY"])

    for attempt in range(MAX_RETRIES):
        message = await client.messages.create(
            model=MODEL,
            max_tokens=2048,
            temperature=0.1,
            system=MANIM_SYSTEM,
            messages=[{"role": "user", "content": f"Visual description:\n{visual_description}"}],
        )
        code = message.content[0].text.strip()

        # Strip markdown fences
        if "```" in code:
            parts = code.split("```")
            for part in parts:
                part = part.strip()
                if part.startswith("python"):
                    part = part[6:].strip()
                if "from manim import" in part or "class ConceptScene" in part:
                    code = part
                    break

        # Validate syntax
        try:
            ast.parse(code)
            logger.info("Manim code generated (%d chars, attempt %d)", len(code), attempt + 1)
            return code
        except SyntaxError as e:
            logger.warning("Manim syntax error attempt %d: %s", attempt + 1, e)
            if attempt == MAX_RETRIES - 1:
                raise RuntimeError(f"Manim code syntax invalid after {MAX_RETRIES} attempts: {e}")

    raise RuntimeError("Manim generation exhausted retries")


async def generate_svg_fallback(visual_description: str, concept: str) -> str:
    """Generate a static SVG diagram as fallback for when Manim fails or isn't installed."""
    client = anthropic.AsyncAnthropic(api_key=os.environ["ANTHROPIC_API_KEY"])

    message = await client.messages.create(
        model=MODEL,
        max_tokens=1500,
        temperature=0.3,
        system=SVG_SYSTEM,
        messages=[{
            "role": "user",
            "content": f"Concept: {concept}\nVisual description:\n{visual_description}"
        }],
    )
    svg = message.content[0].text.strip()

    # Strip markdown if present
    if "```" in svg:
        parts = svg.split("```")
        for part in parts:
            part = part.strip()
            if part.startswith("svg"):
                part = part[3:].strip()
            if part.startswith("<svg"):
                svg = part
                break

    # Ensure it starts with <svg
    if not svg.strip().startswith("<svg"):
        svg = f'<svg viewBox="0 0 400 300" xmlns="http://www.w3.org/2000/svg"><rect width="400" height="300" fill="#080810"/><text x="200" y="150" text-anchor="middle" fill="#A0A0B0" font-family="sans-serif" font-size="14">{concept.replace("_", " ").title()}</text></svg>'

    logger.info("SVG fallback generated (%d chars)", len(svg))
    return svg
