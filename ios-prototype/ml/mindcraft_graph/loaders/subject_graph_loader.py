from __future__ import annotations

import json
from pathlib import Path

from mindcraft_graph.models.learning_world import SubjectGraph


def load_subject_graphs(directory: Path) -> dict[str, SubjectGraph]:
    graphs: dict[str, SubjectGraph] = {}
    if not directory.exists():
        return graphs

    for path in sorted(directory.glob("*.json")):
        data = json.loads(path.read_text())
        graph = SubjectGraph.model_validate(data)
        graphs[graph.id] = graph

    return graphs

