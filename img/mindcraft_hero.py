from manim import *
import numpy as np

# ─────────────────────────────────────────────────────────────────────────────
# MindCraft Hero — Fourier Raccoon
#
# Run:    manim -pqh mindcraft_hero.py MindCraftHero
# Deps:   pip install manim
# Font:   Install "Nunito" from Google Fonts (system-wide), or swap to "Arial".
#
# Reference style: chibi raccoon — very round wide head, small triangle ears,
# big dark eye-mask patches, white fluffy muzzle, tiny nose, soft chin.
# ─────────────────────────────────────────────────────────────────────────────

class MindCraftHero(ThreeDScene):

    # ── ① BRAND COLORS ── edit freely ────────────────────────────────────────
    BRAND_GREEN  = "#58CC02"   # vectors, nodes, CTA, glow accent
    DARK         = "#1f2933"   # outline, text, face
    MID_GRAY     = "#4a5568"   # minor vectors
    CONSTR       = "#c8d0d8"   # construction circles
    MASK_GRAY    = "#3d3d3d"   # raccoon eye-mask patches
    MUZZLE_WHITE = "#f0eeec"   # muzzle blob (very light warm gray)
    EAR_INNER    = "#d0c8c0"   # inner ear fill
    BG           = "#ffffff"   # background

    # ── ② TIMING (seconds) — total ≈ 11.8 s ──────────────────────────────────
    T_LOGO     = 0.60
    T_DRAW     = 6.20   # Fourier drawing pass
    T_FADE_EPI = 0.85   # fade construction geometry
    T_FACE     = 1.20   # chibi features appear
    T_NODES    = 1.00   # constellation nodes + spokes
    T_LABELS   = 0.40   # subject labels
    T_CTA      = 0.65   # CTA slides up
    T_HOLD     = 1.60   # hold at end

    # ── ③ FOURIER SETTINGS ────────────────────────────────────────────────────
    N_VECS = 70     # epicycle count — more = more detail, slower render
    SCALE  = 1.10   # drawing size  — increase to enlarge, decrease to shrink

    def construct(self):
        self.camera.background_color = self.BG

        # Gentle 3-D tilt. phi = tilt from vertical, theta = horizontal yaw.
        self.set_camera_orientation(phi=64 * DEGREES, theta=-40 * DEGREES, zoom=1.06)

        # ── 1. LOGO ───────────────────────────────────────────────────────────
        logo = Text("MindCraft", font="Nunito", weight=BOLD).scale(0.53)
        logo[:4].set_color(self.DARK)
        logo[4:].set_color(self.BRAND_GREEN)
        logo.to_corner(UL, buff=0.45)
        self.add_fixed_in_frame_mobjects(logo)
        self.play(FadeIn(logo, shift=DOWN * 0.12), run_time=self.T_LOGO)

        # ── 2. RACCOON SILHOUETTE ─────────────────────────────────────────────
        # Edit (x, y) pairs to reshape the outline.
        # Style goal: very round head, small compact ears, soft puffy chin.
        # The curve closes automatically back to the first point.
        #
        # Coordinate ranges (raw, before SCALE):
        #   x: roughly -1.90 … +1.90   y: roughly -1.42 … +1.62
        # After SCALE = 1.10 the drawn shape spans ≈ -2.09 … +2.09 in x.
        raw_pts = np.array([
            # ── top of head (between ears) ──────────────────────────────────
            [ 0.00,  1.62],
            # ── left inner ear ──────────────────────────────────────────────
            [-0.38,  1.60],
            # ── left ear tip (compact triangle) ────────────────────────────
            [-0.72,  1.98],   # ← ear peak — move up/down to resize ear
            # ── left ear outer base ─────────────────────────────────────────
            [-1.05,  1.52],
            # ── left head (very round) ──────────────────────────────────────
            [-1.52,  1.22],
            [-1.82,  0.65],
            [-1.90,  0.00],   # widest point
            [-1.82, -0.62],
            # ── left chin (puffy, round) ────────────────────────────────────
            [-1.42, -1.08],
            [-0.88, -1.36],
            [ 0.00, -1.42],   # chin center
            [ 0.88, -1.36],
            # ── right chin ──────────────────────────────────────────────────
            [ 1.42, -1.08],
            [ 1.82, -0.62],
            # ── right head (round mirror of left) ───────────────────────────
            [ 1.90,  0.00],
            [ 1.82,  0.65],
            [ 1.52,  1.22],
            # ── right ear outer base ────────────────────────────────────────
            [ 1.05,  1.52],
            # ── right ear tip ───────────────────────────────────────────────
            [ 0.72,  1.98],
            # ── right inner ear ─────────────────────────────────────────────
            [ 0.38,  1.60],
        ])

        # Drawing is centered at ORIGIN_PT.
        # Drawn position of any raw point = (SCALE*x, 0.06 + SCALE*y).
        ORIGIN_PT = np.array([0.0, 0.06, 0.0])

        z_curve = self._resample(raw_pts[:, 0] + 1j * raw_pts[:, 1], 700)
        coeffs  = self._fourier(z_curve, self.N_VECS, self.SCALE)

        # ── 3. LIVE DRAWING OBJECTS ───────────────────────────────────────────
        path_pts = []

        glow = VMobject()
        glow.set_stroke(self.BRAND_GREEN, width=20, opacity=0.09)
        glow.set_points_as_corners([ORIGIN_PT, ORIGIN_PT + [1e-6, 0, 0]])

        outline = VMobject()
        outline.set_stroke(self.DARK, width=4.6)
        outline.set_points_as_corners([ORIGIN_PT, ORIGIN_PT + [1e-6, 0, 0]])

        tip_dot = Dot3D(radius=0.044, color=self.BRAND_GREEN)
        tip_dot.move_to(ORIGIN_PT)

        epi_mob = VGroup()
        t_val   = ValueTracker(0)

        # One updater handles everything — avoids triple-computing the tip.
        def _update(mob):
            t   = t_val.get_value()
            cur = ORIGIN_PT.copy()
            circs = VGroup()
            vecs  = VGroup()

            for freq, c in coeffs:
                r   = abs(c)
                ang = np.angle(c) + TAU * freq * t
                nxt = cur + r * np.array([np.cos(ang), np.sin(ang), 0.0])

                circ = Circle(radius=r)
                circ.move_to(cur)
                circ.set_stroke(self.CONSTR, width=0.85, opacity=0.38)
                circs.add(circ)

                major = abs(freq) <= 4   # dominant low-frequency arms
                vec   = Line(cur, nxt)
                vec.set_stroke(
                    self.BRAND_GREEN if major else self.MID_GRAY,
                    width   = 2.5 if major else 0.9,
                    opacity = 0.78 if major else 0.50,
                )
                vecs.add(vec)
                cur = nxt

            mob.become(VGroup(circs, vecs))
            tip_dot.move_to(cur)
            path_pts.append(cur.copy())
            if len(path_pts) >= 2:
                glow.set_points_as_corners(path_pts)
                outline.set_points_as_corners(path_pts)

        epi_mob.add_updater(_update)
        self.add(epi_mob, glow, outline, tip_dot)

        self.begin_ambient_camera_rotation(rate=0.06)

        self.play(
            t_val.animate.set_value(1),
            run_time=self.T_DRAW,
            rate_func=linear,
        )

        # ── 4. FADE CONSTRUCTION GEOMETRY ────────────────────────────────────
        epi_mob.clear_updaters()
        self.play(
            FadeOut(epi_mob),
            FadeOut(tip_dot),
            FadeOut(glow),
            run_time=self.T_FADE_EPI,
        )

        # ── 5. CHIBI RACCOON FACE ─────────────────────────────────────────────
        #
        # All positions are in drawn-space: drawn_pos = (SCALE*x, 0.06+SCALE*y)
        # Adjust move_to() calls if you change SCALE or ORIGIN_PT.
        #
        # Face anatomy (drawn coords):
        #   Head top      ≈ y = +1.84
        #   Eye mask ctr  ≈ y = +0.48,  x = ±0.52
        #   Muzzle blob   ≈ y = +0.04
        #   Nose          ≈ y = +0.09
        #   Chin          ≈ y = -1.50
        # ─────────────────────────────────────────────────────────────────────

        D = self.DARK
        W = WHITE

        # ── Inner ear fills (small warm-gray ellipses inside each ear) ────────
        # Ear tips in drawn space: left ≈ (-0.79, +2.24), right ≈ (+0.79, +2.24)
        # Inner ear is a smaller ellipse sitting inside, slightly below the tip.
        l_inner_ear = Ellipse(width=0.26, height=0.38)
        l_inner_ear.rotate(18 * DEGREES)
        l_inner_ear.move_to(LEFT * 0.72 + UP * 1.92)
        l_inner_ear.set_fill(self.EAR_INNER, opacity=0.80).set_stroke(self.EAR_INNER, width=0)

        r_inner_ear = Ellipse(width=0.26, height=0.38)
        r_inner_ear.rotate(-18 * DEGREES)
        r_inner_ear.move_to(RIGHT * 0.72 + UP * 1.92)
        r_inner_ear.set_fill(self.EAR_INNER, opacity=0.80).set_stroke(self.EAR_INNER, width=0)

        # ── Raccoon eye masks (large dark tilted ellipses) ────────────────────
        # The chibi style has big, prominent masks that cover most of the eye area.
        lm = Ellipse(width=0.96, height=0.52)
        rm = Ellipse(width=0.96, height=0.52)
        lm.rotate( 13 * DEGREES)
        rm.rotate(-13 * DEGREES)
        lm.move_to(LEFT  * 0.52 + UP * 0.48)   # ← adjust x/y to taste
        rm.move_to(RIGHT * 0.52 + UP * 0.48)
        for m in (lm, rm):
            m.set_fill(self.MASK_GRAY, opacity=0.92).set_stroke(self.MASK_GRAY, width=0)

        # ── White sclera ──────────────────────────────────────────────────────
        le = Dot(radius=0.072, color=W).move_to(lm.get_center() + UP * 0.03)
        re = Dot(radius=0.072, color=W).move_to(rm.get_center() + UP * 0.03)

        # ── Dark pupils ───────────────────────────────────────────────────────
        lp = Dot(radius=0.033, color=D).move_to(le.get_center())
        rp = Dot(radius=0.033, color=D).move_to(re.get_center())

        # ── Eye shine (tiny white highlight) ─────────────────────────────────
        ls = Dot(radius=0.012, color=W).move_to(le.get_center() + UP * 0.024 + RIGHT * 0.020)
        rs = Dot(radius=0.012, color=W).move_to(re.get_center() + UP * 0.024 + RIGHT * 0.020)

        # ── White muzzle blob (fluffy cheek area below masks) ─────────────────
        # This is the defining chibi raccoon feature — big round white muzzle.
        muzzle = Ellipse(width=0.78, height=0.50)
        muzzle.move_to(DOWN * 0.02)   # ← adjust if nose/mouth look off
        muzzle.set_fill(self.MUZZLE_WHITE, opacity=0.82).set_stroke(self.MUZZLE_WHITE, width=0)

        # ── Tiny nose (dark oval, center-top of muzzle) ───────────────────────
        nose = Ellipse(width=0.14, height=0.10)
        nose.move_to(UP * 0.09)
        nose.set_fill(D, opacity=1).set_stroke(D, width=0)

        # ── Subtle smile (very gentle arc, chibi-style) ───────────────────────
        # Edit start_angle and angle (both in degrees) to reshape the smile.
        smile = Arc(radius=0.14, start_angle=210 * DEGREES, angle=120 * DEGREES)
        smile.move_to(DOWN * 0.10)
        smile.set_stroke(D, width=2.2, opacity=0.70)

        face = VGroup(l_inner_ear, r_inner_ear, lm, rm, le, re, lp, rp, ls, rs,
                      muzzle, nose, smile)
        self.play(
            LaggedStart(*[FadeIn(m, scale=0.80) for m in face], lag_ratio=0.10),
            run_time=self.T_FACE,
        )

        # ── 6. CONSTELLATION NODES ────────────────────────────────────────────
        # Edit ("Subject", [x, y, z]) to move or rename subjects.
        # Nodes sit just outside the raccoon head silhouette.
        SUBJECTS = [
            ("Algebra",  np.array([-2.42,  2.05, 0.15])),
            ("Geometry", np.array([ 2.38,  1.88, 0.15])),
            ("Trig",     np.array([-2.40, -1.62, 0.10])),
            ("Calculus", np.array([ 2.38, -1.52, 0.10])),
            ("SAT",      np.array([ 0.00,  2.55, 0.25])),
        ]

        nodes_grp  = VGroup()
        spokes_grp = VGroup()
        labels_grp = VGroup()

        for label, pos in SUBJECTS:
            # Pulsing ring + center dot
            ring = Circle(radius=0.120).move_to(pos)
            ring.set_stroke(self.BRAND_GREEN, width=2.2, opacity=0.64)
            ring.set_fill(self.BRAND_GREEN, opacity=0.07)
            ctr = Dot3D(point=pos, radius=0.042, color=self.BRAND_GREEN)
            nodes_grp.add(ring, ctr)

            # Dashed spoke back to mascot center
            spoke = DashedLine(pos, ORIGIN_PT, dash_length=0.07, dashed_ratio=0.45)
            spoke.set_stroke(self.BRAND_GREEN, width=1.3, opacity=0.26)
            spokes_grp.add(spoke)

            # Label below ring  ← edit scale(0.195) to change font size
            txt = Text(label, font="Nunito", weight=BOLD, color=self.DARK).scale(0.195)
            txt.next_to(pos, DOWN, buff=0.17)
            labels_grp.add(txt)

        self.play(
            LaggedStart(*[GrowFromCenter(n) for n in nodes_grp], lag_ratio=0.10),
            Create(spokes_grp, lag_ratio=0.10),
            run_time=self.T_NODES,
        )
        self.play(FadeIn(labels_grp), run_time=self.T_LABELS)

        # ── 7. CTA BUTTON ─────────────────────────────────────────────────────
        self.stop_ambient_camera_rotation()   # settle view before CTA

        pill = RoundedRectangle(
            width=3.65, height=0.70,
            corner_radius=0.22,
            fill_color=self.BRAND_GREEN,
            fill_opacity=1,
            stroke_width=0,
        )
        cta_lbl = Text(
            "FIRST CLASS, ON US",   # ← edit CTA copy here
            font="Nunito", weight=BOLD, color=WHITE,
        ).scale(0.275)
        cta_lbl.move_to(pill.get_center())
        cta = VGroup(pill, cta_lbl).to_edge(DOWN, buff=0.40)

        self.add_fixed_in_frame_mobjects(cta)
        self.play(FadeIn(cta, shift=UP * 0.12), run_time=self.T_CTA)

        self.wait(self.T_HOLD)

    # ── HELPERS ───────────────────────────────────────────────────────────────

    def _resample(self, z, samples=700):
        """
        Arc-length uniform resampling so the Fourier drawing moves at
        constant speed around the curve (avoids ugly bunching at dense areas).
        """
        zc  = np.append(z, z[0])
        d   = np.abs(np.diff(zc))
        cum = np.insert(np.cumsum(d), 0, 0.0)
        s   = np.linspace(0, cum[-1], samples, endpoint=False)
        return np.interp(s, cum, zc.real) + 1j * np.interp(s, cum, zc.imag)

    def _fourier(self, z, n=70, scale=1.10):
        """
        Compute n DFT epicycle coefficients, balanced around DC.
        Frequencies:  0, +1, -1, +2, -2, …  (largest amplitude first)

        scale  — multiplies every coefficient (including DC), so the entire
                 drawing is uniformly enlarged.  Raise to grow, lower to shrink.
        """
        N     = len(z)
        t_arr = np.arange(N, dtype=float) / N

        freqs = [0]
        for k in range(1, n // 2 + 1):
            freqs += [k, -k]

        coeffs = []
        for f in freqs:
            c = np.dot(np.exp(-TAU * 1j * f * t_arr), z) / N
            c *= scale
            coeffs.append((f, c))

        coeffs.sort(key=lambda x: -abs(x[1]))   # largest radius drawn first
        return coeffs
