"""Category evidence semantics, without a database.

Every builder is a pure function over loaded facts, so the category rules are
tested directly rather than through a query.
"""

from datetime import date

from scripts.game_evidence import DriverFacts, RaceEntry, build_evidence


def entry(
    year: int,
    *,
    position=None,
    grid=None,
    constructor="Ferrari",
    slug="ferrari",
    event=None,
    session_id=1,
    team_id=1,
):
    return RaceEntry(
        session_id=session_id,
        year=year,
        date=date(year, 3, 1),
        event_name=event or f"{year} Grand Prix",
        position=position,
        grid_position=grid,
        team_id=team_id,
        constructor_slug=slug,
        constructor_name=constructor,
    )


def facts(*races, slug="driver", country="GBR", sprints=()):
    return DriverFacts(
        driver_id=1,
        slug=slug,
        full_name="Test Driver",
        country_code=country,
        races=list(races),
        sprints=list(sprints),
    )


def test_constructor_collapses_consecutive_years_into_spans():
    driver = facts(entry(2007), entry(2008), entry(2009), entry(2015), entry(2016))

    evidence = build_evidence(driver, {"kind": "constructor", "value": "ferrari"})

    assert evidence["satisfied"] is True
    assert evidence["spans"] == [[2007, 2009], [2015, 2016]]
    assert evidence["entries"] == 5


def test_constructor_counter_evidence_names_the_teams_actually_driven_for():
    driver = facts(
        entry(2010, constructor="Williams", slug="williams"),
        entry(2011, constructor="Williams", slug="williams"),
        entry(2012, constructor="Sauber", slug="sauber"),
    )

    evidence = build_evidence(driver, {"kind": "constructor", "value": "mclaren"})

    assert evidence["satisfied"] is False
    assert evidence["drove_for"] == ["Williams", "Sauber"]


def test_win_from_grid_reports_the_deepest_qualifying_win():
    driver = facts(
        entry(2008, position=1, grid=4),
        entry(2009, position=1, grid=10),
        entry(2010, position=1, grid=7),
    )

    evidence = build_evidence(driver, {"kind": "win_from_grid", "minimum": 6})

    assert evidence["satisfied"] is True
    assert evidence["grid"] == 10


def test_win_from_grid_counter_evidence_is_the_nearest_miss():
    """The number that shows how close the driver came is the teaching line a
    cross cannot carry."""
    driver = facts(entry(2019, position=1, grid=4), entry(2020, position=1, grid=2))

    evidence = build_evidence(driver, {"kind": "win_from_grid", "minimum": 6})

    assert evidence["satisfied"] is False
    assert evidence["best_grid"] == 4
    assert evidence["race"]["year"] == 2019


def test_win_from_grid_without_any_win_reports_no_grid():
    evidence = build_evidence(
        facts(entry(2019, position=5, grid=8)),
        {"kind": "win_from_grid", "minimum": 6},
    )

    assert evidence["satisfied"] is False
    assert evidence["best_grid"] is None
    assert evidence["wins"] == 0


def test_race_entries_carries_the_actual_count_when_short():
    driver = facts(*(entry(2010 + index) for index in range(4)))

    evidence = build_evidence(driver, {"kind": "race_entries", "minimum": 100})

    assert evidence["satisfied"] is False
    assert evidence["entries"] == 4
    assert (evidence["first_year"], evidence["last_year"]) == (2010, 2013)


def test_race_decade_counter_evidence_gives_the_career_span():
    driver = facts(entry(2011), entry(2015))

    evidence = build_evidence(driver, {"kind": "race_decade", "value": 2000})

    assert evidence["satisfied"] is False
    assert (evidence["career_first"], evidence["career_last"]) == (2011, 2015)


def test_debut_decade_uses_the_first_race_ever():
    driver = facts(entry(2007, event="2007 Australian Grand Prix"), entry(2011))

    evidence = build_evidence(driver, {"kind": "debut_decade", "value": 2000})

    assert evidence["satisfied"] is True
    assert evidence["debut_event"] == "2007 Australian Grand Prix"


def test_race_winner_counter_evidence_is_the_best_finish():
    driver = facts(entry(2010, position=4), entry(2011, position=2))

    evidence = build_evidence(driver, {"kind": "race_winner"})

    assert evidence["satisfied"] is False
    assert evidence["best_finish"] == 2
    assert evidence["best_finish_race"]["year"] == 2011


def test_podium_counts_every_top_three_finish():
    driver = facts(entry(2010, position=3), entry(2011, position=1), entry(2012, position=8))

    evidence = build_evidence(driver, {"kind": "podium"})

    assert evidence["satisfied"] is True
    assert evidence["podiums"] == 2
    assert evidence["first_podium"]["year"] == 2010


def test_sprint_winner_reads_sprint_sessions_only():
    driver = facts(entry(2021, position=1), sprints=[entry(2022, position=1)])

    evidence = build_evidence(driver, {"kind": "sprint_winner"})

    assert evidence["satisfied"] is True
    assert evidence["sprint_wins"] == 1
    assert evidence["first_win"]["year"] == 2022


def test_multi_constructor_winner_lists_first_win_per_constructor():
    driver = facts(
        entry(2007, position=1, constructor="McLaren", slug="mclaren"),
        entry(2008, position=1, constructor="McLaren", slug="mclaren"),
        entry(2013, position=1, constructor="Mercedes", slug="mercedes"),
        entry(2014, position=5, constructor="Mercedes", slug="mercedes"),
    )

    evidence = build_evidence(driver, {"kind": "multi_constructor_winner", "minimum": 2})

    assert evidence["satisfied"] is True
    assert evidence["won_for"] == [
        {"constructor": "McLaren", "year": 2007},
        {"constructor": "Mercedes", "year": 2013},
    ]


def test_named_teammate_matches_a_shared_seat():
    driver = facts(entry(2016, session_id=9, team_id=3))
    context = {
        "teammate_seats": {"max-verstappen": {(9, 3)}},
        "driver_names": {"max-verstappen": "Max Verstappen"},
    }

    evidence = build_evidence(
        driver, {"kind": "named_teammate", "driver_slug": "max-verstappen"}, context
    )

    assert evidence["satisfied"] is True
    assert evidence["teammate"] == "Max Verstappen"
    assert evidence["spans"] == [[2016, 2016]]


def test_a_driver_is_not_their_own_teammate():
    """Matching on session and team alone makes a driver share a seat with
    themselves, which would put Verstappen in his own teammate category."""
    driver = facts(entry(2016, session_id=9, team_id=3), slug="max-verstappen")
    context = {
        "teammate_seats": {"max-verstappen": {(9, 3)}},
        "driver_names": {"max-verstappen": "Max Verstappen"},
    }

    evidence = build_evidence(
        driver, {"kind": "named_teammate", "driver_slug": "max-verstappen"}, context
    )

    assert evidence["satisfied"] is False
    assert evidence["self_reference"] is True


def test_unknown_kind_degrades_to_no_evidence():
    """A category without an evidence builder still plays; the boolean result
    is the floor."""
    assert build_evidence(facts(entry(2010)), {"kind": "car_number", "value": 44}) is None
