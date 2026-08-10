from mindcraft_graph.work_check import check_work_lines


def test_equivalent_linear_equation_steps_are_ok():
    result = check_work_lines([
        r"$2x + 4 = 10$",
        r"$2x = 6$",
        r"$x = 3$",
    ])

    assert result["firstBrokenLine"] is None
    assert [v["verdict"] for v in result["verdictPerLine"]] == ["ok", "ok", "ok"]


def test_sign_error_flags_first_broken_line():
    result = check_work_lines([
        r"$2x + 4 = 10$",
        r"$2x = 14$",
        r"$x = 7$",
    ])

    assert result["firstBrokenLine"] == 1
    assert result["verdictPerLine"][1]["verdict"] == "wrong"
    assert result["hypothesis"]["misconception_id"] == "mis_step_transformation_not_equivalent"


def test_unparsed_line_is_not_marked_wrong():
    result = check_work_lines([
        r"$2x + 4 = 10$",
        r"$\int x^2 dx$",
        r"$x = 3$",
    ])

    assert result["firstBrokenLine"] is None
    assert result["verdictPerLine"][1]["verdict"] == "unparsed"
    assert result["verdictPerLine"][2]["verdict"] == "unparsed"
