"""
students/student_loader.py

Loads, creates, and updates student knowledge graphs in Firestore.
Each student document lives at homework_profiles/{student_id}.

Knowledge graph structure mirrors the spec exactly — confidence per concept,
strengths/gaps lists, and preferred learning style. We also read from the
ML system's knowledge_graphs collection to bootstrap a new student's
confidence scores from their existing mastery data.
"""

from __future__ import annotations
import os, json
from datetime import datetime, UTC
from dataclasses import dataclass, field
from typing import Optional
from google.cloud import firestore

COLLECTION = "homework_profiles"
ML_COLLECTION = "knowledge_graphs"

_db: Optional[firestore.Client] = None

def _get_db() -> firestore.Client:
    global _db
    if _db is None:
        _db = firestore.Client()
    return _db


@dataclass
class ConceptState:
    confidence: float = 0.0
    last_seen: Optional[str] = None
    attempts: int = 0
    successes: int = 0


@dataclass
class StudentProfile:
    student_id: str
    concepts: dict[str, ConceptState] = field(default_factory=dict)
    strengths: list[str] = field(default_factory=list)
    gaps: list[str] = field(default_factory=list)
    preferred_style: str = "algebraic"
    last_updated: str = field(default_factory=lambda: datetime.now(UTC).isoformat())

    def to_dict(self) -> dict:
        return {
            "student_id": self.student_id,
            "last_updated": self.last_updated,
            "concepts": {
                cid: {
                    "confidence": cs.confidence,
                    "last_seen": cs.last_seen,
                    "attempts": cs.attempts,
                    "successes": cs.successes,
                }
                for cid, cs in self.concepts.items()
            },
            "strengths": self.strengths,
            "gaps": self.gaps,
            "preferred_style": self.preferred_style,
        }

    @classmethod
    def from_dict(cls, data: dict) -> "StudentProfile":
        concepts = {
            cid: ConceptState(
                confidence=v.get("confidence", 0.0),
                last_seen=v.get("last_seen"),
                attempts=v.get("attempts", 0),
                successes=v.get("successes", 0),
            )
            for cid, v in data.get("concepts", {}).items()
        }
        return cls(
            student_id=data["student_id"],
            concepts=concepts,
            strengths=data.get("strengths", []),
            gaps=data.get("gaps", []),
            preferred_style=data.get("preferred_style", "algebraic"),
            last_updated=data.get("last_updated", datetime.now(UTC).isoformat()),
        )

    def get_confidence(self, concept_id: str) -> float:
        return self.concepts.get(concept_id, ConceptState()).confidence


def create_student(student_id: str) -> StudentProfile:
    """Create a new profile, bootstrapping confidence from ML knowledge graph if available."""
    db = _get_db()
    profile = StudentProfile(student_id=student_id)

    # Bootstrap from ML mastery data if it exists
    try:
        ml_doc = db.collection(ML_COLLECTION).document(student_id).get()
        if ml_doc.exists:
            ml_data = ml_doc.to_dict() or {}
            for cid, mastery_data in ml_data.get("masteryByConcept", {}).items():
                mastery = float(mastery_data.get("mastery", 0.0))
                if mastery > 0:
                    profile.concepts[cid] = ConceptState(
                        confidence=mastery,
                        attempts=mastery_data.get("attempts", 0),
                        successes=mastery_data.get("attempts", 0),  # approximate
                    )
    except Exception:
        pass  # ML graph unavailable — start fresh

    db.collection(COLLECTION).document(student_id).set(profile.to_dict())
    return profile


def load_student(student_id: str) -> StudentProfile:
    """Load student profile, creating one if it doesn't exist."""
    db = _get_db()
    doc = db.collection(COLLECTION).document(student_id).get()
    if not doc.exists:
        return create_student(student_id)
    return StudentProfile.from_dict(doc.to_dict())


def update_knowledge_graph(
    student_id: str,
    concept_id: str,
    outcome: float,  # 0.0 = wrong, 0.5 = partial, 1.0 = correct
    clues_used: int = 0,
) -> StudentProfile:
    """
    Bayesian confidence update after a card interaction.
    new_confidence = old + 0.1 * (outcome - old)
    Clue usage penalises the update slightly.
    """
    db = _get_db()
    profile = load_student(student_id)

    cs = profile.concepts.get(concept_id, ConceptState())
    old = cs.confidence
    clue_penalty = 0.05 * min(clues_used, 2)
    adjusted_outcome = max(0.0, outcome - clue_penalty)
    cs.confidence = round(old + 0.1 * (adjusted_outcome - old), 4)
    cs.attempts += 1
    if outcome >= 0.5:
        cs.successes += 1
    cs.last_seen = datetime.now(UTC).date().isoformat()
    profile.concepts[concept_id] = cs

    # Recompute gaps (confidence < 0.4) and strengths (confidence > 0.7)
    profile.gaps = sorted(
        [cid for cid, c in profile.concepts.items() if 0 < c.confidence < 0.4],
        key=lambda cid: profile.concepts[cid].confidence,
    )[:8]
    profile.strengths = sorted(
        [cid for cid, c in profile.concepts.items() if c.confidence >= 0.7],
        key=lambda cid: -profile.concepts[cid].confidence,
    )[:8]
    profile.last_updated = datetime.now(UTC).isoformat()

    db.collection(COLLECTION).document(student_id).set(profile.to_dict())
    return profile


def update_preferred_style(student_id: str, style: str) -> None:
    """Called when student engagement signals a style preference."""
    if style not in ("geometric", "algebraic", "intuitive"):
        return
    db = _get_db()
    db.collection(COLLECTION).document(student_id).update({"preferred_style": style})
