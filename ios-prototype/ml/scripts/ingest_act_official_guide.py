#!/usr/bin/env python3
"""
Official ACT Prep Guide (2025-2026) -> MindCraft question bank ingestion.

Akshat's own purchased copy of "The Official ACT Prep Guide 2025-2026" has
NO embedded text layer on its practice-test question pages (they are scanned
raster images) -- only the "Explanatory Answers" sections carry a real text
layer. This script therefore:

  1. OCRs the math-test question pages (Tesseract via pytesseract), cropped
     to exclude the "DO YOUR FIGURING HERE" scratch-work sidebar (its text
     otherwise interleaves mid-sentence with the question stem via OCR
     reading order).
  2. Parses OCR text into individual questions (stem + lettered choices;
     ACT alternates A-D for odd-numbered questions, F-H/J for even-numbered).
  3. Cross-checks each question's correct answer against the REAL text layer
     of the book's own "Explanatory Answers" section (regex on
     "Question N. The correct answer is X.") -- this is the reliable ground
     truth for correctIndex, never the OCR'd question page itself.
  4. Rejects anything diagram/table/matrix/graph-dependent (can't be
     reliably OCR'd or rendered), anything OCR-garbled, and anything where
     the extracted choices don't include the book's stated correct letter.
  5. Writes a FRESH short explanation per kept question via the shared Groq
     LLM client (ml/generation/llm_client.py) -- never the book's own
     explanatory-answer prose -- and classifies each into a canonical
     ontology conceptId + level (1-3).
  6. Emits app/src/data/actOfficialGuideQuestions.generated.json (same
     Question shape as actMasterQuestionBank.generated.json) plus an ingest
     report (kept/rejected counts + reasons) for auditability, mirroring
     ml/scripts/ingest_eedi.py's conventions.

Usage:
    python ml/scripts/ingest_act_official_guide.py \
        --pdf "/Users/akoirala/Downloads/The Official ACT Prep Guide 2025 - 2026.pdf" \
        --out-questions app/src/data/actOfficialGuideQuestions.generated.json \
        --report ml/data/act_official_guide/ingest_report.json

    # Dry run (OCR + parse + validate, no LLM calls, no files written):
    python ml/scripts/ingest_act_official_guide.py --pdf "..." --dry-run

    # Limit to one practice test for a pilot:
    python ml/scripts/ingest_act_official_guide.py --pdf "..." --tests 1
"""

from __future__ import annotations

import argparse
import io
import json
import os
import re
import sys
import time
from pathlib import Path
from typing import Optional

import fitz  # pymupdf
import pytesseract
from PIL import Image
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FutureTimeoutError

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from generation.llm_client import complete  # noqa: E402


def _load_env_local() -> None:
    """Load ml/.env.local (KEY=VALUE) into os.environ -- same convention as
    ml/generation/run.py and several other scripts in this repo. Without
    this, GROQ_API_KEY is never set when the script runs standalone (it's
    not exported in the shell), llm_client._groq() raises a bare KeyError
    on `os.environ["GROQ_API_KEY"]`, and every classify_and_explain() call
    silently fails via the broad `except Exception: return None` -- verified
    root cause of an initial 0/180 kept run (all 70 LLM-reachable candidates
    failed with R7_llm_classify_failed)."""
    p = Path(__file__).resolve().parent.parent / ".env.local"
    if not p.exists():
        return
    for line in p.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))


_load_env_local()

# ---------------------------------------------------------------------------
# Book structure (verified against the actual PDF's table of contents +
# section-header text/OCR scan -- NOT assumed). All pages 1-indexed to match
# the PDF viewer / TOC. This is the Enhanced ACT format used in this edition:
# 45 math questions, 50 minutes, 4 choices per question (A-D / F-H-J), not
# the legacy 60-question/5-choice format.
# ---------------------------------------------------------------------------
MATH_SECTIONS = [
    # test_number, question pages (inclusive), explanatory-answer pages (inclusive)
    {"test": 1, "q_lo": 82, "q_hi": 93, "expl_lo": 147, "expl_hi": 156},
    {"test": 2, "q_lo": 363, "q_hi": 374, "expl_lo": 424, "expl_hi": 438},
    {"test": 3, "q_lo": 488, "q_hi": 499, "expl_lo": 550, "expl_hi": 565},
    {"test": 4, "q_lo": 614, "q_hi": 625, "expl_lo": 674, "expl_hi": 688},
]
QUESTIONS_PER_TEST = 45

ODD_LETTERS = ["A", "B", "C", "D"]
EVEN_LETTERS = ["F", "G", "H", "J"]

# ---------------------------------------------------------------------------
# Diagram / table / matrix / graph dependence -- can't be reliably OCR'd or
# rendered without the source image, so these are excluded (same discipline
# as ingest_eedi.py's DIAGRAM_RE, tuned for ACT math phrasing + this book's
# observed constructs: Venn diagrams, spinner tables, matrices, coordinate
# planes, number lines).
# ---------------------------------------------------------------------------
VISUAL_DEPENDENCE_RE = re.compile(
    r'\b(shown in (the |this )?(table|figure|diagram|graph)|'
    r'the table (below|above|shown)|in this table|in the table|'
    r'shown below|shown above|the figure (below|above|shown)|'
    r'in the figure\b|'  # "In the figure, ∠BAC measures..." (no below/above/shown suffix)
    r'the diagram (below|above|shown)|the graph (below|above|shown)|'
    r'the grid (below|above|shown)|coordinate plane shown|'
    r'venn diagram|the spinner|number line (below|above|shown)|'
    r'matrix|matrices|the model shown|represented in the diagram|'
    r'circles? [A-Z](, [A-Z])*,? and [A-Z]|which of the following graphs|'
    r'which of the following figures|the image (below|above|shown)|'
    # Bare "shown" anywhere. Verified false-negative case: "triangle AABC
    # shown" (△ABC misread as "AABC" by OCR) doesn't match a strict
    # noun+shown adjacency pattern, but in ACT math phrasing "shown" is
    # essentially never used except to point at an accompanying figure --
    # simpler and more robust to just treat the bare word as the signal.
    r'\bshown\b)\b',
    re.I,
)

# Header/footer OCR artifacts (triangle-row watermark, page directives) --
# never real question content. Real prose always contains lowercase letters;
# these lines don't.
NOISE_LINE_RE = re.compile(
    r'^(GO ON TO THE NEXT PAGE\.?|STOP!.*|END OF TEST \d+\.?|'
    r'DO YOUR FIGURING HERE\.?|DO NOT RETURN.*|'
    r'[\dA-Z\s.\-]{1,30})$'
)

SIDEBAR_BLEED_RE = re.compile(r'\s*DO YOU(R FIGURING HERE\.?)?\s*$', re.I)

# ---------------------------------------------------------------------------
# OCR
# ---------------------------------------------------------------------------

def render_and_crop(doc: "fitz.Document", page_no_0idx: int, dpi: int = 300) -> Image.Image:
    """Render a page and crop out the right-hand 'DO YOUR FIGURING HERE'
    scratch-work sidebar so its text can't interleave with the question
    column via OCR reading order. Falls back to a fixed 58% width crop if
    the sidebar label isn't found on this page."""
    page = doc[page_no_0idx]
    pix = page.get_pixmap(dpi=dpi)
    img = Image.open(io.BytesIO(pix.tobytes("png")))
    data = pytesseract.image_to_data(img, output_type=pytesseract.Output.DICT)
    xs = [data['left'][i] for i, w in enumerate(data['text']) if 'FIGURING' in w.upper()]
    crop_x = (min(xs) - 40) if xs else int(img.width * 0.58)
    crop_x = max(crop_x, int(img.width * 0.3))  # sanity floor
    return img.crop((0, 0, crop_x, img.height))


def ocr_question_pages(pdf_path: str, q_lo: int, q_hi: int, dpi: int = 300) -> str:
    # --psm 4 ("assume a single column of variable-sized text") measurably
    # beats the default --psm 3 on this book's single-column question layout:
    # it recovers leading question-number digits that psm 3 systematically
    # drops before the period on several multi-digit questions per test
    # (verified: psm 3 found 29/45 numbers on a pilot page range, psm 4 found
    # 44/45 -- the only gap was a single "15," where OCR misread the period
    # as a comma, handled separately in QUESTION_START_RE below).
    doc = fitz.open(pdf_path)
    chunks = []
    for p in range(q_lo, q_hi + 1):
        img = render_and_crop(doc, p - 1, dpi=dpi)
        txt = pytesseract.image_to_string(img, config="--psm 4")
        chunks.append(txt)
    doc.close()
    return "\n".join(chunks)


# Fixed boilerplate "Note: Unless otherwise stated..." directions block that
# appears once per test, right after question 1-2, with its own internal
# numbered list (1-4: "Illustrative figures...", "Geometric figures...",
# "The word 'line'...", "The word 'average'...") that COLLIDES with real
# question numbers 1-4 during splitting. The sidebar crop sometimes truncates
# this block mid-sentence, so match by line-content signature (robust to
# truncation) rather than requiring the whole block to be intact.
BOILERPLATE_NOTE_LINE_RE = re.compile(
    r'^\s*(Note:?\s*Unless otherwise|DIRECTIONS:|Do not linger|'
    r'You are permitted to use a calculator|but some of the problems|'
    r'[1-4]\.\s*(Illustrative figures|Geometric figures|The word))',
    re.I,
)


def clean_ocr_text(raw: str) -> str:
    raw = "\n".join(
        line for line in raw.split("\n") if not BOILERPLATE_NOTE_LINE_RE.match(line)
    )
    lines = raw.split("\n")
    out = []
    for line in lines:
        stripped = line.strip()
        if not stripped:
            out.append("")
            continue
        # Drop sidebar bleed fragments at line end.
        stripped = SIDEBAR_BLEED_RE.sub("", stripped).rstrip()
        if not stripped:
            continue
        # Drop pure header/footer noise lines (no lowercase letters at all,
        # short) unless they're a real question/choice start.
        if not re.search(r'[a-z]', stripped) and not re.match(r'^\d{1,2}\.|^[A-DFGHJ]\.', stripped):
            if len(stripped) < 40:
                continue
        out.append(stripped)
    return "\n".join(out)


# ---------------------------------------------------------------------------
# Parsing OCR'd question text into structured question records
# ---------------------------------------------------------------------------

# Accept ',' as well as '.' after the question number -- OCR occasionally
# misreads the period as a comma (verified on question 15 of test 1: OCR
# produced "15, Which of the following..."). BUT that comma-tolerance
# introduced its own real bug (verified on test 3 Q4): a thousands-separator
# comma inside an ordinary number wrapped to a line start, e.g. "7,000
# mileage points...", matches "\n7," and gets mistaken for question 7's
# start, truncating whatever question was still accumulating. A real
# question stem always begins with a capital letter right after the
# number+punctuation+space; "000" (or any digit) never does, so requiring
# that lookahead disambiguates the two without losing the comma-typo fix.
QUESTION_START_RE = re.compile(r'\n(\d{1,2})[.,]\s*(?=[A-Z])')


def split_questions(text: str) -> dict[int, str]:
    """Split cleaned OCR text into {question_number: raw_chunk}.

    Real question numbers appear STRICTLY in sequence 1, 2, 3, ..., 45 in the
    document. OCR garbage inside garbled math (matrix brackets, mangled
    fractions) occasionally produces a spurious "N." that coincidentally
    matches a real question number that already occurred -- verified: a
    stray "5. [2" fragment inside test 1's Q6 matrix-choice garbage
    corrupted the real, cleanly-OCR'd Q5 chunk when a naive "last match
    wins" merge was used. Matching only the EXPECTED sequential number (or
    a small forward jump past it) makes spurious backward/duplicate matches
    inert without needing to guess after the fact which match was real.

    A pure "must equal expected exactly" version has its own bug (also
    verified): if OCR drops a number entirely (test 4's "28" was read as a
    bare "2", a dropped leading digit -- the same failure mode as the note-
    block collision, just on a different question), `expected` never
    advances and EVERY later question in that test is silently lost too,
    not just the one bad question. So: a match strictly greater than
    `expected` but within a small lookahead window is accepted as a forward
    jump (the skipped number(s) are logged as genuine R1 gaps, not a
    cascade failure); a match less than `expected` is a stale spurious
    hit and is ignored; a jump larger than the window is treated as
    garbage-number noise, also ignored.
    """
    text = "\n" + text  # ensure leading boundary matches
    matches = list(QUESTION_START_RE.finditer(text))
    confirmed: list[tuple[int, int, int]] = []  # (qnum, content_start, match_start)
    expected = 1
    FORWARD_JUMP_WINDOW = 4
    for m in matches:
        qnum = int(m.group(1))
        if qnum < expected or qnum > QUESTIONS_PER_TEST:
            continue  # stale/backward or out-of-range: spurious, ignore
        if qnum - expected > FORWARD_JUMP_WINDOW:
            continue  # too big a jump to trust: likely garbage number, ignore
        confirmed.append((qnum, m.end(), m.start()))
        expected = qnum + 1
    out: dict[int, str] = {}
    for i, (qnum, content_start, _match_start) in enumerate(confirmed):
        end = confirmed[i + 1][2] if i + 1 < len(confirmed) else len(text)
        out[qnum] = text[content_start:end].strip()
    return out


def extract_choices(chunk: str, letters: list[str]) -> Optional[list[str]]:
    """Extract the 4 lettered choices from a question chunk. Returns None if
    not all 4 letters are found in order.

    Tolerates two verified OCR artifacts:
      1. A stray lowercase duplicate of the choice letter before the period
         (e.g. "C. 25" read as "Cc. 25") -- the optional `[a-z]?` absorbs it.
      2. The whole letter itself downshifted to lowercase (e.g. "A. 13" read
         as "a. 13", "C. 23" read as "c. 23") -- matched case-insensitively,
         then normalized back to canonical uppercase for lookup.
    """
    letter_alt = '|'.join(letters)
    pattern = re.compile(
        r'\n?\b(' + letter_alt + r')[a-z]?\.\s+(.*?)(?=\n\s*(?:' +
        letter_alt + r')[a-z]?\.\s|\Z)',
        re.S | re.I,
    )
    found = pattern.findall(chunk)
    seen = {letter.upper(): val for letter, val in found}
    if not all(l in seen for l in letters):
        return None
    choices = []
    for l in letters:
        c = re.sub(r'\s+', ' ', seen[l]).strip()
        choices.append(c)
    return choices


def extract_stem(chunk: str, letters: list[str]) -> str:
    first_letter_m = re.search(r'\n\s*' + letters[0] + r'[a-z]?\.\s', chunk, re.I)
    stem_raw = chunk[:first_letter_m.start()] if first_letter_m else chunk
    return re.sub(r'\s+', ' ', stem_raw).strip()


# ---------------------------------------------------------------------------
# Explanatory-answers ground truth (real text layer -- reliable)
# ---------------------------------------------------------------------------

CORRECT_ANSWER_RE = re.compile(
    r'Question\s+(\d{1,2})\.\s+The correct answer is\s+([A-J])\.', re.I,
)


def extract_correct_answers(pdf_path: str, expl_lo: int, expl_hi: int) -> dict[int, str]:
    doc = fitz.open(pdf_path)
    text = ""
    for p in range(expl_lo, expl_hi + 1):
        text += doc[p - 1].get_text() + "\n"
    doc.close()
    out = {}
    for m in CORRECT_ANSWER_RE.finditer(text):
        qnum = int(m.group(1))
        letter = m.group(2).upper()
        if 1 <= qnum <= QUESTIONS_PER_TEST:
            out[qnum] = letter
    return out


# ---------------------------------------------------------------------------
# OCR-garbage / extraction-quality heuristics
# ---------------------------------------------------------------------------

def looks_garbled(text: str, min_length: int = 1) -> bool:
    # NOTE: min_length defaults to 1, not ~8. ACT math choices are routinely
    # very short and 100% legitimate ("54", "90", "5", "-3") -- verified bug:
    # an 8-char floor rejected clean single-number choices as "garbled" and
    # was single-handedly responsible for the majority of a 101/180 false
    # reject count on a full-book dry run. Callers checking a full sentence
    # (the question stem) should pass an explicit higher min_length.
    if len(text) < min_length:
        return True
    alnum = sum(1 for c in text if c.isalnum() or c.isspace() or c in '.,?!()-+/=%$°²³√π×÷≤≥ ')
    ratio = alnum / max(1, len(text))
    if ratio < 0.85:
        return True
    # Runs of 4+ consecutive non-word "junk" chars
    if re.search(r'[^\w\s.,?!()\-+/=%$°²³√π×÷≤≥]{4,}', text):
        return True
    # Radical-sign misread: Tesseract regularly reads '√' as a bare 'V' or
    # 'y' wedged directly between digits with no operator (verified example:
    # book choice "7√105" OCR'd as "7V105"; "6√105" OCR'd as "6y105"). A
    # content-looking-clean choice can still be numerically WRONG this way,
    # so this is a targeted semantic check, not just a charset check.
    if re.search(r'\d[Vy]\d', text):
        return True
    # Superscript-exponent misread: Tesseract frequently reads a superscript
    # digit as a bare '?' glued to the preceding variable/paren (verified:
    # "(x?-y")" for what the book prints as "(x²-y³)" -- this is the same
    # failure mode already fixed once in this bank for the ACT Master source,
    # see CLAUDE.md's exponent-notation audit). A trailing '?' at the very
    # end of the string is a real question mark; anything before is not.
    if re.search(r'[A-Za-z0-9\)]\?(?!\s*$)', text):
        return True
    # Superscript-exponent VANISHED entirely (not just misread): verified on
    # a spot-check sample -- "10*" for the book's "10^4", "(x + 1)* expanded"
    # for "(x + 1)^4 expanded". A bare '*' right after a digit or closing
    # paren, not immediately followed by another digit (which would be
    # ordinary "5*3" multiplication notation), is this failure signature.
    if re.search(r'[\)0-9]\*(?!\d)', text):
        return True
    # Vanished leading term: verified on a spot-check sample -- "equivalent
    # to = x-30?" for the book's "equivalent to x^2-x-30?" (the whole "x^2-x-"
    # left side disappeared, leaving a floating '=' with nothing before it).
    # A real English+math phrase never writes "to =" or "is =" with no left
    # operand, so this is a safe, specific signal something got deleted.
    if re.search(r'\b(to|is)\s*=', text, re.I):
        return True
    return False


def is_visual_dependent(stem: str, choices: list[str]) -> bool:
    full = stem + " " + " ".join(choices)
    return bool(VISUAL_DEPENDENCE_RE.search(full))


def has_bracket_matrix(stem: str, choices: list[str]) -> bool:
    full = stem + " " + " ".join(choices)
    return bool(re.search(r'\[[\-\d\s,]+\]', full))


# ---------------------------------------------------------------------------
# LLM: concept classification + fresh explanation (never book prose)
# ---------------------------------------------------------------------------

def load_concepts(ontology_path: str) -> list[dict]:
    with open(ontology_path) as f:
        d = json.load(f)
    return [{"id": c["id"], "name": c["name"]} for c in d.get("concepts", [])]


# Persistent executor (never shut down with wait=True) so a hung network
# call can be abandoned on a deadline instead of blocking the whole ingest
# run. The underlying llm_client._post has its own urllib timeout + retry
# backoff that can legitimately take minutes on repeated 429/500s; this is a
# harder outer deadline so ONE slow/stuck question can't stall the batch.
#
# VERIFIED REGRESSION (root cause, not a guess): an earlier 45s value here
# caused a run-to-run instability bug -- two back-to-back full runs on the
# same 180 candidates went from 4 LLM-classify failures to 28. llm_client's
# default retry policy (LLM_RETRIES=6, LLM_RETRY_BASE_SECONDS=2.0) backs off
# 2+4+8+16+32+64 = 126s of PURE SLEEP across retries on repeated 429s, before
# a single successful response comes back -- comfortably longer than the old
# 45s deadline. The second run, launched right after the first had already
# made ~70 Groq calls on the same API key, was far more likely to actually
# hit that rate-limit-retry path, so it lost far more calls to a timeout that
# was cutting off backoff sequences that would otherwise have succeeded.
# Fixed two ways: (1) this deadline is now comfortably longer than the
# worst-case legitimate backoff sum: (2) LLM_CALL_SLEEP_SECONDS below spaces
# calls out so a run is less likely to trigger the rate limit at all.
LLM_CALL_TIMEOUT_S = 170
os.environ.setdefault("LLM_CALL_SLEEP_SECONDS", "1.5")

_LLM_EXECUTOR = ThreadPoolExecutor(max_workers=4)


def call_with_hard_timeout(fn, timeout_s: float, *args, **kwargs):
    future = _LLM_EXECUTOR.submit(fn, *args, **kwargs)
    try:
        return future.result(timeout=timeout_s)
    except FutureTimeoutError:
        return None


CLASSIFY_SYSTEM = (
    "You are classifying ACT math questions into a fixed 42-concept math "
    "ontology and writing a short original explanation. You NEVER see or "
    "reproduce any textbook prose -- you derive your own reasoning from the "
    "question and the stated correct choice."
)


def classify_and_explain(
    stem: str, choices: list[str], letters: list[str], correct_letter: str,
    concepts: list[dict],
) -> Optional[dict]:
    correct_idx = letters.index(correct_letter)
    correct_text = choices[correct_idx]
    concept_list_str = "\n".join(f"- {c['id']}: {c['name']}" for c in concepts)
    lettered_choices = "\n".join(f"{l}. {c}" for l, c in zip(letters, choices))

    prompt = (
        f"ACT math question:\n{stem}\n\nChoices:\n{lettered_choices}\n\n"
        f"The correct choice is {correct_letter}. {correct_text}\n\n"
        f"Concept ontology (pick exactly one id):\n{concept_list_str}\n\n"
        "Reply with ONLY valid JSON, no markdown fences:\n"
        '{"conceptId": "<one id from the list above, exact match>", '
        '"level": <1, 2, or 3 -- 1=foundational direct application, '
        '2=applied/multi-step, 3=exam-hard/tests-multiple-ideas>, '
        '"explanation": "<1-3 sentences of PURE math reasoning in your own '
        'words, step-by-step, ending by naming the correct choice value. '
        'No restated textbook prose. Style: concise, like \'Step 1: ... '
        'Step 2: ...\' or a short direct derivation.>", '
        '"format": "<one of: word_problem, symbolic_expression, table>"}'
    )
    try:
        raw = call_with_hard_timeout(
            complete, LLM_CALL_TIMEOUT_S,
            prompt, system=CLASSIFY_SYSTEM, max_tokens=500, temperature=0.2,
        )
        if raw is None:
            return None
        raw = re.sub(r'^```(json)?|```$', '', raw.strip(), flags=re.M).strip()
        data = json.loads(raw)
        concept_ids = {c["id"] for c in concepts}
        if data.get("conceptId") not in concept_ids:
            return None
        if data.get("level") not in (1, 2, 3):
            return None
        if not data.get("explanation") or len(data["explanation"]) < 10:
            return None
        return data
    except Exception as e:
        # Was a bare `except: return None` -- every failure (real API error,
        # timeout, malformed JSON, bad conceptId) landed in R7 indistinguishably,
        # which is why repeated runs couldn't be diagnosed past "R7 is high."
        print(f"    [classify_and_explain error] {type(e).__name__}: {e}", file=sys.stderr)
        return None


# ---------------------------------------------------------------------------
# Main ingestion
# ---------------------------------------------------------------------------

def ingest(
    pdf_path: str,
    out_questions: str,
    report_path: str,
    ontology_path: str,
    dry_run: bool = False,
    test_filter: Optional[set[int]] = None,
    dpi: int = 300,
):
    concepts = load_concepts(ontology_path)
    questions: list[dict] = []
    rejects: list[dict] = []

    sections = [s for s in MATH_SECTIONS if not test_filter or s["test"] in test_filter]

    for section in sections:
        t = section["test"]
        print(f"\n[test {t}] OCR'ing question pages {section['q_lo']}-{section['q_hi']}...")
        raw_ocr = ocr_question_pages(pdf_path, section["q_lo"], section["q_hi"], dpi=dpi)
        cleaned = clean_ocr_text(raw_ocr)
        chunks = split_questions(cleaned)
        print(f"[test {t}] found {len(chunks)} candidate question chunks (expect {QUESTIONS_PER_TEST})")

        print(f"[test {t}] extracting correct answers from explanatory pages {section['expl_lo']}-{section['expl_hi']}...")
        correct_answers = extract_correct_answers(pdf_path, section["expl_lo"], section["expl_hi"])
        print(f"[test {t}] found {len(correct_answers)} correct-answer entries (expect {QUESTIONS_PER_TEST})")

        for qnum in range(1, QUESTIONS_PER_TEST + 1):
            rid = f"t{t}_q{qnum:02d}"
            chunk = chunks.get(qnum)
            if chunk is None:
                rejects.append({"id": rid, "reason": "R1_no_chunk_found"})
                continue

            letters = ODD_LETTERS if qnum % 2 == 1 else EVEN_LETTERS

            # Check visual/matrix dependence on the STEM ALONE first, before
            # attempting choice parsing. Diagram/matrix questions routinely
            # fail choice extraction too (their answer choices are visual --
            # matrix brackets, geometric labels), which previously mislabeled
            # them "R2_choices_not_parsed" and hid the real, more useful
            # reason ("this needs a diagram we can't extract") from the report.
            stem_only = extract_stem(chunk, letters)
            if is_visual_dependent(stem_only, []):
                rejects.append({"id": rid, "reason": "R3_visual_dependent"})
                continue
            if has_bracket_matrix(stem_only, []):
                rejects.append({"id": rid, "reason": "R3_matrix_notation"})
                continue

            choices = extract_choices(chunk, letters)
            if choices is None:
                rejects.append({"id": rid, "reason": "R2_choices_not_parsed"})
                continue

            stem = extract_stem(chunk, letters)
            if len(stem) < 15:
                rejects.append({"id": rid, "reason": "R2_stem_too_short"})
                continue

            if is_visual_dependent(stem, choices):
                rejects.append({"id": rid, "reason": "R3_visual_dependent"})
                continue

            if has_bracket_matrix(stem, choices):
                rejects.append({"id": rid, "reason": "R3_matrix_notation"})
                continue

            if looks_garbled(stem, min_length=20) or any(looks_garbled(c) for c in choices):
                rejects.append({"id": rid, "reason": "R4_ocr_garbled"})
                continue

            correct_letter = correct_answers.get(qnum)
            if correct_letter is None:
                rejects.append({"id": rid, "reason": "R5_no_ground_truth_answer"})
                continue
            if correct_letter not in letters:
                rejects.append({"id": rid, "reason": "R5_answer_letter_out_of_range"})
                continue

            # Dedup choices sanity check (mirrors ingest_eedi.py R4_duplicate_correct)
            norm = [c.strip().lower() for c in choices]
            if len(set(norm)) < len(norm):
                rejects.append({"id": rid, "reason": "R6_duplicate_choice_text"})
                continue

            if dry_run:
                questions.append({
                    "id": f"act_official_{rid}", "test": t, "qnum": qnum,
                    "stem_preview_len": len(stem), "choices_ok": True,
                    "correct_letter": correct_letter,
                })
                continue

            result = classify_and_explain(stem, choices, letters, correct_letter, concepts)
            # Real pacing between EVERY call, not just retries -- prior runs fired
            # calls back-to-back with zero gap (LLM_CALL_SLEEP_SECONDS was only
            # ever consumed inside llm_client's retry/backoff path), which is a
            # plausible cause of the persistent R7_llm_classify_failed rate even
            # on small batches. Cheap insurance either way.
            time.sleep(float(os.environ.get("LLM_CALL_SLEEP_SECONDS", "1.5")))
            if result is None:
                rejects.append({"id": rid, "reason": "R7_llm_classify_failed"})
                continue

            correct_idx = letters.index(correct_letter)
            q_entry = {
                "id": f"act_official_{rid}",
                "conceptId": result["conceptId"],
                "level": result["level"],
                "question": stem,
                "choices": choices,
                "correctIndex": correct_idx,
                "explanation": result["explanation"],
                "hints": [
                    "Read the question again — what value or expression is it actually asking for?",
                    "Set up the calculation step by step before combining terms.",
                    "Check your answer against the choices before finalizing.",
                ],
                "examTag": "ACT",
                "format": result.get("format") if result.get("format") in
                    ("word_problem", "symbolic_expression", "table") else "symbolic_expression",
                "sourceTest": t,
                "sourceQuestionNumber": qnum,
            }
            questions.append(q_entry)

    report = _build_report(questions, rejects, sections)

    # Regression guard (verified need: a run with only test_filter unset --
    # i.e. a full 4-test run, comparable to the previous one -- silently
    # overwrote a genuinely good 66/180 result with a worse 39/180 one after
    # an LLM-classification run-to-run instability. Never let a worse run
    # silently clobber a better one on disk again: compare against whatever
    # kept-count the last report recorded, and refuse to overwrite the
    # question file if this run is meaningfully worse. The report itself
    # still gets written (tagged) so the regression is visible for diagnosis,
    # not hidden.
    prev_kept = None
    if not dry_run and Path(report_path).exists():
        try:
            prev_kept = json.loads(Path(report_path).read_text()).get("total_kept")
        except Exception:
            prev_kept = None

    regressed = (
        not dry_run and prev_kept is not None and len(sections) == len(MATH_SECTIONS)
        and len(questions) < prev_kept * 0.9
    )

    if regressed:
        report["regression_guard"] = {
            "triggered": True,
            "previous_total_kept": prev_kept,
            "this_run_total_kept": len(questions),
            "note": (
                f"This run kept {len(questions)} questions vs a previous run's "
                f"{prev_kept} (>10% worse) -- did NOT overwrite {out_questions}. "
                "The existing (better) output file was left untouched. "
                "Investigate before re-running (rate limiting / timeout / "
                "flaky classification are the known causes)."
            ),
        }
        print(f"\n*** REGRESSION GUARD TRIPPED: kept {len(questions)} vs previous "
              f"{prev_kept} -- NOT overwriting {out_questions}. See report. ***")
        report_path = str(Path(report_path).with_name(
            Path(report_path).stem + "_REGRESSED" + Path(report_path).suffix))
    elif not dry_run:
        Path(out_questions).parent.mkdir(parents=True, exist_ok=True)
        with open(out_questions, "w") as f:
            json.dump(questions, f, indent=2, ensure_ascii=False)

    Path(report_path).parent.mkdir(parents=True, exist_ok=True)
    with open(report_path, "w") as f:
        json.dump(report, f, indent=2)

    _print_summary(report)
    return questions, rejects


def _build_report(questions, rejects, sections):
    from collections import Counter
    reject_counts = Counter(r["reason"] for r in rejects)
    by_concept: dict[str, dict] = {}
    for q in questions:
        c = q.get("conceptId", "?")
        if c not in by_concept:
            by_concept[c] = {"total": 0, "by_level": {1: 0, 2: 0, 3: 0}}
        by_concept[c]["total"] += 1
        lvl = q.get("level")
        if lvl in (1, 2, 3):
            by_concept[c]["by_level"][lvl] += 1
    total_candidates = len(questions) + len(rejects)
    return {
        "tests_processed": [s["test"] for s in sections],
        "total_candidate_questions": total_candidates,
        "total_kept": len(questions),
        "total_rejected": len(rejects),
        "survival_rate": round(len(questions) / max(1, total_candidates), 3),
        "reject_by_reason": dict(reject_counts),
        "rejects_detail": rejects,
        "kept_by_concept": by_concept,
    }


def _print_summary(report):
    print(f"\n{'='*60}")
    print("ACT Official Guide Ingestion Summary")
    print(f"{'='*60}")
    print(f"  Tests processed: {report['tests_processed']}")
    print(f"  Candidates: {report['total_candidate_questions']}")
    print(f"  Kept:       {report['total_kept']}  ({report['survival_rate']:.1%})")
    print(f"  Rejected:   {report['total_rejected']}")
    print("\nReject reasons:")
    for reason, n in sorted(report["reject_by_reason"].items(), key=lambda x: -x[1]):
        print(f"  {reason:<35} {n:4d}")
    print("\nKept by concept:")
    for concept, data in sorted(report["kept_by_concept"].items(), key=lambda x: -x[1]["total"]):
        lvls = f"L1={data['by_level'][1]} L2={data['by_level'][2]} L3={data['by_level'][3]}"
        print(f"  {concept:<35} {data['total']:4d}  {lvls}")


# ---------------------------------------------------------------------------
# Concurrency lock
# ---------------------------------------------------------------------------
# VERIFIED real bug: two of this script's own processes were left running
# concurrently against the SAME output path (an orphaned run from an earlier
# attempt that was never killed, plus a freshly-launched one) and raced to
# write actOfficialGuideQuestions.generated.json / ingest_report.json at the
# same time. That race -- not "LLM flakiness" -- was a real contributor to
# run-to-run result instability. A pidfile keyed on the output path makes a
# second concurrent run against the same target refuse to start instead of
# silently racing.

def _acquire_lock(out_questions: str) -> Path:
    lock_path = Path(out_questions).with_suffix(Path(out_questions).suffix + ".lock")
    if lock_path.exists():
        try:
            existing_pid = int(lock_path.read_text().strip())
            os.kill(existing_pid, 0)  # raises OSError if the pid is dead
            raise SystemExit(
                f"Another ingest run (pid {existing_pid}) already holds the lock "
                f"for {out_questions} ({lock_path}). Wait for it to finish, confirm "
                f"it's actually dead with `ps -p {existing_pid}`, or remove the "
                f"stale lock file yourself if you're certain it's gone. Refusing "
                f"to start a second concurrent run against the same output."
            )
        except (ProcessLookupError, ValueError):
            pass  # stale lock (dead pid or unreadable) -- safe to reclaim
    lock_path.write_text(str(os.getpid()))
    return lock_path


def _release_lock(lock_path: Path) -> None:
    try:
        lock_path.unlink(missing_ok=True)
    except Exception:
        pass


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Ingest Official ACT Prep Guide math practice tests")
    parser.add_argument("--pdf", required=True)
    parser.add_argument("--out-questions", default="app/src/data/actOfficialGuideQuestions.generated.json")
    parser.add_argument("--report", default="ml/data/act_official_guide/ingest_report.json")
    parser.add_argument(
        "--ontology",
        default="ml/data/5_level_ontology/01_mindcraft_concept_ontology_v2_6_with_combinations.json",
    )
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--tests", help="Comma-separated test numbers to limit to, e.g. 1 or 1,2")
    parser.add_argument("--dpi", type=int, default=300)
    args = parser.parse_args()

    test_filter = {int(x) for x in args.tests.split(",")} if args.tests else None

    lock = _acquire_lock(args.out_questions)
    try:
        ingest(
            pdf_path=args.pdf,
            out_questions=args.out_questions,
            report_path=args.report,
            ontology_path=args.ontology,
            dry_run=args.dry_run,
            test_filter=test_filter,
            dpi=args.dpi,
        )
    finally:
        _release_lock(lock)
