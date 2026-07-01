from __future__ import annotations

from datetime import datetime

from mindcraft_graph.firestore_adapter import load_affective_state


class _FakeDoc:
    def __init__(self, payload: dict | None):
        self.exists = payload is not None
        self._payload = payload

    def to_dict(self) -> dict | None:
        return self._payload


class _FakeDocumentRef:
    def __init__(self, payload: dict | None):
        self._payload = payload

    def get(self) -> _FakeDoc:
        return _FakeDoc(self._payload)


class _FakeCollection:
    def __init__(self, payload: dict | None):
        self._payload = payload

    def document(self, student_id: str) -> _FakeDocumentRef:
        return _FakeDocumentRef(self._payload)


class _FakeDb:
    def __init__(self, payload: dict | None):
        self._payload = payload

    def collection(self, name: str) -> _FakeCollection:
        assert name == "affective_state"
        return _FakeCollection(self._payload)


def test_load_affective_state_returns_none_when_doc_missing(monkeypatch) -> None:
    monkeypatch.setattr("mindcraft_graph.firestore_adapter.db", _FakeDb(None))

    assert load_affective_state("student-1") is None


def test_load_affective_state_returns_recent_latest(monkeypatch) -> None:
    now_ms = int(datetime.now().timestamp() * 1000)
    monkeypatch.setattr("mindcraft_graph.firestore_adapter.db", _FakeDb({
        "latest": {
            "stress": 0.8,
            "motivation": 0.4,
            "confidence_by_concept": {"linear_equations": 0.2},
            "explicit_struggles": ["linear_equations"],
            "captured_at": now_ms,
        }
    }))

    state = load_affective_state("student-1")

    assert state is not None
    assert state.stress == 0.8
    assert state.explicit_struggles == ["linear_equations"]


def test_load_affective_state_ignores_stale_latest(monkeypatch) -> None:
    stale_ms = int(datetime.now().timestamp() * 1000) - 5 * 60 * 60 * 1000
    monkeypatch.setattr("mindcraft_graph.firestore_adapter.db", _FakeDb({
        "latest": {
            "stress": 0.8,
            "motivation": 0.4,
            "confidence_by_concept": {},
            "explicit_struggles": [],
            "captured_at": stale_ms,
        }
    }))

    assert load_affective_state("student-1") is None
