# mindcraft_graph/representation/summary_parser.py

"""
Summary parser: converts session summary bullets into structured events.

This is the bridge between the tutor-facing pipeline (Claude Haiku summaries
stored in Firestore) and the ML pipeline (per-student knowledge graph).

Flow:
  Tutor publishes summary → bullets[] and topics[]
  → summary_parser embeds each bullet
  → cosine similarity against concept embeddings detects which concepts were covered
  → valence detection determines positive/negative signal
  → emits SessionEvent objects the update engine already consumes
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime

import numpy as np

from mindcraft_graph.models.events import SessionEvent


@dataclass
class ConceptMention:
    """One detected concept in a summary bullet."""
    concept_id: str
    similarity: float       # how strongly this bullet relates to this concept
    valence: float          # positive (strength) or negative (weakness)
    exposure_weight: float  # primary=1.0, secondary=0.4, tertiary=0.15
    source_text: str        # the bullet that generated this mention


# ── Valence detection ──

POSITIVE_SIGNALS = [
    "strong", "mastered", "confident", "solid", "understood",
    "nailed", "comfortable", "improved", "excellent", "good grasp",
    "well", "correct", "accurately", "fluent", "independent",
    "quick", "easily", "no trouble", "clear understanding",
]

NEGATIVE_SIGNALS = [
    "struggled", "weak", "confused", "needs work", "difficulty",
    "stuck", "unsure", "trouble", "needs more", "review needed",
    "needs practice", "shaky", "incorrect", "misunderstood",
    "forgot", "mixed up", "slow", "hesitant", "gap",
    "still working on", "not yet", "couldn't",
]


def detect_valence(text: str) -> float:
    """
    Keyword-based valence detection from summary language.
    Returns value in [-1, 1].

    Positive: student showed strength on this topic.
    Negative: student showed weakness.
    Neutral/slightly positive: concept was covered without strong signal.
    """
    text_lower = text.lower()

    pos_count = sum(1 for s in POSITIVE_SIGNALS if s in text_lower)
    neg_count = sum(1 for s in NEGATIVE_SIGNALS if s in text_lower)

    total = pos_count + neg_count
    if total == 0:
        return 0.2  # neutral — concept was covered, slight positive default

    return (pos_count - neg_count) / total


def cosine_similarity(a: np.ndarray, b: np.ndarray) -> float:
    """Cosine similarity, safe against zero vectors."""
    denom = np.linalg.norm(a) * np.linalg.norm(b)
    if denom < 1e-8:
        return 0.0
    return float(np.dot(a, b) / denom)


# ── Core parsing ──

def parse_summary_bullets(
    bullets: list[str],
    concept_embeddings: dict[str, np.ndarray],
    embed_fn,
    similarity_threshold: float = 0.35,
) -> list[ConceptMention]:
    """
    Extract concept mentions from session summary bullets.

    Each bullet is embedded and compared against all concept embeddings.
    Returns a list of ConceptMention objects sorted by similarity.

    Args:
        bullets: list of summary bullet strings
        concept_embeddings: concept_id → embedding vector
        embed_fn: function that takes a string → numpy vector
        similarity_threshold: minimum cosine similarity to count as a mention
    """
    mentions = []

    for bullet in bullets:
        if not bullet or not bullet.strip():
            continue

        bullet_vec = embed_fn(bullet)

        # Find matching concepts
        matches = []
        for concept_id, concept_vec in concept_embeddings.items():
            sim = cosine_similarity(bullet_vec, concept_vec)
            if sim >= similarity_threshold:
                matches.append((concept_id, sim))

        if not matches:
            continue

        # Rank by similarity — top match is primary, rest are secondary/tertiary
        matches.sort(key=lambda x: -x[1])

        # Detect valence from bullet language
        valence = detect_valence(bullet)

        for rank, (concept_id, sim) in enumerate(matches):
            if rank == 0:
                weight = 1.0
            elif rank <= 2:
                weight = 0.4
            else:
                weight = 0.15

            mentions.append(ConceptMention(
                concept_id=concept_id,
                similarity=sim,
                valence=valence,
                exposure_weight=weight,
                source_text=bullet,
            ))

    return mentions


def parse_summary_topics(
    topics: list[str],
    concept_embeddings: dict[str, np.ndarray],
    embed_fn,
    similarity_threshold: float = 0.4,
) -> list[ConceptMention]:
    """
    Extract concept mentions from the topics[] field.

    Topics are typically short labels ("Derivatives", "Chain Rule")
    so they get a higher similarity threshold and always primary weight.
    """
    mentions = []

    for topic in topics:
        if not topic or not topic.strip():
            continue

        topic_vec = embed_fn(topic)

        best_match = None
        best_sim = 0.0

        for concept_id, concept_vec in concept_embeddings.items():
            sim = cosine_similarity(topic_vec, concept_vec)
            if sim > best_sim:
                best_sim = sim
                best_match = concept_id

        if best_match and best_sim >= similarity_threshold:
            mentions.append(ConceptMention(
                concept_id=best_match,
                similarity=best_sim,
                valence=0.3,  # topics listed = generally positive signal
                exposure_weight=1.0,  # topics are always primary
                source_text=topic,
            ))

    return mentions


# ── Event emission ──

def mentions_to_events(
    mentions: list[ConceptMention],
    student_id: str,
    session_timestamp: datetime,
    session_duration_minutes: float = 45.0,
) -> list[SessionEvent]:
    """
    Convert ConceptMentions into SessionEvents that the update engine consumes.

    Deduplicates by concept_id — if multiple bullets mention the same concept,
    combine them into one event with averaged valence and max exposure weight.
    """
    # Aggregate by concept
    by_concept: dict[str, list[ConceptMention]] = {}
    for mention in mentions:
        if mention.concept_id not in by_concept:
            by_concept[mention.concept_id] = []
        by_concept[mention.concept_id].append(mention)

    events = []
    for concept_id, concept_mentions in by_concept.items():
        # Average valence across all mentions of this concept
        avg_valence = sum(m.valence for m in concept_mentions) / len(concept_mentions)

        # Max exposure weight (if any bullet had it as primary, it's primary)
        max_weight = max(m.exposure_weight for m in concept_mentions)

        # Effort proxy: more mentions = more engagement with this concept
        effort = min(1.0, len(concept_mentions) * 0.3)

        # Duration proxy: split session time by number of concepts
        duration_share = session_duration_minutes / max(len(by_concept), 1)

        events.append(SessionEvent(
            student_id=student_id,
            concept_id=concept_id,
            event_type="session",
            outcome=avg_valence,
            effort=effort,
            duration_minutes=duration_share,
            timestamp=session_timestamp,
            exposure_weight=max_weight,
        ))

    return events


# ── High-level convenience function ──

def process_session_summary(
    student_id: str,
    bullets: list[str],
    topics: list[str],
    concept_embeddings: dict[str, np.ndarray],
    embed_fn,
    session_timestamp: datetime | None = None,
    session_duration_minutes: float = 45.0,
    bullet_threshold: float = 0.35,
    topic_threshold: float = 0.4,
) -> list[SessionEvent]:
    """
    Full pipeline: summary → mentions → events.

    This is the function you call when a tutor publishes a summary.
    It returns SessionEvent objects that feed directly into
    update_personal_graph.

    Args:
        student_id: Firebase Auth UID
        bullets: summary.bullets[] from Firestore
        topics: summaryCard.topics[] from Firestore
        concept_embeddings: precomputed concept_id → vector
        embed_fn: function(str) → np.ndarray
        session_timestamp: when the session occurred
        session_duration_minutes: session length
    """
    if session_timestamp is None:
        session_timestamp = datetime.now()

    # Parse both bullets and topics
    bullet_mentions = parse_summary_bullets(
        bullets, concept_embeddings, embed_fn,
        similarity_threshold=bullet_threshold,
    )
    topic_mentions = parse_summary_topics(
        topics, concept_embeddings, embed_fn,
        similarity_threshold=topic_threshold,
    )

    # Combine — topic mentions take priority for exposure weight
    all_mentions = topic_mentions + bullet_mentions

    # Convert to events
    events = mentions_to_events(
        all_mentions, student_id, session_timestamp,
        session_duration_minutes,
    )

    return events
