from pathlib import Path
import textwrap

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
OUTPUT_DIR = ROOT / "textures" / "screens" / "vendingMachineScreens"

W = H = 1024


PROJECTS = [
    {
        "file": "project1.png",
        "label": "Three.js Island Portfolio",
        "title": "Three.js Floating Island",
        "body": "Build a miniature interactive world that turns math into something students can fly around. Students use coordinates, scale, rotation, lighting, and animation to create a floating island portfolio that demonstrates geometry and creative coding in a real project.",
        "skills": "Three.js, Geometry, Animation, Blender, Creative Coding",
    },
    {
        "file": "project2.png",
        "label": "Physics Arcade Machine",
        "title": "Physics Arcade Machine",
        "body": "Design a playable arcade scene with ramps, bumpers, moving targets, and score lights. Students explain force, velocity, gravity, collisions, and probability by tuning a game people can actually try.",
        "skills": "Physics, Vectors, JavaScript, Game Design",
    },
    {
        "file": "project3.png",
        "label": "Solar System Remix",
        "title": "Solar System Remix",
        "body": "Create an interactive solar system where orbit radius, orbital speed, planet scale, and time controls are all connected to real math. Students can remix the model to show ratios, cycles, and trigonometry.",
        "skills": "Trigonometry, Orbits, Scale Models, Three.js",
    },
    {
        "file": "project4.png",
        "label": "Fractal Crystal Cave",
        "title": "Fractal Crystal Cave",
        "body": "Turn patterns into a glowing cave of recursive crystals. This project lets students demonstrate symmetry, repetition, recursion, and procedural generation through a walkable math-art scene.",
        "skills": "Fractals, Recursion, Symmetry, Procedural Art",
    },
    {
        "file": "project5.png",
        "label": "Roller Coaster Builder",
        "title": "Roller Coaster Builder",
        "body": "Build a coaster track around a small world using curves, slope, acceleration, and energy. Students adjust the path and explain how graph shapes change the ride experience.",
        "skills": "Functions, Curves, Physics, Graphing",
    },
    {
        "file": "project6.png",
        "label": "Data Aquarium",
        "title": "Data Aquarium",
        "body": "Transform a dataset into a living aquarium. Fish size, speed, color, and movement can map to real values so students can present statistics as an animated world instead of a flat chart.",
        "skills": "Data Visualization, Statistics, Mapping, Animation",
    },
    {
        "file": "project7.png",
        "label": "Maze Garden",
        "title": "Maze Garden",
        "body": "Create a garden maze with gates, keys, and hidden paths. Students show coordinate grids, logic, optimization, and pathfinding by designing a puzzle that can be solved and tested.",
        "skills": "Algorithms, Grid Math, Pathfinding, Logic",
    },
    {
        "file": "project8.png",
        "label": "Phoenix Flight Simulator",
        "title": "Phoenix Flight Simulator",
        "body": "Animate a phoenix through rings, arcs, and sky paths using curves and timing. This is a premium asset showcase where students connect parametric motion to cinematic 3D storytelling.",
        "skills": "Parametric Curves, Animation, 3D Assets, Three.js",
    },
]


def font(size, bold=False):
    candidates = [
        "/System/Library/Fonts/SFNSRounded.ttf",
        "/System/Library/Fonts/SFNS.ttf",
        "/System/Library/Fonts/Helvetica.ttc",
        "/Library/Fonts/Arial Unicode.ttf",
    ]
    for candidate in candidates:
        try:
            return ImageFont.truetype(candidate, size=size, index=1 if bold else 0)
        except Exception:
            continue
    return ImageFont.load_default()


FONT_TITLE = font(40, True)
FONT_LABEL = font(25, True)
FONT_BODY = font(21)
FONT_BODY_SMALL = font(20)
FONT_TAG = font(20, True)
FONT_BUTTON = font(30, True)
FONT_LOGO = font(86, True)
FONT_LOGO_SMALL = font(36, True)


def draw_wrapped(draw, text, xy, width, font_obj, fill, line_gap=8):
    x, y = xy
    avg = max(1, font_obj.getlength("abcdefghijklmnopqrstuvwxyz") / 26)
    chars = max(12, int(width / avg))
    for para in text.split("\n"):
        for line in textwrap.wrap(para, width=chars):
            draw.text((x, y), line, font=font_obj, fill=fill)
            y += font_obj.size + line_gap
        y += line_gap
    return y


def rounded(draw, box, radius, fill, outline=None, width=1):
    draw.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=width)


def logo_mark(draw, box, large=False):
    x1, y1, x2, y2 = box
    rounded(draw, box, 26, "#ffffff", "#b9fff1", 3)
    cx = (x1 + x2) // 2
    cy = (y1 + y2) // 2
    size = min(x2 - x1, y2 - y1)
    badge = [
        (cx, cy - int(size * 0.33)),
        (cx + int(size * 0.34), cy - int(size * 0.12)),
        (cx + int(size * 0.27), cy + int(size * 0.27)),
        (cx, cy + int(size * 0.38)),
        (cx - int(size * 0.27), cy + int(size * 0.27)),
        (cx - int(size * 0.34), cy - int(size * 0.12)),
    ]
    draw.polygon(badge, fill="#3348ff")
    draw.polygon(
        [
            (cx, cy - int(size * 0.24)),
            (cx + int(size * 0.22), cy - int(size * 0.08)),
            (cx, cy + int(size * 0.08)),
            (cx - int(size * 0.22), cy - int(size * 0.08)),
        ],
        fill="#19d6a3",
    )
    logo_text = "MC"
    text_font = FONT_LOGO if large else FONT_LOGO_SMALL
    tw = draw.textlength(logo_text, font=text_font)
    draw.text((cx - tw / 2, cy - text_font.size / 2 - 2), logo_text, font=text_font, fill="#ffffff")


def make_card(project):
    image = Image.new("RGB", (W, H), "#05d28f")
    draw = ImageDraw.Draw(image)

    for y in range(0, H, 4):
        color = "#05d28f" if (y // 4) % 2 == 0 else "#08c98e"
        draw.line((0, y, W, y), fill=color)

    rounded(draw, (18, 18, 1006, 1006), 62, None, "#082f38", 28)
    rounded(draw, (58, 58, 966, 966), 40, "#07d596", "#8ffff0", 4)

    small = (132, 138, 324, 388)
    big = (356, 138, 892, 388)
    body = (132, 438, 892, 742)
    back = (132, 790, 462, 930)
    learn = (530, 790, 860, 930)

    rounded(draw, small, 14, "#baffec", "#96fff0", 2)
    logo_mark(draw, (174, 166, 282, 274), large=False)
    draw_wrapped(draw, project["label"], (158, 292), 142, FONT_LABEL, "#293b48", 4)

    rounded(draw, big, 14, "#baffec", "#96fff0", 2)
    rounded(draw, (380, 164, 868, 360), 8, "#102229", None, 0)
    logo_mark(draw, (534, 188, 714, 332), large=True)
    draw.text((618, 342), "MindCraft project preview", font=FONT_BODY_SMALL, fill="#baffec", anchor="mm")

    rounded(draw, body, 14, "#baffec", "#96fff0", 2)
    draw.text((170, 486), project["title"], font=FONT_TITLE, fill="#283b48")
    body_y = draw_wrapped(draw, project["body"], (170, 548), 674, FONT_BODY, "#293b48", 6)
    tag_y = min(body_y + 8, 684)
    rounded(draw, (170, tag_y, 236, tag_y + 34), 3, "#293b48")
    draw.text((184, tag_y + 6), "Skills", font=FONT_TAG, fill="#ffffff")
    draw.text((252, tag_y + 8), project["skills"], font=FONT_BODY_SMALL, fill="#52636e")

    rounded(draw, back, 12, "#baffec", "#96fff0", 2)
    draw.text((160, 812), "Go Back", font=FONT_BUTTON, fill="#344654")
    draw.ellipse((382, 882, 432, 932), fill="#5166ff")
    draw.line((397, 902, 407, 912), fill="#ffffff", width=7)
    draw.line((407, 912, 421, 896), fill="#ffffff", width=7)

    rounded(draw, learn, 12, "#4256ff", "#2838d7", 2)
    draw.rectangle((530, 880, 860, 930), fill="#2f35d9")
    draw.text((560, 812), "Learn More", font=FONT_BUTTON, fill="#ffffff")
    draw.text((560, 858), "(Coming Soon)", font=FONT_LABEL, fill="#ffffff")
    draw.ellipse((784, 884, 834, 934), fill="#ffffff")
    draw.text((809, 898), "i", font=FONT_BUTTON, fill="#4256ff", anchor="mm")

    return image


def main():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    for project in PROJECTS:
        path = OUTPUT_DIR / project["file"]
        make_card(project).save(path, optimize=True)
        print(path)


if __name__ == "__main__":
    main()
