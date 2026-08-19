"""Converts a Jesse-generated lesson (topic + ordered chapter titles) into a
dynamic_concept_loader.py-shaped concept graph — the missing link between
"the app generated a lesson" and "the mastery engine has concepts for it".

This is deliberately NOT an LLM call. Slugging a title and chaining chapters
in the order the student already sees them in Study Session is a pure,
deterministic transform — there's no hallucination risk to guard against,
and every dynamic graph load already gets independently re-validated
(namespacing + DAG) by dynamic_concept_loader itself regardless of how it
was produced.

v1 prerequisite model: a straight chain, chapter N depends on chapter N-1.
This matches how Study Session already presents chapters (fixed order, one
after another) and is a defensible default — NOT an attempt at real
semantic prerequisite inference (e.g. two chapters that are actually
independent still chain). Cross-lesson edges (this lesson's chapter 1
depends on a DIFFERENT lesson's chapter 3) are out of scope for v1 too.
Both are named here so a future pass doesn't mistake the straight chain for
a considered design rather than a starting point.

Chapter BODY text is intentionally not embedded in the output graph — the
graph file is index/structure only (id, label, level, dependencies), same
shape as the four existing book-derived files. Body content stays where it
already lives (StudentAIKeyStore / StudySessionView on the client).
"""

from __future__ import annotations

import re

_SLUG_RE = re.compile(r"[^a-z0-9]+")


def slugify(text: str) -> str:
    slug = _SLUG_RE.sub("_", text.strip().lower()).strip("_")
    return slug or "untitled"


def tag_lesson_to_graph(
    topic: str,
    chapter_titles: list[str],
    *,
    version: str = "0.1.0",
) -> dict:
    """Build a dynamic_concept_loader-shaped dict for one generated lesson.

    Raises ValueError on empty input rather than silently producing a graph
    with no concepts — load_dynamic_concept_graph would reject that anyway
    (DynamicGraphError: "no concepts"), but failing here gives a clearer
    error at the point the bad input actually originated.
    """
    if not chapter_titles:
        raise ValueError("tag_lesson_to_graph: no chapter titles given")

    subject_id = slugify(topic)
    concepts: list[dict] = []
    seen_slugs: dict[str, int] = {}
    prev_id: str | None = None

    for title in chapter_titles:
        base_slug = slugify(title)
        # Two chapters can slug-collide (e.g. two "Review" chapters) — dedupe
        # deterministically rather than raising, since dynamic_concept_loader
        # DOES raise loudly on a true duplicate id and that's the right
        # place for a hard failure, not here.
        count = seen_slugs.get(base_slug, 0)
        seen_slugs[base_slug] = count + 1
        slug = base_slug if count == 0 else f"{base_slug}_{count + 1}"

        concept_id = f"{subject_id}::{slug}"
        concepts.append({
            "id": concept_id,
            "label": title,
            "subject_id": subject_id,
            "dependencies": [prev_id] if prev_id else [],
            "taxonomy_id": None,
            "level": "foundational" if prev_id is None else "core",
        })
        prev_id = concept_id

    return {
        "subject_id": subject_id,
        "title": topic,
        "version": version,
        "concepts": concepts,
    }
