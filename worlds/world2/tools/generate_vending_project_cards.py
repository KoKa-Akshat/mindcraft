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


FONT_TITLE = font(36, True)
FONT_LABEL = font(22, True)
FONT_BODY = font(19)
FONT_BODY_SMALL = font(18)
FONT_TAG = font(18, True)
FONT_BUTTON = font(24, True)
FONT_LOGO = font(86, True)
FONT_LOGO_SMALL = font(36, True)

MC_GREEN = "#54b948"
MC_GREEN_DARK = "#449a38"


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


# Layout aligned to original ramen-shop screens + 3D raycaster hit boxes
# (projectNavigateHitBoxGeometry 0.47×0.27 at x=0.86 and x=1.415, y=-1.66).
LEFT_CARD = (61, 80, 299, 391)
RIGHT_CARD = (450, 80, 817, 391)
PREVIEW = (488, 118, 801, 302)
BODY = (80, 448, 808, 800)
# Visual buttons sized to match raycaster planes (~297×170 px), not full card width.
BTN_BACK = (94, 823, 334, 957)
BTN_LEARN = (444, 823, 684, 957)


def btn_icon_box(btn):
    x1, y1, x2, y2 = btn
    size = min(x2 - x1, y2 - y1) // 3
    cx = x2 - size // 2 - 14
    cy = (y1 + y2) // 2
    half = size // 2
    return (cx - half, cy - half, cx + half, cy + half)


def make_card(project):
    image = Image.new("RGB", (W, H), "#00cc99")
    draw = ImageDraw.Draw(image)

    rounded(draw, (18, 18, 1006, 1006), 62, None, "#111111", 28)
    rounded(draw, (58, 58, 966, 966), 40, "#00cc99", "#8ffff0", 4)

    card_fill = "#99eecc"
    card_outline = "#88ddbb"

    rounded(draw, LEFT_CARD, 14, card_fill, card_outline, 2)
    logo_mark(draw, (LEFT_CARD[0] + 18, LEFT_CARD[1] + 14, LEFT_CARD[0] + 162, LEFT_CARD[1] + 158), large=False)
    draw_wrapped(draw, project["label"], (LEFT_CARD[0] + 12, LEFT_CARD[1] + 168), LEFT_CARD[2] - LEFT_CARD[0] - 24, FONT_LABEL, "#293b48", 4)

    rounded(draw, RIGHT_CARD, 14, card_fill, card_outline, 2)
    rounded(draw, PREVIEW, 8, "#111111", None, 0)
    preview_cx = (PREVIEW[0] + PREVIEW[2]) // 2
    preview_cy = (PREVIEW[1] + PREVIEW[3]) // 2 - 12
    logo_size = 118
    logo_mark(
        draw,
        (
            preview_cx - logo_size // 2,
            preview_cy - logo_size // 2,
            preview_cx + logo_size // 2,
            preview_cy + logo_size // 2,
        ),
        large=True,
    )
    draw.text(
        (preview_cx, PREVIEW[3] - 18),
        "MindCraft project preview",
        font=FONT_BODY_SMALL,
        fill="#99eecc",
        anchor="mm",
    )

    rounded(draw, BODY, 14, card_fill, card_outline, 2)
    body_pad = 18
    title_x = BODY[0] + body_pad
    title_y = BODY[1] + body_pad
    draw.text((title_x, title_y), project["title"], font=FONT_TITLE, fill="#283b48")
    body_y = draw_wrapped(
        draw,
        project["body"],
        (title_x, title_y + 48),
        BODY[2] - BODY[0] - body_pad * 2,
        FONT_BODY,
        "#293b48",
        5,
    )
    tag_y = min(body_y + 6, BODY[3] - 52)
    rounded(draw, (title_x, tag_y, title_x + 66, tag_y + 30), 3, "#293b48")
    draw.text((title_x + 14, tag_y + 5), "Skills", font=FONT_TAG, fill="#ffffff")
    draw.text((title_x + 82, tag_y + 7), project["skills"], font=FONT_BODY_SMALL, fill="#52636e")

    rounded(draw, BTN_BACK, 10, card_fill, card_outline, 2)
    back_text_x = BTN_BACK[0] + 16
    back_text_y = BTN_BACK[1] + (BTN_BACK[3] - BTN_BACK[1]) // 2 - FONT_BUTTON.size // 2
    draw.text((back_text_x, back_text_y), "Go Back", font=FONT_BUTTON, fill="#344654")
    back_icon = btn_icon_box(BTN_BACK)
    draw.ellipse(back_icon, fill=MC_GREEN)
    ix1, iy1, ix2, iy2 = back_icon
    draw.line((ix1 + 8, (iy1 + iy2) // 2, (ix1 + ix2) // 2 - 2, iy1 + 10), fill="#ffffff", width=5)
    draw.line(((ix1 + ix2) // 2 - 2, iy1 + 10, ix2 - 6, (iy1 + iy2) // 2 - 6), fill="#ffffff", width=5)

    rounded(draw, BTN_LEARN, 10, MC_GREEN, MC_GREEN_DARK, 2)
    learn_x = BTN_LEARN[0] + 16
    learn_mid_y = (BTN_LEARN[1] + BTN_LEARN[3]) // 2
    draw.text((learn_x, learn_mid_y - 28), "Learn More", font=FONT_BUTTON, fill="#ffffff")
    draw.text((learn_x, learn_mid_y + 2), "(Coming Soon)", font=FONT_LABEL, fill="#ffffff")
    learn_icon = btn_icon_box(BTN_LEARN)
    draw.ellipse(learn_icon, fill="#ffffff")
    lcx = (learn_icon[0] + learn_icon[2]) // 2
    lcy = (learn_icon[1] + learn_icon[3]) // 2
    draw.text((lcx, lcy), "i", font=FONT_BUTTON, fill=MC_GREEN, anchor="mm")

    return image


def main():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    for project in PROJECTS:
        path = OUTPUT_DIR / project["file"]
        make_card(project).save(path, optimize=True)
        print(path)


if __name__ == "__main__":
    main()
