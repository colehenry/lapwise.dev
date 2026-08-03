from types import SimpleNamespace

from app.services.canonical_standings_service import CanonicalStandingsService


def test_provisional_standings_explain_incomplete_season():
    info = CanonicalStandingsService._scoring_info(
        None,
        [
            SimpleNamespace(
                championship_points=25,
                points_scored=25,
                classification_status="provisional",
                scoring_explanation=None,
                scoring_explanation_url=None,
            )
        ],
    )

    assert info.kind == "provisional"
    assert info.short_label == "Provisional standings"
    assert "season is still in progress" in info.explanation
    assert info.comparison_mode == "none"
    assert info.has_discrepancy is False


def test_classification_exception_supplies_header_explanation():
    info = CanonicalStandingsService._scoring_info(
        None,
        [
            SimpleNamespace(
                championship_points=None,
                points_scored=78,
                classification_status="disqualified",
                scoring_explanation="Driver was disqualified from the championship.",
                scoring_explanation_url="https://example.com/official-standings",
            )
        ],
    )

    assert info.kind == "classification_exception"
    assert info.short_label == "Classification exception"
    assert info.explanation == "Driver was disqualified from the championship."
    assert info.source_url == "https://example.com/official-standings"
    assert info.comparison_mode == "note_only"
