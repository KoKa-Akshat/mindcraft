from __future__ import annotations

from datetime import datetime, timedelta

from mindcraft_graph.firestore_adapter import load_attempt_observations


class _Doc:
    def __init__(self, payload):
        self.payload = payload

    def to_dict(self):
        return self.payload


class _Query:
    def __init__(self, docs):
        self.docs = docs

    def where(self, *args, **kwargs):
        return self

    def order_by(self, *args, **kwargs):
        return self

    def limit(self, *args, **kwargs):
        return self

    def stream(self):
        return iter(self.docs)


class _Db:
    def __init__(self, docs):
        self.docs = docs

    def collection(self, name):
        assert name == "attempt_observations"
        return _Query(self.docs)


def test_attempt_dedup_preserves_retries_and_null_question_ids(monkeypatch, caplog) -> None:
    now = datetime(2026, 1, 1)
    base = {"conceptId": "c", "formatId": None, "level": 1}
    docs = [
        _Doc({**base, "questionId": "q", "correct": 1, "timestamp": now}),
        _Doc({**base, "questionId": "q", "correct": 1, "timestamp": now + timedelta(seconds=1)}),
        _Doc({**base, "questionId": "q", "correct": 0, "timestamp": now + timedelta(seconds=2)}),
        _Doc({**base, "questionId": None, "correct": 1, "timestamp": now + timedelta(seconds=3)}),
        _Doc({**base, "questionId": None, "correct": 1, "timestamp": now + timedelta(seconds=4)}),
    ]
    monkeypatch.setattr("mindcraft_graph.firestore_adapter.db", _Db(docs))

    with caplog.at_level("INFO"):
        deduped = load_attempt_observations("student")
    assert len(deduped) == 4
    assert deduped[0]["timestamp"] == now
    assert "Collapsed 1 duplicate" in caplog.text
    assert len(load_attempt_observations("student", dedupe=False)) == 5
