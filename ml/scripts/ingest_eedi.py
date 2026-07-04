#!/usr/bin/env python3
"""
Eedi → MindCraft question bank ingestion pipeline.

Usage:
    python ml/scripts/ingest_eedi.py \
        --train data/eedi/train.csv \
        --mapping data/eedi/misconception_mapping.csv \
        --out-questions app/src/data/eediQuestions.json \
        --out-misconceptions ml/data/eedi_misconceptions.json \
        --report data/eedi/ingest_report.json

    # Dry run (no LLM, no files written):
    python ml/scripts/ingest_eedi.py --train data/eedi/train.csv --dry-run

    # Limit to specific concepts for a pilot:
    python ml/scripts/ingest_eedi.py --train ... --concepts algebraic_manipulation,fractions_decimals
"""

import argparse
import hashlib
import json
import os
import re
import sys
import time
from pathlib import Path
from typing import Optional

import pandas as pd

# ---------------------------------------------------------------------------
# Subject → (conceptId, defaultLevel) mapping
# EXCLUDE means no ACT equivalent or always diagram-dependent.
# ---------------------------------------------------------------------------

SUBJECT_MAP: dict[str, tuple[str, int]] = {
    # ── ORDER OF OPERATIONS ──────────────────────────────────────────────
    "BIDMAS":                                             ("order_of_operations", 1),
    "Basic Calculator Use":                               ("order_of_operations", 1),
    "Combining Operations":                               ("order_of_operations", 1),

    # ── NUMBER PROPERTIES ────────────────────────────────────────────────
    "Place Value":                                        ("number_properties", 1),
    "Mental Addition and Subtraction":                    ("number_properties", 1),
    "Mental Multiplication and Division":                 ("number_properties", 1),
    "Written Addition":                                   ("number_properties", 1),
    "Written Subtraction":                                ("number_properties", 1),
    "Written Multiplication":                             ("number_properties", 1),
    "Written Division":                                   ("number_properties", 1),
    "Adding and Subtracting Negative Numbers":            ("number_properties", 1),
    "Multiplying and Dividing Negative Numbers":          ("number_properties", 1),
    "Ordering Negative Numbers":                          ("number_properties", 1),
    "Factors and Highest Common Factor":                  ("number_properties", 1),
    "Multiples and Lowest Common Multiple":               ("number_properties", 1),
    "Rounding to the Nearest Whole (10, 100, etc)":      ("number_properties", 1),
    "Rounding to Decimal Places":                        ("number_properties", 1),
    "Rounding to Significant Figures":                   ("number_properties", 2),
    "Estimation":                                         ("number_properties", 2),
    "Upper and Lower Bounds":                             ("number_properties", 3),
    "Counting":                                           ("number_properties", 1),
    "Recurring Decimals to Fractions":                   ("number_properties", 2),
    "Basic Money":                                        ("number_properties", 1),
    "Currency Conversions":                               ("ratios_proportions", 1),
    "Temperature units":                                  ("measurement_units", 1),
    "Basic Calculator Use":                               ("order_of_operations", 1),

    # ── EXPONENT RULES ───────────────────────────────────────────────────
    "Squares, Cubes, etc":                                ("exponent_rules", 1),
    "Square Roots, Cube Roots, etc":                      ("exponent_rules", 1),
    "Laws of Indices":                                    ("exponent_rules", 2),
    "Standard Form":                                      ("exponent_rules", 2),

    # ── RADICAL EXPRESSIONS ──────────────────────────────────────────────
    "Simplifying Surds":                                  ("radical_expressions", 2),
    "Operations with Surds":                              ("radical_expressions", 3),

    # ── FRACTIONS & DECIMALS ─────────────────────────────────────────────
    "Adding and Subtracting Fractions":                   ("fractions_decimals", 1),
    "Multiplying Fractions":                              ("fractions_decimals", 1),
    "Dividing Fractions":                                 ("fractions_decimals", 2),
    "Equivalent Fractions":                               ("fractions_decimals", 1),
    "Simplifying Fractions":                              ("fractions_decimals", 1),
    "Ordering Fractions":                                 ("fractions_decimals", 1),
    "Converting Mixed Number and Improper Fractions":     ("fractions_decimals", 1),
    "Fractions of an Amount":                             ("fractions_decimals", 1),
    "Adding and Subtracting with Decimals":               ("fractions_decimals", 1),
    "Multiplying and Dividing with Decimals":             ("fractions_decimals", 1),
    "Ordering Decimals":                                  ("fractions_decimals", 1),
    "Converting between Decimals and Percentages":        ("fractions_decimals", 1),
    "Converting between Fractions and Decimals":          ("fractions_decimals", 1),
    "Converting between Fractions and Percentages":       ("fractions_decimals", 2),

    # ── RATIOS & PROPORTIONS ─────────────────────────────────────────────
    "Writing Ratios":                                     ("ratios_proportions", 1),
    "Sharing in a Ratio":                                 ("ratios_proportions", 1),
    "Percentages of an Amount":                           ("ratios_proportions", 1),
    "Percentage Increase and Decrease":                   ("ratios_proportions", 2),
    "Direct Proportion":                                  ("ratios_proportions", 2),
    "Indirect (Inverse) Proportion":                      ("ratios_proportions", 3),
    "Speed, Distance, Time":                              ("ratios_proportions", 2),
    "Length Scale Factors in Similar Shapes":             ("ratios_proportions", 2),

    # ── MEASUREMENT UNITS ────────────────────────────────────────────────
    "Length Units":                                       ("measurement_units", 1),
    "Weight Units":                                       ("measurement_units", 1),
    "Time":                                               ("measurement_units", 1),
    "Volume and Capacity Units":                          ("measurement_units", 1),
    "Area Units":                                         ("measurement_units", 1),

    # ── ALGEBRAIC MANIPULATION ───────────────────────────────────────────
    "Writing Expressions":                                ("algebraic_manipulation", 1),
    "Simplifying Expressions by Collecting Like Terms":   ("algebraic_manipulation", 1),
    "Expanding Single Brackets":                          ("algebraic_manipulation", 1),
    "Expanding Double Brackets":                          ("algebraic_manipulation", 2),
    "Expanding Triple Brackets and more":                 ("algebraic_manipulation", 3),
    "Multiplying Terms":                                  ("algebraic_manipulation", 1),
    "Substitution into Formula":                          ("algebraic_manipulation", 1),
    "Writing Formula":                                    ("algebraic_manipulation", 2),
    "Rearranging Formula and Equations":                  ("algebraic_manipulation", 2),
    "Simplifying Algebraic Fractions":                    ("algebraic_manipulation", 2),
    "Adding and Subtracting Algebraic Fractions":         ("algebraic_manipulation", 3),
    "Multiplying and Dividing Algebraic Fractions":       ("algebraic_manipulation", 3),
    "Difference of Two Squares":                          ("algebraic_manipulation", 2),

    # ── FACTORING POLYNOMIALS ────────────────────────────────────────────
    "Factorising into a Single Bracket":                  ("factoring_polynomials", 1),
    "Factorising into a Double Bracket":                  ("factoring_polynomials", 2),
    "Completing the Square":                              ("factoring_polynomials", 3),

    # ── LINEAR EQUATIONS ─────────────────────────────────────────────────
    "Linear Equations":                                   ("linear_equations", 2),
    "Horizontal and Vertical Lines":                      ("linear_equations", 1),
    "Finding the Equation of a Line":                     ("linear_equations", 2),
    "Finding the Gradient and Intercept of a Line from the Equation": ("linear_equations", 2),
    "Gradient as change in y over change in x":           ("linear_equations", 2),
    "Gradient Between Two Co-ordinates":                  ("linear_equations", 2),
    "Parallel Lines":                                     ("linear_equations", 2),
    "Perpendicular Lines":                                ("linear_equations", 3),
    "Co-ordinate Geometry with Straight Lines":           ("linear_equations", 3),
    "Straight Line Graphs-Others":                        ("linear_equations", 2),
    "Distance Between Two Co-ordinates":                  ("linear_equations", 1),
    "Midpoint Between Two Co-ordinates":                  ("linear_equations", 1),

    # ── LINEAR INEQUALITIES ──────────────────────────────────────────────
    "Solving Linear Inequalities":                        ("linear_inequalities", 2),
    "Solving Quadratic Inequalities":                     ("linear_inequalities", 3),
    "Quadratic inequalities on Number Lines":             ("linear_inequalities", 3),

    # ── SYSTEMS OF LINEAR EQUATIONS ──────────────────────────────────────
    "Simultaneous Equations":                             ("systems_of_linear_equations", 2),

    # ── QUADRATIC EQUATIONS ──────────────────────────────────────────────
    "Quadratic Equations":                                ("quadratic_equations", 2),
    "Sketching from Factorised Form":                     ("quadratic_equations", 2),
    "Sketching from Completing the Square Form":          ("quadratic_equations", 3),
    "Quadratic Sequences":                                ("sequences_series", 3),
    "Quadratic Graphs-Others":                            ("quadratic_equations", 3),

    # ── SEQUENCES & SERIES ───────────────────────────────────────────────
    "Linear Sequences (nth term)":                        ("sequences_series", 2),
    "Other Sequences":                                    ("sequences_series", 2),
    "Sequences-Others":                                   ("sequences_series", 2),

    # ── FUNCTIONS BASICS ─────────────────────────────────────────────────
    "Function Machines":                                  ("functions_basics", 1),
    "Transformations of functions in the form f(x)":      ("functions_basics", 3),
    "Cubics and Reciprocals":                             ("functions_basics", 3),

    # ── EXPONENTIAL FUNCTIONS ────────────────────────────────────────────
    "Graphs of Exponentials and Other Powers of x":       ("exponential_functions", 3),

    # ── COORDINATE GEOMETRY (map to linear_equations - closest ACT concept)
    "Naming Co-ordinates in 2D":                          ("linear_equations", 1),
    "Plotting Lines from Tables of Values":               ("linear_equations", 1),
    "Plotting Quadratics from Tables of Values":          ("quadratic_equations", 2),

    # ── RIGHT TRIANGLE GEOMETRY ──────────────────────────────────────────
    "2D Pythagoras":                                      ("right_triangle_geometry", 2),
    "Right-angled Triangles (SOHCAHTOA)":                ("trigonometry_basics", 2),
    "Exact Values of Trigonometric Ratios":               ("trigonometry_basics", 3),
    "Missing Lengths":                                    ("right_triangle_geometry", 2),

    # ── TRIANGLES & CONGRUENCE ───────────────────────────────────────────
    "Properties of Triangles":                           ("triangles_congruence", 1),
    "Properties of Quadrilaterals":                      ("triangles_congruence", 1),
    "Properties of Polygons":                            ("triangles_congruence", 2),
    "Congruency in Other Shapes":                        ("triangles_congruence", 2),
    "Angles in Triangles":                               ("triangles_congruence", 1),
    "Angles in Polygons":                                ("triangles_congruence", 2),
    "Types, Naming and Estimating":                      ("triangles_congruence", 1),

    # ── LINES & ANGLES ───────────────────────────────────────────────────
    "Basic Angle Facts (straight line, opposite, around a point, etc)": ("lines_angles", 1),
    "Angle Facts with Parallel Lines":                   ("lines_angles", 2),
    "Measuring Angles":                                  ("lines_angles", 1),

    # ── CIRCLES GEOMETRY ─────────────────────────────────────────────────
    "Parts of a Circle":                                 ("circles_geometry", 1),
    "Equation of a Circle":                              ("circles_geometry", 3),

    # ── AREA & VOLUME ────────────────────────────────────────────────────
    "Area of Simple Shapes":                             ("area_volume", 1),
    "Compound Area":                                     ("area_volume", 2),
    "Perimeter":                                         ("area_volume", 1),
    "Volume of Prisms":                                  ("area_volume", 2),
    "Volume of Non-Prisms":                              ("area_volume", 3),
    "Surface Area of Prisms":                            ("area_volume", 2),

    # ── DESCRIPTIVE STATISTICS ───────────────────────────────────────────
    "Averages (mean, median, mode) from a List of Data": ("descriptive_statistics", 1),
    "Averages and Range from Frequency Table":           ("descriptive_statistics", 2),
    "Averages and Range from Grouped Data":              ("descriptive_statistics", 3),
    "Range and Interquartile Range from a List of Data": ("descriptive_statistics", 1),
    "Frequency tables":                                  ("descriptive_statistics", 1),
    "Types of Data and Questionnaires":                  ("descriptive_statistics", 1),

    # ── BASIC PROBABILITY ────────────────────────────────────────────────
    "Probability of Single Events":                      ("basic_probability", 1),
    "Combined Events":                                   ("basic_probability", 2),
    "Experimental Probability and Relative Frequency":   ("basic_probability", 2),
    "Systematic Listing Strategies":                     ("basic_probability", 2),

    # ── RATIONAL EXPRESSIONS ─────────────────────────────────────────────
    "Algebraic Proof":                                   ("EXCLUDE", 0),

    # ── GEOMETRIC TRANSFORMATIONS (almost all diagram-dependent) ─────────
    "Reflection":                                        ("EXCLUDE", 0),
    "Rotation":                                          ("EXCLUDE", 0),
    "Translation and Vectors":                           ("EXCLUDE", 0),
    "Enlargement":                                       ("EXCLUDE", 0),
    "Line Symmetry":                                     ("EXCLUDE", 0),
    "Rotational Symmetry":                               ("EXCLUDE", 0),
    "Length, Area and Volume Scale Factors":             ("triangles_congruence", 3),

    # ── DIAGRAM-ONLY SUBJECTS ─────────────────────────────────────────────
    "Real Life Graphs":                                  ("EXCLUDE", 0),
    "Time Series and Line Graphs":                       ("EXCLUDE", 0),
    "Block Graphs and Bar Charts":                       ("EXCLUDE", 0),
    "Pictogram":                                         ("EXCLUDE", 0),
    "Pie Chart":                                         ("EXCLUDE", 0),
    "Venn Diagrams":                                     ("EXCLUDE", 0),
    "Tree Diagrams with Dependent Events":               ("EXCLUDE", 0),
    "Nets":                                              ("EXCLUDE", 0),
    "Graphical Solution of Simultaneous Equations":      ("EXCLUDE", 0),
    "Graphing Linear Inequalities (Shading Regions)":    ("EXCLUDE", 0),
    "Inequalities on Number Lines":                      ("EXCLUDE", 0),

    # ── NO ACT EQUIVALENT ────────────────────────────────────────────────
    "Bearings":                                          ("EXCLUDE", 0),
    "Construct Angle":                                   ("EXCLUDE", 0),
    "Construct Triangle":                                ("EXCLUDE", 0),
    "Trial and Improvement and Iterative Methods":       ("EXCLUDE", 0),
    "2D Names and Properties of Shapes-Others":          ("EXCLUDE", 0),
    "Names and Properties of 3D Shapes":                 ("EXCLUDE", 0),
    "Other Graphs-Others":                               ("EXCLUDE", 0),
    "Quadratic Graphs-Others":                           ("quadratic_equations", 3),
}

# ── Subjects that may have visual-deictic language but aren't always diagrams
# These survive R2 text filter; don't pre-exclude them.
HIGH_ATTRITION_SUBJECTS = {
    "Basic Angle Facts (straight line, opposite, around a point, etc)",
    "Angle Facts with Parallel Lines",
    "Angles in Triangles",
    "Angles in Polygons",
    "Measuring Angles",
    "Properties of Triangles",
    "Properties of Quadrilaterals",
    "Properties of Polygons",
    "Area of Simple Shapes",
    "Compound Area",
    "Perimeter",
    "Parts of a Circle",
}

# ── Diagram-deictic regex ────────────────────────────────────────────────────
DIAGRAM_RE = re.compile(
    r'\b(diagram|the image|picture|shown (below|above)|as shown|the shape\b|'
    r'the graph\b|on the grid|in the grid|the grid\b|the spinner|the scale\b|'
    r'number line (below|above)|shaded (region|area|shape)|'
    r'which (of these )?(shapes|graphs|diagrams|lines)\b|'
    r'the figure\b|drawn below|the arrow|draw (the|a )|mark (the|a )|'
    r'reflect|rotate|translate|enlarge|the image below|'
    r'bar chart|histogram|stem.?and.?leaf|scatter (graph|plot)|'
    r'venn diagram|tree diagram|the table below)\b',
    re.I,
)

# ── LaTeX → plain text translator ────────────────────────────────────────────
LATEX_SUBS = [
    (re.compile(r'\\left\s*\('), '('),
    (re.compile(r'\\right\s*\)'), ')'),
    (re.compile(r'\\left\s*\['), '['),
    (re.compile(r'\\right\s*\]'), ']'),
    (re.compile(r'\\left\s*\{'), '{'),
    (re.compile(r'\\right\s*\}'), '}'),
    (re.compile(r'\\\['), ''),
    (re.compile(r'\\\]'), ''),
    (re.compile(r'\\\('), ''),
    (re.compile(r'\\\)'), ''),
    (re.compile(r'\\frac\{([^}]+)\}\{([^}]+)\}'), r'\1/\2'),
    (re.compile(r'\\dfrac\{([^}]+)\}\{([^}]+)\}'), r'\1/\2'),
    (re.compile(r'\\sqrt\{([^}]+)\}'), r'√(\1)'),
    (re.compile(r'\\sqrt\b'), r'√'),
    (re.compile(r'\^{\s*(-?\d+)\s*}'), r'^\1'),
    (re.compile(r'_{\s*(-?\w+)\s*}'), r'_\1'),
    (re.compile(r'\\times\b'), '×'),
    (re.compile(r'\\div\b'), '÷'),
    (re.compile(r'\\pm\b'), '±'),
    (re.compile(r'\\leq?\b'), '≤'),
    (re.compile(r'\\geq?\b'), '≥'),
    (re.compile(r'\\neq\b'), '≠'),
    (re.compile(r'\\approx\b'), '≈'),
    (re.compile(r'\\circ\b'), '°'),
    (re.compile(r'\\pi\b'), 'π'),
    (re.compile(r'\\%'), '%'),
    (re.compile(r'\\text\{([^}]+)\}'), r'\1'),
    (re.compile(r'\\textbf\{([^}]+)\}'), r'\1'),
    (re.compile(r'\\textit\{([^}]+)\}'), r'\1'),
    (re.compile(r'\\mathbf\{([^}]+)\}'), r'\1'),
    (re.compile(r'\\mathrm\{([^}]+)\}'), r'\1'),
    (re.compile(r'\\mathit\{([^}]+)\}'), r'\1'),
    (re.compile(r'\\ldots\b'), '...'),
    (re.compile(r'\\cdots\b'), '...'),
    (re.compile(r'\\cdot\b'), '·'),
    (re.compile(r'\\!'), ''),
    (re.compile(r'\\,'), ' '),
    (re.compile(r'\\;'), ' '),
    (re.compile(r'\\quad\b'), '  '),
    (re.compile(r'\\qquad\b'), '   '),
    (re.compile(r'\{([^{}]+)\}'), r'\1'),  # strip remaining bare braces
    (re.compile(r'~'), ' '),  # LaTeX non-breaking space
    (re.compile(r'\s{2,}'), ' '),
    (re.compile(r'^\s+|\s+$'), ''),
]

RESIDUAL_LATEX_RE = re.compile(r'\\[a-zA-Z]+')

UK_SUBS = [
    ('£', '$'),
    (' metres', ' meters'),
    (' metre', ' meter'),
    (' litres', ' liters'),
    (' litre', ' liter'),
    ('colour', 'color'),
    ('maths', 'math'),
    ('kilometre', 'kilometer'),
]


def translate_latex(text: str) -> Optional[str]:
    """Convert LaTeX to plain text. Returns None if residual LaTeX remains."""
    if pd.isna(text):
        return None
    s = str(text)
    for pattern, repl in LATEX_SUBS:
        s = pattern.sub(repl, s)
    if RESIDUAL_LATEX_RE.search(s):
        return None  # untranslatable
    return s.strip()


def uk_localize(text: str) -> str:
    for uk, us in UK_SUBS:
        text = text.replace(uk, us)
    return text


def assign_format(question: str, answers: list[str]) -> str:
    all_text = ' '.join([question] + answers)
    if re.search(r'\btable\b|\brow\b.*\bcolumn\b|\|.*\|', all_text, re.I):
        return 'table'
    # word problem: narrative context with scenario
    if len(question) > 120 and re.search(
        r'\b(buys?|sells?|travels?|costs?|each|per\b|earns?|shares?|spends?|'
        r'has\b|have\b|gives?|takes?|needs?|plans?|makes?)\b',
        question, re.I,
    ):
        return 'word_problem'
    return 'symbolic_expression'


def level_bump(level: int, question: str) -> int:
    """Bump level if multi-step word problem."""
    if level < 3 and len(question) > 220 and assign_format(question, []) == 'word_problem':
        return level + 1
    return level


def slug(text: str, max_tokens: int = 5) -> str:
    stopwords = {'the', 'a', 'an', 'of', 'to', 'when', 'that', 'in', 'is', 'as', 'at', 'by', 'it'}
    words = re.sub(r'[^a-z0-9\s]', '', text.lower()).split()
    tokens = [w for w in words if w not in stopwords][:max_tokens]
    return '_'.join(tokens) or 'unknown'


def mint_misconception_id(concept_id: str, name: str) -> str:
    return f"mis_{concept_id}__{slug(name)}"


def build_explanation_template(question: str, choices: list[str], correct_idx: int,
                               construct: str, misconception_name: Optional[str]) -> str:
    correct = choices[correct_idx]
    lines = [f"The correct answer is {correct}."]
    if misconception_name:
        lines.append(f"A common mistake here: {misconception_name.rstrip('.')}.  "
                     f"Double-check each step in {construct.lower()} to avoid this error.")
    else:
        lines.append(f"Review the key steps for {construct.lower()} to confirm your reasoning.")
    return " ".join(lines)


def build_hints(construct: str) -> list[str]:
    return [
        f"Re-read the question carefully — what is it specifically asking you to find?",
        f"Think about the key property of {construct.lower()} that applies here.",
        f"Set up the calculation step by step before combining terms.",
    ]


# ---------------------------------------------------------------------------
# LLM explanation (Groq, optional)
# ---------------------------------------------------------------------------

def try_groq_explanation(
    question: str, choices: list[str], correct_idx: int,
    construct: str, misconception_name: Optional[str],
    cache: dict, cache_key: str,
) -> tuple[str, list[str], bool]:
    """Returns (explanation, hints, used_llm)."""
    if cache_key in cache:
        cached = cache[cache_key]
        return cached['explanation'], cached['hints'], True

    try:
        import groq  # type: ignore
        client = groq.Groq(api_key=os.environ.get('GROQ_API_KEY', ''))
        correct = choices[correct_idx]
        wrong = [f"{chr(65+i)}. {c}" for i, c in enumerate(choices) if i != correct_idx]
        misc_note = (f"\nThe most common mistake for wrong answers: {misconception_name}"
                     if misconception_name else "")

        prompt = (
            f"Math question ({construct}):\n{question}\n\n"
            f"Choices:\n" + "\n".join(f"{chr(65+i)}. {c}" for i, c in enumerate(choices)) +
            f"\n\nCorrect answer: {correct}{misc_note}\n\n"
            "Reply with ONLY valid JSON: "
            '{\"explanation\": \"2-3 sentence clear solution walkthrough that ends by naming the correct answer. '
            'If there is a common mistake, briefly say why it is wrong.\", '
            '\"hints\": [\"strategy nudge\", \"first concrete step\", \"setup without giving the answer\"]}'
        )

        r = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.3, max_tokens=400,
        )
        raw = r.choices[0].message.content.strip()
        data = json.loads(raw)
        explanation = data.get('explanation', '')
        hints = data.get('hints', [])[:3]

        # Verify the explanation doesn't claim a wrong answer is correct
        for i, c in enumerate(choices):
            if i != correct_idx and c.lower() in explanation.lower() and correct.lower() not in explanation.lower():
                raise ValueError("LLM explanation may reference wrong answer as correct")

        cache[cache_key] = {'explanation': explanation, 'hints': hints}
        return explanation, hints, True

    except Exception:
        return '', [], False


# ---------------------------------------------------------------------------
# Main ingestion
# ---------------------------------------------------------------------------

def ingest(
    train_path: str,
    mapping_path: str,
    out_questions: str,
    out_misconceptions: str,
    report_path: str,
    use_llm: bool = True,
    dry_run: bool = False,
    concept_filter: Optional[set[str]] = None,
    limit: Optional[int] = None,
):
    train = pd.read_csv(train_path)
    misc_df = pd.read_csv(mapping_path)
    misc_lookup: dict[int, str] = dict(zip(misc_df['MisconceptionId'], misc_df['MisconceptionName']))

    explain_cache_path = Path(train_path).parent / '.explain_cache.json'
    explain_cache: dict = {}
    if explain_cache_path.exists():
        with open(explain_cache_path) as f:
            explain_cache = json.load(f)

    if limit:
        train = train.head(limit)

    questions: list[dict] = []
    misconceptions: dict[str, dict] = {}  # keyed by minted ID
    rejects: list[dict] = []

    def reject(row, code: str):
        rejects.append({'questionId': int(row.QuestionId), 'reason': code,
                        'subject': row.SubjectName, 'construct': row.ConstructName,
                        'snippet': str(row.QuestionText)[:120]})

    for _, row in train.iterrows():
        qid = int(row.QuestionId)
        subject = row.SubjectName
        construct = row.ConstructName

        # R1 — concept mapping
        mapping = SUBJECT_MAP.get(subject)
        if mapping is None:
            reject(row, 'R1_no_mapping'); continue
        concept_id, default_level = mapping
        if concept_id == 'EXCLUDE':
            reject(row, 'R1_excluded'); continue
        if concept_filter and concept_id not in concept_filter:
            reject(row, 'R1_concept_filter'); continue

        # Collect misconception IDs from this row (for enrichment, even if question is rejected)
        for col in ['MisconceptionAId', 'MisconceptionBId', 'MisconceptionCId', 'MisconceptionDId']:
            mid_val = row.get(col)
            if pd.notna(mid_val):
                mid = int(mid_val)
                name = misc_lookup.get(mid, '')
                if name:
                    minted = mint_misconception_id(concept_id, name)
                    if minted not in misconceptions:
                        misconceptions[minted] = {
                            'eedi_misconception_id': mid,
                            'eedi_name': name,
                            'concept_ids': [concept_id],
                            'occurrence_count': 0,
                            'example_question_ids': [],
                        }
                    misconceptions[minted]['occurrence_count'] += 1
                    if len(misconceptions[minted]['example_question_ids']) < 3:
                        misconceptions[minted]['example_question_ids'].append(f'eedi_{qid}')

        # R2 — diagram detection (question text + answers)
        all_text = ' '.join(str(x) for x in [
            row.QuestionText, row.AnswerAText, row.AnswerBText,
            row.AnswerCText, row.AnswerDText,
        ] if pd.notna(x))

        # Catch markdown image syntax and explicit image markers
        if re.search(r'!\[|\\includegraphics|\[image\]|\[img\]', all_text, re.I):
            reject(row, 'R2_diagram'); continue
        if DIAGRAM_RE.search(all_text):
            reject(row, 'R2_diagram'); continue

        # R3 — structural validity
        answers_raw = [row.AnswerAText, row.AnswerBText, row.AnswerCText, row.AnswerDText]
        if any(pd.isna(a) for a in answers_raw):
            reject(row, 'R3_missing_answer'); continue
        if str(row.CorrectAnswer).strip() not in {'A', 'B', 'C', 'D'}:
            reject(row, 'R3_bad_correct'); continue
        if len(str(row.QuestionText)) < 15:
            reject(row, 'R3_too_short'); continue

        # R4 — LaTeX translation
        q_plain = translate_latex(str(row.QuestionText))
        if q_plain is None:
            reject(row, 'R4_latex_fail'); continue

        choices_plain = [translate_latex(str(a)) for a in answers_raw]
        if any(c is None for c in choices_plain):
            reject(row, 'R4_answer_latex_fail'); continue

        # Normalize whitespace in choices (strip newlines/tabs)
        choices_plain = [re.sub(r'\s+', ' ', c).strip() for c in choices_plain]

        # R4 structural — dedup choices
        norm_choices = [c.strip().lower() for c in choices_plain]
        correct_idx = {'A': 0, 'B': 1, 'C': 2, 'D': 3}[str(row.CorrectAnswer).strip()]
        correct_norm = norm_choices[correct_idx]
        if sum(1 for c in norm_choices if c == correct_norm) > 1:
            reject(row, 'R4_duplicate_correct'); continue

        # R5 — UK localization
        q_plain = uk_localize(q_plain)
        choices_plain = [uk_localize(c) for c in choices_plain]

        # Level + format
        fmt = assign_format(q_plain, choices_plain)
        level = level_bump(default_level, q_plain)

        # Explanation + hints
        # Get the most common misconception for a wrong answer (not the correct one)
        misc_name = None
        for i, col in enumerate(['MisconceptionAId', 'MisconceptionBId',
                                  'MisconceptionCId', 'MisconceptionDId']):
            if i == correct_idx:
                continue
            mid_val = row.get(col)
            if pd.notna(mid_val):
                misc_name = misc_lookup.get(int(mid_val), None)
                if misc_name:
                    break

        cache_key = hashlib.sha256(f"{qid}:{q_plain}".encode()).hexdigest()[:16]
        explanation = ''
        hints: list[str] = []

        if use_llm and not dry_run:
            explanation, hints, used_llm = try_groq_explanation(
                q_plain, choices_plain, correct_idx, construct, misc_name,
                explain_cache, cache_key,
            )

        if not explanation:
            explanation = build_explanation_template(q_plain, choices_plain, correct_idx,
                                                     construct, misc_name)
        if not hints:
            hints = build_hints(construct)

        questions.append({
            'id': f'eedi_{qid}',
            'conceptId': concept_id,
            'level': level,
            'question': q_plain,
            'choices': choices_plain,
            'correctIndex': correct_idx,
            'explanation': explanation,
            'hints': hints,
            'examTag': 'GCSE',
            'format': fmt,
        })

    # ── Write outputs ────────────────────────────────────────────────────────
    if not dry_run:
        Path(out_questions).parent.mkdir(parents=True, exist_ok=True)
        with open(out_questions, 'w') as f:
            json.dump(questions, f, indent=2, ensure_ascii=False)

        Path(out_misconceptions).parent.mkdir(parents=True, exist_ok=True)
        with open(out_misconceptions, 'w') as f:
            json.dump(misconceptions, f, indent=2, ensure_ascii=False)

        Path(report_path).parent.mkdir(parents=True, exist_ok=True)
        report = _build_report(questions, rejects, misconceptions)
        with open(report_path, 'w') as f:
            json.dump(report, f, indent=2)

        if explain_cache:
            with open(explain_cache_path, 'w') as f:
                json.dump(explain_cache, f)

    report = _build_report(questions, rejects, misconceptions)
    _print_summary(report)

    return questions, misconceptions, rejects


def _build_report(questions, rejects, misconceptions):
    from collections import Counter

    reject_counts = Counter(r['reason'] for r in rejects)
    by_concept: dict[str, dict] = {}
    for q in questions:
        c = q['conceptId']
        if c not in by_concept:
            by_concept[c] = {'total': 0, 'by_level': {1: 0, 2: 0, 3: 0},
                              'by_format': {}}
        by_concept[c]['total'] += 1
        by_concept[c]['by_level'][q['level']] += 1
        fmt = q['format']
        by_concept[c]['by_format'][fmt] = by_concept[c]['by_format'].get(fmt, 0) + 1

    return {
        'total_input': len(questions) + len(rejects),
        'total_kept': len(questions),
        'total_rejected': len(rejects),
        'survival_rate': round(len(questions) / max(1, len(questions) + len(rejects)), 3),
        'reject_by_reason': dict(reject_counts),
        'kept_by_concept': by_concept,
        'misconceptions_minted': len(misconceptions),
        'top_misconceptions': sorted(
            [{'id': k, 'name': v['eedi_name'], 'count': v['occurrence_count']}
             for k, v in misconceptions.items()],
            key=lambda x: -x['count'],
        )[:20],
    }


def _print_summary(report):
    print(f"\n{'='*60}")
    print(f"Eedi Ingestion Summary")
    print(f"{'='*60}")
    print(f"  Input:    {report['total_input']:,}")
    print(f"  Kept:     {report['total_kept']:,}  ({report['survival_rate']:.1%})")
    print(f"  Rejected: {report['total_rejected']:,}")
    print(f"\nReject reasons:")
    for reason, n in sorted(report['reject_by_reason'].items(), key=lambda x: -x[1]):
        print(f"  {reason:<35} {n:4d}")
    print(f"\nKept by concept (top 15):")
    top = sorted(report['kept_by_concept'].items(), key=lambda x: -x[1]['total'])[:15]
    for concept, data in top:
        lvls = f"L1={data['by_level'][1]} L2={data['by_level'][2]} L3={data['by_level'][3]}"
        print(f"  {concept:<40} {data['total']:4d}  {lvls}")
    print(f"\nMisconceptions minted: {report['misconceptions_minted']:,}")
    print(f"Top misconceptions:")
    for m in report['top_misconceptions'][:10]:
        print(f"  [{m['count']:3d}x] {m['name'][:70]}")


# ---------------------------------------------------------------------------

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Ingest Eedi questions into MindCraft bank')
    parser.add_argument('--train', default='data/eedi/train.csv')
    parser.add_argument('--mapping', default='data/eedi/misconception_mapping.csv')
    parser.add_argument('--out-questions', default='app/src/data/eediQuestions.json')
    parser.add_argument('--out-misconceptions', default='ml/data/eedi_misconceptions.json')
    parser.add_argument('--report', default='data/eedi/ingest_report.json')
    parser.add_argument('--no-llm', action='store_true', help='Skip Groq explanation generation')
    parser.add_argument('--dry-run', action='store_true', help='Print summary only, write nothing')
    parser.add_argument('--concepts', help='Comma-separated concept IDs to filter to')
    parser.add_argument('--limit', type=int, help='Limit to first N input rows')
    args = parser.parse_args()

    concept_filter = set(args.concepts.split(',')) if args.concepts else None

    ingest(
        train_path=args.train,
        mapping_path=args.mapping,
        out_questions=args.out_questions,
        out_misconceptions=args.out_misconceptions,
        report_path=args.report,
        use_llm=not args.no_llm,
        dry_run=args.dry_run,
        concept_filter=concept_filter,
        limit=args.limit,
    )
