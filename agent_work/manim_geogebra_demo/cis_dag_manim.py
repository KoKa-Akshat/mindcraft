"""
CIS worked-example animation: renders the recursive Concept Impact Score
computation from learning-graphs ch. 28 as a bottom-up sum over the dependency DAG.

Driven by cis_spec.json (the pipeline's intermediate representation).
Deliberately LaTeX-free: only Text/shape mobjects, so no TeX install is needed.

Render (from this directory, inside the manim venv):
    manim -qm cis_dag_manim.py CISWorkedExample
"""

import json
from pathlib import Path

from manim import (
    BLACK, DOWN, GREY_B, LEFT, ORIGIN, RIGHT, UP, WHITE, YELLOW,
    Arrow, Create, FadeIn, FadeOut, Flash, Indicate, RoundedRectangle, Scene,
    SurroundingRectangle, Text, TransformFromCopy, VGroup, Write as WriteAnim,
)

SPEC = json.loads((Path(__file__).parent / "cis_spec.json").read_text())

INK = "#eceff4"
MUTED = "#8f9aa8"
NODE_FILL = "#232936"
NODE_EDGE = "#5b6b7b"
ACCENT = "#4c8dff"
GOOD = "#3fb96a"
WARN = "#e6a23c"


def node_box(label: str, width: float = 2.6, font_size: int = 24) -> VGroup:
    txt = Text(label, font_size=font_size, color=INK, line_spacing=0.8)
    box = RoundedRectangle(
        corner_radius=0.14, width=max(width, txt.width + 0.5),
        height=max(0.8, txt.height + 0.45),
        fill_color=NODE_FILL, fill_opacity=1, stroke_color=NODE_EDGE, stroke_width=2,
    )
    txt.move_to(box)
    return VGroup(box, txt)


def cis_badge(value: int, color: str = ACCENT) -> VGroup:
    txt = Text(f"CIS {value}", font_size=20, color=BLACK, weight="BOLD")
    pill = RoundedRectangle(
        corner_radius=0.18, width=txt.width + 0.36, height=txt.height + 0.24,
        fill_color=color, fill_opacity=1, stroke_width=0,
    )
    txt.move_to(pill)
    return VGroup(pill, txt)


class CISWorkedExample(Scene):
    def run_sum(self, terms, target_node, result_value, row_pos, color):
        """Fly `terms` (list of (source_mobject, str)) into a sum row, collapse to a badge."""
        row = VGroup()
        for i, (_, s) in enumerate(terms):
            if i:
                row.add(Text("+", font_size=26, color=MUTED))
            row.add(Text(s, font_size=26, color=INK, weight="BOLD"))
        row.arrange(RIGHT, buff=0.16).move_to(row_pos)

        # own "+1" appears first, then each dependent's CIS flies in
        self.play(FadeIn(row[0]), run_time=0.4)
        idx = 1
        for src, _ in terms[1:]:
            self.play(
                FadeIn(row[idx]),
                TransformFromCopy(src, row[idx + 1]),
                run_time=0.55,
            )
            idx += 2
        eq = Text(f"= {result_value}", font_size=28, color=color, weight="BOLD")
        eq.next_to(row, RIGHT, buff=0.25)
        self.play(WriteAnim(eq), run_time=0.5)
        self.wait(0.4)

        badge = cis_badge(result_value, color)
        badge.next_to(target_node, RIGHT, buff=0.18)
        self.play(TransformFromCopy(VGroup(row, eq), badge), run_time=0.7)
        self.play(FadeOut(row), FadeOut(eq), run_time=0.4)
        return badge

    def construct(self):
        dag = SPEC["worked_example"]["dag"]
        nodes = {n["id"]: n for n in dag["nodes"]}

        title = Text("Concept Impact Score — the chapter's worked example",
                     font_size=30, color=INK).to_edge(UP, buff=0.35)
        formula = Text("CIS(x) = 1 + Σ CIS(d)   over every concept d that depends on x",
                       font_size=24, color=MUTED).next_to(title, DOWN, buff=0.18)
        self.play(WriteAnim(title), run_time=1.0)
        self.play(FadeIn(formula), run_time=0.7)

        # --- Layout ---------------------------------------------------------
        leaf_ids = ["scaffolding", "curriculum_design", "metacognition", "nine_events"]
        leaf_x = [-5.1, -1.8, 1.6, 5.0]
        leaf_y = 1.55
        boxes = {}
        for lid, x in zip(leaf_ids, leaf_x):
            label = nodes[lid]["label"]
            if lid == "nine_events":
                label = "Nine Events\nof Instruction"
            boxes[lid] = node_box(label, width=2.4, font_size=21).move_to([x, leaf_y, 0])
        boxes["instructional_design"] = node_box("Instructional Design").move_to([0, -0.85, 0])
        boxes["behaviorism"] = node_box("Behaviorism").move_to([0, -2.75, 0])

        arrows = VGroup()
        for lid in leaf_ids:
            arrows.add(Arrow(boxes[lid].get_bottom(),
                             boxes["instructional_design"].get_top(),
                             buff=0.08, stroke_width=2.5, color=NODE_EDGE,
                             max_tip_length_to_length_ratio=0.08))
        id_to_b = Arrow(boxes["instructional_design"].get_bottom(),
                        boxes["behaviorism"].get_top(),
                        buff=0.08, stroke_width=2.5, color=NODE_EDGE,
                        max_tip_length_to_length_ratio=0.12)

        dep_label = Text("arrows = “depends on”", font_size=18, color=MUTED)
        dep_label.to_corner(LEFT + DOWN, buff=0.3)

        self.play(*[FadeIn(boxes[k]) for k in boxes], run_time=1.0)
        self.play(Create(arrows), Create(id_to_b), FadeIn(dep_label), run_time=1.0)
        self.wait(0.5)

        # --- Beat 1: the indegree blind spot --------------------------------
        indeg = Text("indegree(Behaviorism) = 1  →  “looks minor”",
                     font_size=24, color=WARN)
        indeg.next_to(boxes["behaviorism"], DOWN, buff=0.35)
        self.play(Indicate(id_to_b, color=WARN), FadeIn(indeg), run_time=1.2)
        self.wait(1.2)
        self.play(FadeOut(indeg), run_time=0.5)

        # --- Beat 2: score the leaf subtrees --------------------------------
        note = Text("sub-scores illustrative — the totals 102 and 103 are the chapter's real values",
                    font_size=17, color=MUTED).to_corner(RIGHT + DOWN, buff=0.3)
        self.play(FadeIn(note), run_time=0.5)

        leaf_badges = {}
        anims = []
        for lid in leaf_ids:
            b = cis_badge(nodes[lid]["cis"], GOOD)
            b.next_to(boxes[lid], UP, buff=0.12)
            leaf_badges[lid] = b
            anims.append(FadeIn(b, shift=0.2 * UP))
        subtree = Text("each already sums its own downstream subtree",
                       font_size=19, color=GOOD).next_to(formula, DOWN, buff=0.25)
        self.play(*anims, FadeIn(subtree), run_time=1.0)
        self.wait(1.0)
        self.play(FadeOut(subtree), run_time=0.4)

        # --- Beat 3: sum into Instructional Design --------------------------
        terms = [(boxes["instructional_design"], "1")]
        terms += [(leaf_badges[lid], str(nodes[lid]["cis"])) for lid in leaf_ids]
        id_badge = self.run_sum(
            terms, boxes["instructional_design"], 102,
            row_pos=[0, 0.35, 0], color=ACCENT,
        )
        self.wait(0.5)

        # --- Beat 4: sum into Behaviorism -----------------------------------
        b_badge = self.run_sum(
            [(boxes["behaviorism"], "1"), (id_badge, "102")],
            boxes["behaviorism"], 103,
            row_pos=[2.4, -1.8, 0], color=YELLOW,
        )
        self.play(Flash(boxes["behaviorism"], color=YELLOW, flash_radius=1.6),
                  run_time=0.8)

        # --- Beat 5: punchline ----------------------------------------------
        self.play(FadeOut(note), FadeOut(dep_label), run_time=0.4)
        punch = Text("indegree 1  ·  CIS 103  —  a top-15 concept out of 410",
                     font_size=27, color=YELLOW, weight="BOLD")
        punch.next_to(boxes["behaviorism"], DOWN, buff=0.35)
        frame = SurroundingRectangle(VGroup(boxes["behaviorism"], b_badge),
                                     color=YELLOW, buff=0.15, corner_radius=0.12)
        self.play(Create(frame), WriteAnim(punch), run_time=1.2)
        self.wait(2.5)
