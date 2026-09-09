"""Rights and quality gates on ingestion.

License filtering, normalization, and source rejection are pure, so they are
tested without network or database.
"""

import dataclasses
import io

import pytest
from PIL import Image

from app.services.media_ingest_service import (
    MIN_LONG_EDGE,
    TARGET_LONG_EDGE,
    IngestRejected,
    check_source,
    normalize,
)
from app.services.media_sources import (
    SourceCandidate,
    license_allowed,
    rank_candidates_for,
)


def jpeg(width: int, height: int) -> bytes:
    buffer = io.BytesIO()
    Image.new("RGB", (width, height), (120, 30, 40)).save(buffer, format="JPEG")
    return buffer.getvalue()


def source(
    license_code: str = "CC BY 4.0",
    width: int = 1200,
    height: int = 1600,
    mime_type: str = "image/jpeg",
) -> SourceCandidate:
    return SourceCandidate(
        filename="x.jpg",
        file_url="https://upload.example/x.jpg",
        page_url="https://commons.example/File:x.jpg",
        width=width,
        height=height,
        mime_type=mime_type,
        thumb_url="https://upload.example/thumb/x.jpg",
        license_code=license_code,
        license_url=None,
        author_name="Photographer",
        attribution_text="Photographer via Wikimedia Commons",
        is_curated=True,
    )


@pytest.mark.parametrize(
    "license_code",
    ["CC0", "Public domain", "CC BY 2.0", "CC BY 4.0", "CC BY-SA 3.0", "CC BY-SA 4.0"],
)
def test_permissive_licenses_accepted(license_code):
    assert license_allowed(license_code) is True


@pytest.mark.parametrize(
    "license_code",
    [
        "CC BY-ND 4.0",  # crops are derivatives
        "CC BY-NC 4.0",  # non-commercial
        "CC BY-NC-SA 4.0",
        "Fair use",
        "GFDL",
        "All rights reserved",
        "",
        None,
    ],
)
def test_restrictive_licenses_rejected(license_code):
    assert license_allowed(license_code) is False


def test_normalize_downscales_to_target_long_edge():
    image = normalize(jpeg(4000, 3000))

    assert max(image.width, image.height) == TARGET_LONG_EDGE
    assert image.was_downscaled is True


def test_normalize_preserves_aspect_ratio():
    image = normalize(jpeg(4000, 2000))

    assert image.width / image.height == pytest.approx(2.0, abs=0.01)


def test_normalize_never_upscales():
    image = normalize(jpeg(800, 900))

    assert (image.width, image.height) == (800, 900)
    assert image.was_downscaled is False


def test_storage_key_is_content_addressed():
    image = normalize(jpeg(1000, 1000))

    assert image.storage_key == f"originals/{image.sha256}.jpg"
    assert len(image.sha256) == 64


def test_identical_sources_produce_identical_keys():
    raw = jpeg(1000, 1000)

    assert normalize(raw).storage_key == normalize(raw).storage_key


def test_check_source_rejects_disallowed_license():
    with pytest.raises(IngestRejected, match="license not permitted"):
        check_source(source(license_code="CC BY-ND 4.0"), "headshot")


def test_check_source_rejects_non_image():
    with pytest.raises(IngestRejected, match="not an image"):
        check_source(source(mime_type="application/pdf"), "headshot")


def test_check_source_rejects_headshot_below_resolution_floor():
    with pytest.raises(IngestRejected, match="below the"):
        check_source(source(width=278, height=350), "headshot")


def test_resolution_floor_applies_only_to_headshots():
    check_source(source(width=278, height=350), "banner")


def test_check_source_accepts_a_good_candidate():
    check_source(source(width=MIN_LONG_EDGE, height=MIN_LONG_EDGE), "headshot")


def named(filename: str, width: int = 900, height: int = 1200) -> SourceCandidate:
    return dataclasses.replace(source(width=width, height=height), filename=filename)


def test_ranking_prefers_cropped_portraits_of_the_named_driver():
    ranked = rank_candidates_for(
        [
            named("Sebastian Vettel bust, Hungaroring.jpg"),
            named("Sebastian Vettel 2022 (cropped).jpg"),
            named("Some other person.jpg"),
        ],
        "Vettel",
        MIN_LONG_EDGE,
    )

    assert ranked[0].filename == "Sebastian Vettel 2022 (cropped).jpg"


def test_ranking_demotes_objects():
    ranked = rank_candidates_for(
        [
            named("Mika Salo - Tyrrell 023 accelerates out of Copse.jpg"),
            named("Mika Salo 110806.jpg"),
        ],
        "Salo",
        MIN_LONG_EDGE,
    )

    assert ranked[0].filename == "Mika Salo 110806.jpg"


def test_ranking_drops_candidates_below_the_floor():
    ranked = rank_candidates_for(
        [named("Eddie Irvine.jpg", width=150, height=192)], "Irvine", MIN_LONG_EDGE
    )

    assert ranked == []


def test_ranking_drops_disallowed_licenses():
    restricted = dataclasses.replace(
        named("Rubens Barrichello (cropped).jpg"), license_code="CC BY-ND 4.0"
    )

    assert rank_candidates_for([restricted], "Barrichello", MIN_LONG_EDGE) == []


def test_ranking_does_not_filter_out_wrong_people():
    """A footballer shares Sergio Perez's name; only a human catches that."""
    ranked = rank_candidates_for(
        [named("Sergio Perez CF Monterrey 2012 FIFA Club World Cup.jpg")],
        "Perez",
        MIN_LONG_EDGE,
    )

    assert len(ranked) == 1
