"""Tests for endpoint cache classification."""

from datetime import date

import pytest

from app.cache_policy import NO_STORE, add_vary_header, cache_control_for

TODAY = date(2026, 8, 3)


def directive(path: str) -> str:
    return cache_control_for(path, today=TODAY)


def max_age(path: str) -> int:
    for part in directive(path).split(", "):
        if part.startswith("max-age="):
            return int(part.removeprefix("max-age="))
    raise AssertionError(f"no max-age in {directive(path)}")


@pytest.mark.parametrize(
    "path",
    [
        "/auth/login",
        "/auth/oauth/google",
        "/api/users/me",
        "/api/users/me/favorites",
        "/api/admin/comments",
        "/api/comments/driver/verstappen",
    ],
)
def test_user_scoped_paths_never_enter_a_shared_cache(path):
    assert directive(path) == NO_STORE


@pytest.mark.parametrize(
    "path",
    [
        "/",
        "/health",
        "/api/unknown-future-endpoint",
        "/api/results",
    ],
)
def test_unclassified_paths_default_to_no_store(path):
    assert directive(path) == NO_STORE


def test_completed_season_results_outlive_the_running_season():
    completed = max_age("/api/results/2024/standings")
    running = max_age("/api/results/2026/standings")

    assert completed > running
    assert completed == 7 * 24 * 3600
    assert running == 60


@pytest.mark.parametrize(
    "path",
    [
        "/api/results/2024",
        "/api/results/2024/standings",
        "/api/results/2024/11/weekend",
        "/api/results/2024/11/lap-times",
    ],
)
def test_every_completed_season_path_is_long_lived(path):
    assert max_age(path) == 7 * 24 * 3600


def test_running_season_carries_stale_while_revalidate():
    assert "stale-while-revalidate=300" in directive("/api/results/2026/standings")


def test_season_metadata_is_hour_scale():
    assert max_age("/api/results/seasons") == 3600
    assert max_age("/api/replay/seasons") == 3600
    assert max_age("/api/replay/available") == 3600


def test_latest_round_refreshes_faster_than_season_metadata():
    assert max_age("/api/results/latest") < max_age("/api/results/seasons")


@pytest.mark.parametrize(
    "path",
    [
        "/api/drivers/",
        "/api/drivers/verstappen",
        "/api/constructors/",
        "/api/constructors/ferrari",
        "/api/circuits/",
        "/api/circuits/14",
        "/api/events/upcoming",
        "/api/game/daily",
        "/api/game/drivers",
    ],
)
def test_archive_endpoints_are_publicly_cacheable(path):
    assert directive(path).startswith("public, max-age=600")


def test_replay_track_geometry_is_treated_as_a_static_asset():
    assert max_age("/api/replay/track/14") == 7 * 24 * 3600


def test_daily_game_refreshes_without_caching_guess_submissions():
    assert max_age("/api/game/daily") == 300
    assert directive("/api/game/daily/guess") == NO_STORE


def test_public_directives_are_marked_public():
    assert directive("/api/drivers/").startswith("public,")
    assert directive("/api/results/2024/standings").startswith("public,")


def test_next_season_is_not_treated_as_completed():
    # A season that has not started yet must not inherit the long TTL.
    assert max_age("/api/results/2027/standings") == 60


class _Response:
    def __init__(self, headers=None):
        self.headers = dict(headers or {})


def test_vary_is_set_when_absent():
    response = _Response()
    add_vary_header(response, "X-API-Key")
    assert response.headers["Vary"] == "X-API-Key"


def test_vary_preserves_an_upstream_field():
    response = _Response({"Vary": "Accept-Encoding"})
    add_vary_header(response, "X-API-Key")
    assert response.headers["Vary"] == "Accept-Encoding, X-API-Key"


def test_vary_does_not_repeat_a_field():
    response = _Response({"Vary": "accept-encoding, x-api-key"})
    add_vary_header(response, "X-API-Key")
    assert response.headers["Vary"] == "accept-encoding, x-api-key"
