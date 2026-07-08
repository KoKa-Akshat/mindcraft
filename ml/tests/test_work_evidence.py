from mindcraft_graph.models.ingredient import IngredientStudentState
from mindcraft_graph.work_evidence import apply_work_evidence


def _step(rule_id: str, ingredients: list[str], verdict: str = "ok") -> dict:
    return {
        "verdict": verdict,
        "rule": {
            "id": rule_id,
            "label": rule_id,
            "ingredientIds": ingredients,
        },
    }


def test_three_step_correct_problem_is_capped_below_two_one_step_problems():
    ingredient = "basic_equations__inverse_operations"
    state = IngredientStudentState(student_id="s")
    state, events = apply_work_evidence(state, [
        _step("a", [ingredient]),
        _step("b", [ingredient]),
        _step("c", [ingredient]),
    ], "basic_equations")

    assert len(events) == 3
    assert state.ingredient_mastery[ingredient].mastery == 0.5

    two_problems = IngredientStudentState(student_id="s")
    two_problems, _ = apply_work_evidence(two_problems, [_step("a", [ingredient])], "basic_equations")
    two_problems, _ = apply_work_evidence(two_problems, [_step("b", [ingredient])], "basic_equations")
    assert two_problems.ingredient_mastery[ingredient].mastery == 1.0


def test_only_first_wrong_step_records_negative_evidence():
    ingredient = "basic_equations__inverse_operations"
    later_ingredient = "basic_equations__do_same_to_both_sides"
    state = IngredientStudentState(student_id="s")
    state, events = apply_work_evidence(state, [
        _step("a", [ingredient], "ok"),
        _step("b", [ingredient], "wrong"),
        _step("c", [later_ingredient], "ok"),
    ], "basic_equations")

    wrong_events = [event for event in events if event.verdict == "wrong"]
    assert len(wrong_events) == 1
    assert wrong_events[0].delta == -0.5
    assert later_ingredient not in state.ingredient_mastery


def test_empty_ingredient_rule_aggregates_to_concept_event():
    state = IngredientStudentState(student_id="s")
    _state, events = apply_work_evidence(state, [
        _step("rewrote_equivalent", [], "ok"),
    ], "linear_equations")

    assert events[0].kind == "concept"
    assert events[0].target_id == "linear_equations"
