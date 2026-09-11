"""Pure regression tests for the guess game contracts."""

from datetime import date, timedelta
from types import SimpleNamespace

import pytest
from sqlalchemy import select

from app.models import Driver, GuessGameGuess, GuessGamePuzzle, GuessGameSession
from app.schemas.daily_grid import GameDriver
from app.schemas.guess_game import GuessGamePuzzleResponse
from app.services.daily_game_results_service import (
    assert_session_owner,
    leaderboard_page,
    summarize_sessions,
)
from app.services.driver_attribute_service import (
    ConstructorRecord,
    DriverAttributeService,
    select_signature_constructor,
)
from app.services.driver_fact_service import DriverFactService, FactCandidate
from app.services.guess_game_service import GuessGameService


def snapshot(
    *,
    debut=2000,
    last=2020,
    country="GBR",
    constructor=1,
    history=(1,),
    peak=0,
):
    return {
        "debut": debut,
        "last_raced": last,
        "country_code": country,
        "constructor": {"id": constructor},
        "constructor_ids": list(history),
        "career_peak": peak,
    }


def test_year_boundaries_and_arrow_point_toward_answer():
    answer = snapshot(debut=2004, last=2016)
    compared = DriverAttributeService.compare(snapshot(debut=2001, last=2020), answer)
    assert compared["debut"] == {"state": "close", "direction": "higher"}
    assert compared["last_raced"] == {"state": "miss", "direction": "lower"}
    assert DriverAttributeService._year(2000, 2004)["state"] == "miss"


def test_country_constructor_and_peak_close_rules():
    answer = snapshot(country="GBR", constructor=1, history=(1, 2), peak=1)
    close = DriverAttributeService.compare(
        snapshot(country="ESP", constructor=3, history=(2, 3), peak=2), answer
    )
    assert close["country"]["state"] == "close"
    assert close["constructor"]["state"] == "close"
    assert close["career_peak"]["state"] == "close"
    miss = DriverAttributeService.compare(
        snapshot(country="BRA", constructor=4, history=(4,), peak=4), answer
    )
    assert {
        miss[key]["state"] for key in ("country", "constructor", "career_peak")
    } == {"miss"}


def test_country_and_constructor_exact_rules():
    answer = snapshot(country="GBR", constructor=2, history=(1, 2), peak=0)
    compared = DriverAttributeService.compare(
        snapshot(country="GBR", constructor=2, history=(2, 3), peak=0), answer
    )
    assert compared["country"] == {"state": "exact", "direction": None}
    assert compared["constructor"] == {"state": "exact", "direction": None}


@pytest.mark.parametrize("tier", range(5))
def test_every_career_peak_tier_matches_itself(tier):
    assert DriverAttributeService._peak(tier, tier)["state"] == "exact"


@pytest.mark.parametrize(
    ("guess", "answer", "state"),
    [
        (0, 1, "close"),
        (1, 2, "close"),
        (2, 3, "close"),
        (3, 4, "close"),
        (0, 2, "miss"),
    ],
)
def test_career_peak_adjacency(guess, answer, state):
    assert DriverAttributeService._peak(guess, answer)["state"] == state


def test_signature_constructor_uses_wins_podiums_starts_then_slug():
    red_bull = ConstructorRecord(1, "red-bull", "Red Bull Racing", 38, 65, 120)
    ferrari = ConstructorRecord(2, "ferrari", "Ferrari", 14, 55, 100)
    assert select_signature_constructor([ferrari, red_bull]).name == "Red Bull Racing"
    tied_b = ConstructorRecord(3, "z-team", "Z Team", 0, 0, 10)
    tied_a = ConstructorRecord(4, "a-team", "A Team", 0, 0, 10)
    assert select_signature_constructor([tied_b, tied_a]).slug == "a-team"


def test_fact_selection_is_deterministic_and_avoids_recent_category():
    candidates = [
        FactCandidate("career.starts", "career", "Started races.", 50),
        FactCandidate("circuit.wins", "circuit", "Won here.", 40),
    ]
    first = DriverFactService.select_fact(candidates, "guess-1", 44, ["career"])
    second = DriverFactService.select_fact(candidates, "guess-1", 44, ["career"])
    assert first == second
    assert first.category == "circuit"


def test_public_puzzle_contract_has_no_answer_fields():
    payload = GuessGamePuzzleResponse(
        id="guess-1",
        number=1,
        published_on=date(2026, 9, 10),
        max_guesses=10,
        previous_number=None,
        next_number=None,
    ).model_dump()
    assert not any("answer" in key for key in payload)


def test_shared_statistics_calculates_distribution_and_streak():
    class Row:
        def __init__(self, day, won, score):
            self.day = day
            self.won = won
            self.score = score

    today = date.today()
    rows = [Row(today - timedelta(days=1), True, 2), Row(today, True, 3)]
    stats = summarize_sessions(
        rows,
        played_on=lambda row: row.day,
        is_win=lambda row: row.won,
        score=lambda row: row.score,
    )
    assert stats.played == 2
    assert stats.current_streak == 2
    assert stats.distribution == {2: 1, 3: 1}


def test_shared_session_ownership_supports_accounts_and_anonymous_players():
    class Session:
        user_id = 4
        anon_id = None

    assert_session_owner(Session(), 4, None)
    with pytest.raises(PermissionError):
        assert_session_owner(Session(), 5, None)
    Session.user_id = None
    Session.anon_id = "anonymous-player-123"
    assert_session_owner(Session(), None, "anonymous-player-123")
    with pytest.raises(PermissionError):
        assert_session_owner(Session(), None, None)


def test_shared_leaderboard_page_numbers_and_serializes_rows():
    class Row:
        username = "cole"
        won = True
        score = 3
        elapsed = 1200

    page = leaderboard_page(
        [Row()],
        total=8,
        offset=5,
        limit=1,
        display_name=lambda row: row.username,
        is_win=lambda row: row.won,
        score=lambda row: row.score,
        elapsed_ms=lambda row: row.elapsed,
    )
    assert page.entries[0].rank == 6
    assert page.entries[0].display_name == "cole"
    assert page.total == 8


def test_guess_game_models_enforce_frozen_play_uniqueness():
    puzzle_indexes = {index.name for index in GuessGamePuzzle.__table__.indexes}
    session_indexes = {index.name for index in GuessGameSession.__table__.indexes}
    guess_indexes = {index.name for index in GuessGameGuess.__table__.indexes}
    assert "uq_driver_guess_published_on" in puzzle_indexes
    assert {
        "uq_driver_guess_session_ranked_user",
        "uq_driver_guess_session_ranked_anon",
    } <= session_indexes
    assert {"uq_driver_guess_sequence", "uq_driver_guess_driver"} <= guess_indexes


@pytest.mark.asyncio
async def test_frozen_guess_replay_reveals_answer_only_when_allowed(monkeypatch):
    async def driver_response(_db, _driver_id):
        return GameDriver(
            driver_slug="sample-driver",
            full_name="Sample Driver",
            driver_code="SAM",
            headshot_url=None,
        )

    monkeypatch.setattr(
        GuessGameService, "_driver_response", staticmethod(driver_response)
    )
    frozen = {
        "values": {
            "driver_slug": "sample-driver",
            "full_name": "Sample Driver",
            "driver_code": "SAM",
            "debut": 2000,
            "last_raced": 2010,
            "country": "Great Britain",
            "constructor": {"name": "Sample Constructor"},
            "career_peak_label": "Points Scorer",
        },
        "comparisons": {
            key: {"state": "miss", "direction": None}
            for key in (
                "debut",
                "last_raced",
                "country",
                "constructor",
                "career_peak",
            )
        },
        "highlights": [{"id": "wins", "value": "2", "label": "Wins"}],
    }
    record = SimpleNamespace(
        sequence=10,
        correct=False,
        guessed_driver_id=1,
        comparison_snapshot=frozen,
        selected_fact_id="career.starts",
        rendered_fact_text="Made ten Grand Prix starts.",
        constructor_color="AABBCC",
    )
    answer = {
        "driver_slug": "answer-driver",
        "full_name": "Answer Driver",
        "driver_code": "ANS",
    }
    hidden = await GuessGameService._guess_response(None, record, answer, reveal=False)
    revealed = await GuessGameService._guess_response(None, record, answer, reveal=True)
    assert hidden.answer is None
    assert hidden.highlights is None
    assert revealed.answer and revealed.answer.driver_slug == "answer-driver"
    assert revealed.highlights is None
    assert revealed.values.debut == 2000


@pytest.mark.asyncio
async def test_correct_frozen_guess_replays_persisted_highlights(monkeypatch):
    async def driver_response(_db, _driver_id):
        return GameDriver(
            driver_slug="answer-driver",
            full_name="Answer Driver",
            driver_code="ANS",
            headshot_url=None,
        )

    monkeypatch.setattr(
        GuessGameService, "_driver_response", staticmethod(driver_response)
    )
    values = {
        "driver_slug": "answer-driver",
        "full_name": "Answer Driver",
        "driver_code": "ANS",
        "debut": 2001,
        "last_raced": 2020,
        "country": "Spain",
        "constructor": {"name": "Constructor"},
        "career_peak_label": "World Champion",
    }
    exact = {"state": "exact", "direction": None}
    record = SimpleNamespace(
        sequence=3,
        correct=True,
        guessed_driver_id=2,
        comparison_snapshot={
            "values": values,
            "comparisons": {
                key: exact
                for key in (
                    "debut",
                    "last_raced",
                    "country",
                    "constructor",
                    "career_peak",
                )
            },
            "highlights": [{"id": "championships", "value": "2×", "label": "Champion"}],
        },
        selected_fact_id="career.starts",
        rendered_fact_text="Made 100 Grand Prix starts.",
        constructor_color=None,
    )
    response = await GuessGameService._guess_response(None, record, values, reveal=True)
    assert response.answer and response.answer.full_name == "Answer Driver"
    assert response.highlights and response.highlights[0].id == "championships"


@pytest.mark.asyncio
async def test_signature_constructor_regressions(ingested_data):
    expected = {
        "Sebastian Vettel": "Red Bull Racing",
        "Fernando Alonso": "Renault",
        "Lewis Hamilton": "Mercedes",
    }
    drivers = list(
        (
            await ingested_data.scalars(
                select(Driver).where(Driver.full_name.in_(expected))
            )
        ).all()
    )
    if len(drivers) != len(expected):
        pytest.skip("regression drivers are absent from the configured database")
    attributes = await DriverAttributeService.derive(
        ingested_data, [driver.id for driver in drivers]
    )
    assert {
        driver.full_name: attributes[driver.id].signature_constructor.name
        for driver in drivers
    } == expected
