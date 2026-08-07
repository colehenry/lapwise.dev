"""Board validation gates, exercised without a database.

Every rule here is a pure function of an answer map, which is the point: the
gates are testable without freezing a board or reaching a driver table.
"""

from scripts.game_validator import (
    Recognition,
    Report,
    _check_decoy_pools,
    _check_depths,
    has_perfect_assignment,
)


def _named(slug: str, wins: int, entries: int, champion: bool = False) -> Recognition:
    return Recognition(
        slug=slug,
        full_name=slug.title(),
        wins=wins,
        entries=entries,
        is_champion=champion,
    )


def _codes(report: Report, level: str | None = None) -> set[str]:
    return {
        finding.code
        for finding in report.findings
        if level is None or finding.level == level
    }


def _grid(rows=("r1", "r2", "r3"), columns=("c1", "c2", "c3")) -> dict:
    return {
        "rows": [{"id": row} for row in rows],
        "columns": [{"id": column} for column in columns],
    }


def _cells(answers: dict[str, set[str]]) -> dict[str, set[str]]:
    return {key: set(value) for key, value in answers.items()}


def test_perfect_assignment_accepts_a_completable_board():
    cells = _cells({f"r{r}__c{c}": {f"d{r}{c}"} for r in range(3) for c in range(3)})

    complete, unmatched = has_perfect_assignment(cells)

    assert complete
    assert unmatched == []


def test_perfect_assignment_rejects_nine_cells_sharing_four_drivers():
    """Every cell has answers and the board still cannot be finished, because
    a placed driver is spent for the rest of it."""
    shared = {"alpha", "beta", "gamma", "delta"}
    cells = _cells({f"r{r}__c{c}": shared for r in range(3) for c in range(3)})

    complete, unmatched = has_perfect_assignment(cells)

    assert not complete
    assert len(unmatched) == 5


def test_perfect_assignment_survives_a_cell_needing_a_reshuffle():
    """The deep cell must give up its only-possible driver to the shallow one.
    A greedy pass that never backtracks reports this board unsolvable."""
    cells = _cells(
        {
            "r0__c0": {"shared"},
            "r0__c1": {"shared", "other"},
            "r0__c2": {"third"},
        }
    )

    complete, unmatched = has_perfect_assignment(cells)

    assert complete, unmatched


def test_two_answer_cell_passes_when_both_are_known_and_one_anchors():
    report = Report(board_id="test")
    cells = _cells({"r1__c1": {"prost", "alesi"}})
    recognition = {
        "prost": _named("prost", wins=51, entries=202, champion=True),
        "alesi": _named("alesi", wins=1, entries=202),
    }

    _check_depths(report, cells, recognition)

    assert not report.errors


def test_two_answer_cell_fails_when_an_answer_is_obscure():
    report = Report(board_id="test")
    cells = _cells({"r1__c1": {"prost", "nobody"}})
    recognition = {
        "prost": _named("prost", wins=51, entries=202, champion=True),
        "nobody": _named("nobody", wins=0, entries=12),
    }

    _check_depths(report, cells, recognition)

    assert "thin_cell_below_floor" in _codes(report, "error")


def test_two_answer_cell_fails_without_an_anchor():
    """Both answers clear the floor on entries alone, and neither is a name a
    casual player reaches for first."""
    report = Report(board_id="test")
    cells = _cells({"r1__c1": {"journeyman", "grafter"}})
    recognition = {
        "journeyman": _named("journeyman", wins=0, entries=180),
        "grafter": _named("grafter", wins=1, entries=150),
    }

    _check_depths(report, cells, recognition)

    assert "thin_cell_without_anchor" in _codes(report, "error")
    assert "thin_cell_below_floor" not in _codes(report, "error")


def test_three_two_answer_cells_are_rejected():
    report = Report(board_id="test")
    champion = _named("champ", wins=40, entries=200, champion=True)
    recognition = {"champ": champion} | {
        f"other{n}": _named(f"other{n}", wins=6, entries=120) for n in range(3)
    }
    cells = _cells({f"r{n}__c1": {"champ", f"other{n}"} for n in range(3)})

    _check_depths(report, cells, recognition)

    assert "too_many_thin_cells" in _codes(report, "error")


def test_singleton_and_thin_cell_cannot_share_a_board():
    report = Report(board_id="test")
    recognition = {
        "champ": _named("champ", wins=40, entries=200, champion=True),
        "other": _named("other", wins=6, entries=120),
        "solo": _named("solo", wins=25, entries=160, champion=True),
    }
    cells = _cells({"r1__c1": {"champ", "other"}, "r2__c2": {"solo"}})

    _check_depths(report, cells, recognition)

    assert "thin_cell_with_singleton" in _codes(report, "error")


def test_shared_anchor_across_thin_cells_is_reported():
    report = Report(board_id="test")
    recognition = {
        "prost": _named("prost", wins=51, entries=202, champion=True),
        "alesi": _named("alesi", wins=1, entries=202),
        "warwick": _named("warwick", wins=0, entries=148),
    }
    cells = _cells({"r1__c1": {"prost", "alesi"}, "r2__c2": {"prost", "warwick"}})

    _check_depths(report, cells, recognition)

    assert not report.errors
    assert "shared_thin_answer" in _codes(report, "warning")


def test_single_axis_decoys_are_reported_when_a_row_adds_nothing():
    """Every driver in the row also appears in the column, so no decoy can
    fail the column while satisfying the row."""
    report = Report(board_id="test")
    board = _grid()
    cells = _cells(
        {
            f"{row}__{column}": ({"a", "b"} if row == "r1" else {"a", "b", "c", "d"})
            for row in ("r1", "r2", "r3")
            for column in ("c1", "c2", "c3")
        }
    )

    _check_decoy_pools(report, board, cells)

    assert "single_axis_decoys" in _codes(report, "warning")
