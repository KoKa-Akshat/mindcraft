from mindcraft_graph.work_check import check_work_lines


def _rule_id(prev: str, cur: str) -> str:
    result = check_work_lines([prev, cur])
    return result["verdictPerLine"][1]["rule"]["id"]


def test_add_subtract_and_divide_rules_label_linear_derivation():
    result = check_work_lines([
        r"$2x + 4 = 10$",
        r"$2x = 6$",
        r"$x = 3$",
    ])

    assert [v.get("rule", {}).get("id") for v in result["verdictPerLine"]] == [
        None,
        "subtracted_from_both_sides",
        "divided_both_sides",
    ]
    assert result["verdictPerLine"][1]["rule"]["ingredientIds"] == [
        "basic_equations__do_same_to_both_sides",
        "basic_equations__inverse_operations",
    ]


def test_every_named_rule_has_a_fixture():
    assert _rule_id(r"$x = 3$", r"$x + 2 = 5$") == "added_to_both_sides"
    assert _rule_id(r"$x + 2 = 5$", r"$2x + 4 = 10$") == "multiplied_both_sides"
    assert _rule_id(r"$x + 2 = 5$", r"$x = 3$") == "subtracted_from_both_sides"
    assert _rule_id(r"$2x = 6$", r"$x = 3$") == "divided_both_sides"
    assert _rule_id(r"$2(x + 3) = 10$", r"$2x + 6 = 10$") == "distributed"
    assert _rule_id(r"$2x + 6 = 10$", r"$2*(x + 3) = 10$") == "factored"
    assert _rule_id(r"$2x + 3x$", r"$5x$") == "combined_like_terms"
    assert _rule_id(r"$x = 3$", r"$x^2 = 9$") == "squared_both_sides"
    assert _rule_id(r"$x^2 = 9$", r"$x = 3$") == "took_sqrt_both_sides"


def test_wrong_step_still_gets_attempted_rule():
    result = check_work_lines([
        r"$2x + 4 = 10$",
        r"$2x = 14$",
    ])

    assert result["verdictPerLine"][1]["verdict"] == "wrong"
    assert result["verdictPerLine"][1]["rule"]["id"] == "moved_term"
