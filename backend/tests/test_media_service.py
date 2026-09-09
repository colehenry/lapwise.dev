"""Media resolution precedence.

Ranking is pure so the four-tier order can be tested without touching a
database. Constraint behaviour is covered by the migration itself.
"""

import pytest

from app.config import settings
from app.services.media_service import (
    SOURCE_CAREER_FALLBACK,
    SOURCE_EXACT_SEASON,
    SOURCE_LEGACY_RESULT,
    MediaRef,
    MediaService,
    _Candidate,
    public_url,
    rank_candidates,
)


@pytest.fixture(autouse=True)
def storage_configured(monkeypatch):
    """Pin the storage base URL rather than inheriting it.

    `public_url` returns None when storage is unconfigured, and `rank_candidates`
    drops a candidate it cannot build a URL for. Without this these tests pass
    only on a machine that happens to carry B2 credentials, and every ranking
    assertion below becomes a KeyError anywhere else.
    """
    monkeypatch.setattr(settings, "b2_public_base_url", "https://media.test")


def candidate(driver_id: int, year, key: str = "originals/a.jpg") -> _Candidate:
    return _Candidate(
        driver_id=driver_id,
        year=year,
        storage_key=key,
        attribution_text="Photo by X",
        author_name="X",
        license_code="CC-BY-SA-4.0",
        license_url="https://example/license",
        focal_x=0.5,
        focal_y=0.4,
        visual_grade="clean",
    )


def test_exact_season_beats_career_fallback():
    resolved = rank_candidates(
        [
            candidate(1, None, "originals/fallback.jpg"),
            candidate(1, 2022, "originals/mercedes.jpg"),
        ],
        year=2022,
    )

    assert resolved[1].source == SOURCE_EXACT_SEASON
    assert resolved[1].url.endswith("originals/mercedes.jpg")


def test_exact_season_wins_regardless_of_input_order():
    ordered = rank_candidates(
        [
            candidate(1, 2022, "originals/season.jpg"),
            candidate(1, None, "originals/f.jpg"),
        ],
        year=2022,
    )
    reversed_ = rank_candidates(
        [
            candidate(1, None, "originals/f.jpg"),
            candidate(1, 2022, "originals/season.jpg"),
        ],
        year=2022,
    )

    assert ordered[1].url == reversed_[1].url


def test_career_fallback_used_when_season_missing():
    resolved = rank_candidates([candidate(1, None, "originals/f.jpg")], year=2022)

    assert resolved[1].source == SOURCE_CAREER_FALLBACK
    assert resolved[1].url.endswith("originals/f.jpg")


def test_adjacent_season_is_never_borrowed():
    """A 2021 image can show the wrong team, so 2022 must not fall back to it."""
    resolved = rank_candidates([candidate(1, 2021, "originals/2021.jpg")], year=2022)

    assert resolved == {}


def test_season_assignment_ignored_when_no_year_requested():
    resolved = rank_candidates([candidate(1, 2022)], year=None)

    assert resolved == {}


def test_career_fallback_still_resolves_when_no_year_requested():
    resolved = rank_candidates([candidate(1, None)], year=None)

    assert resolved[1].source == SOURCE_CAREER_FALLBACK


def test_each_driver_resolved_independently():
    resolved = rank_candidates(
        [
            candidate(1, 2026, "originals/ferrari.jpg"),
            candidate(2, None, "originals/senna.jpg"),
            candidate(3, 1999, "originals/wrong-year.jpg"),
        ],
        year=2026,
    )

    assert resolved[1].source == SOURCE_EXACT_SEASON
    assert resolved[2].source == SOURCE_CAREER_FALLBACK
    assert 3 not in resolved


def test_provenance_survives_resolution():
    resolved = rank_candidates([candidate(1, None)], year=None)
    ref = resolved[1]

    assert ref.attribution_text == "Photo by X"
    assert ref.license_code == "CC-BY-SA-4.0"
    assert ref.focal_x == 0.5
    assert ref.visual_grade == "clean"


def test_owned_and_legacy_refs_are_distinguishable():
    owned = rank_candidates([candidate(1, None)], year=None)[1]
    legacy = MediaRef(url="https://upstream/x.png", source=SOURCE_LEGACY_RESULT)

    assert owned.is_owned is True
    assert legacy.is_owned is False


def test_unconfigured_storage_yields_no_owned_media(monkeypatch):
    """An unset base must fall back to legacy, not emit a relative 404."""
    from app.services import media_service

    monkeypatch.setattr(media_service.settings, "b2_public_base_url", "")

    assert public_url("originals/a.jpg") is None
    assert rank_candidates([candidate(1, None)], year=None) == {}


def test_public_url_joins_without_double_slash(monkeypatch):
    from app.services import media_service

    monkeypatch.setattr(
        media_service.settings, "b2_public_base_url", "https://cdn.example/file/bucket/"
    )

    assert (
        public_url("/originals/a.jpg")
        == "https://cdn.example/file/bucket/originals/a.jpg"
    )


@pytest.mark.asyncio
async def test_unknown_role_rejected():
    with pytest.raises(ValueError, match="unknown media role"):
        await MediaService.resolve_many(None, [1], 2022, "mugshot")


@pytest.mark.asyncio
async def test_empty_driver_list_short_circuits():
    assert await MediaService.resolve_many(None, [], 2022, "headshot") == {}
