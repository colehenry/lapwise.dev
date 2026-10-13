"""Geometry parity, restartable backfills, and small reads for the console."""

import gzip
from datetime import date

import msgpack
import pytest
from sqlalchemy import delete, select, update

from app.config import settings
from app.models import (
    Circuit,
    CircuitVenue,
    Constructor,
    Driver,
    Lap,
    ReplayData,
    SessionResult,
    Team,
)
from app.models import Session as RaceSession
from app.services.console_replay_service import ConsoleReplayService
from app.services.replay_artifact_service import (
    build_replay_artifacts,
    track_geometry_artifact,
    track_geometry_from_blob,
)
from app.services.replay_geometry_backfill_service import backfill_track_geometry
from app.services.replay_service import ReplayService
from scripts.ingest.utils import get_db_session
from tests.perf.statement_counter import count_statements

TRACK = {
    "polyline": [[0.123456, 1.234567], [100.987654, 99.876543]],
    "rotation_deg": 12.345,
    "corners": [{"x": 0.123456, "y": 1.234567, "number": 1, "letter": "A"}],
    "drs_zones": [[[0.123456, 1.234567], [100.987654, 99.876543]]],
}


def payload(track=TRACK):
    return {
        "metadata": {
            "total_frames": 20,
            "fps": 10,
            "total_duration_seconds": 2,
            "total_laps": 1,
        },
        "track": track,
        "drivers": {"GEO": {"color": "", "full_name": "Geometry Driver"}},
        "frames": [
            {
                "t": i / 10,
                "lap": 1,
                "sc": 0,
                "d": {"GEO": [0, 1, 200, 7, 0, 1, 1, 1, 1, 90, 0]},
            }
            for i in range(20)
        ],
        "race_control": [],
    }


def blob(track=TRACK):
    return gzip.compress(msgpack.packb(payload(track), use_bin_type=True), mtime=0)


def test_all_artifacts_preserve_the_canonical_track_at_source_precision():
    full, metadata = build_replay_artifacts(payload())
    assert msgpack.unpackb(gzip.decompress(full), raw=False)["track"] == TRACK
    assert (
        msgpack.unpackb(gzip.decompress(metadata["preview_data"]), raw=False)["track"]
        == TRACK
    )
    assert metadata["track_geometry"] == TRACK
    assert metadata["track_geometry_refreshed_at"].tzinfo is not None
    assert metadata["compressed_size_bytes"] == len(full)


def test_backfill_does_not_decode_the_frame_array(monkeypatch):
    # An incomplete frame array makes whole-payload decoding fail. Geometry
    # precedes it in canonical replays, so extracting the small artifact works.
    packer = msgpack.Packer(use_bin_type=True)
    prefix = packer.pack_map_header(2) + packer.pack("track") + packer.pack(TRACK)
    prefix += packer.pack("frames") + packer.pack_array_header(1)
    with pytest.raises(ValueError):
        msgpack.unpackb(prefix, raw=False)
    assert track_geometry_from_blob(gzip.compress(prefix)) == TRACK


@pytest.mark.parametrize("track", [None, {}, {"polyline": []}])
def test_missing_geometry_is_an_explicit_null(track):
    assert track_geometry_artifact(track) is None
    assert track_geometry_from_blob(blob(track)) is None


@pytest.fixture
def geometry_rows():
    with get_db_session() as db:
        venue = CircuitVenue(
            slug="geometry-test-venue",
            canonical_name="Geometry Park",
            location="Test",
            country="Test",
        )
        constructor = Constructor(
            slug="geometry-test-constructor", canonical_name="Geometry Team"
        )
        driver = Driver(
            slug="geometry-test-driver", driver_code="GEO", full_name="Geometry Driver"
        )
        db.add_all([venue, constructor, driver])
        db.flush()
        circuit = Circuit(
            venue_id=venue.id,
            layout_slug="geometry-test-layout",
            name="Geometry Park",
            location="Test",
            country="Test",
        )
        team = Team(year=2032, constructor_id=constructor.id, name="Geometry Team")
        db.add_all([circuit, team])
        db.flush()
        races = [
            RaceSession(
                year=year,
                round=1,
                session_type="race",
                event_name=f"Geometry {year}",
                date=date(year, 1, 1),
                circuit_id=circuit.id,
            )
            for year in [2031, 2032]
        ]
        db.add_all(races)
        db.flush()
        replays = [
            ReplayData(
                session_id=race.id,
                total_frames=20,
                total_duration_seconds=2,
                total_laps=4,
                driver_count=1,
                compressed_size_bytes=len(blob()),
                data=blob(),
            )
            for race in races
        ]
        db.add_all(replays)
        db.add(
            SessionResult(
                session_id=races[-1].id,
                driver_id=driver.id,
                team_id=team.id,
                status="Finished",
                position=1,
            )
        )
        db.add_all(
            [
                Lap(
                    session_id=races[-1].id,
                    driver_id=driver.id,
                    lap_number=i,
                    lap_start_time_seconds=i * 100,
                    lap_time_seconds=90,
                    position=1,
                    compound="SOFT",
                )
                for i in range(1, 5)
            ]
        )
        db.commit()
        ids = [row.id for row in replays]
        race_ids = [race.id for race in races]
        try:
            yield db, circuit.id, ids
        finally:
            db.rollback()
            db.execute(delete(RaceSession).where(RaceSession.id.in_(race_ids)))
            for model, row in [
                (Team, team),
                (Driver, driver),
                (Circuit, circuit),
                (Constructor, constructor),
                (CircuitVenue, venue),
            ]:
                db.execute(delete(model).where(model.id == row.id))
            db.commit()


def test_backfill_is_restartable_and_regeneration_replaces_the_artifact(geometry_rows):
    db, _, ids = geometry_rows
    assert backfill_track_geometry(db, limit=1)["written"] == 1
    assert backfill_track_geometry(db)["written"] == 1
    assert backfill_track_geometry(db)["written"] == 0
    assert db.scalar(select(ReplayData.data).where(ReplayData.id == ids[-1])) == blob()
    revised = {**TRACK, "rotation_deg": 90}
    db.execute(
        update(ReplayData).where(ReplayData.id == ids[-1]).values(data=blob(revised))
    )
    db.commit()
    assert backfill_track_geometry(db, force=True, limit=2)["written"] == 2
    assert (
        db.scalar(select(ReplayData.track_geometry).where(ReplayData.id == ids[-1]))
        == revised
    )


def test_empty_artifacts_are_marked_complete_and_failures_can_retry(geometry_rows):
    db, _, ids = geometry_rows
    db.execute(
        update(ReplayData).where(ReplayData.id == ids[-1]).values(data=blob(None))
    )
    db.execute(
        update(ReplayData).where(ReplayData.id == ids[0]).values(data=b"invalid")
    )
    db.commit()
    counts = backfill_track_geometry(db)
    assert counts["empty"] == 1 and counts["failed"] == 1
    assert (
        db.scalar(
            select(ReplayData.track_geometry_refreshed_at).where(
                ReplayData.id == ids[-1]
            )
        )
        is not None
    )
    assert (
        db.scalar(
            select(ReplayData.track_geometry_refreshed_at).where(
                ReplayData.id == ids[0]
            )
        )
        is None
    )
    db.execute(update(ReplayData).where(ReplayData.id == ids[0]).values(data=blob()))
    db.commit()
    assert backfill_track_geometry(db) == {
        "written": 1,
        "empty": 0,
        "skipped": 0,
        "failed": 0,
    }


async def test_geometry_and_console_reads_never_select_the_full_blob(
    geometry_rows, db_session
):
    db, circuit_id, _ = geometry_rows
    backfill_track_geometry(db)
    with count_statements() as counter:
        track = await ReplayService.get_latest_track_geometry(db_session, circuit_id)
        console = await ConsoleReplayService.get_console_replay(db_session, 2032, 1)
    assert track.track.model_dump() == TRACK
    assert track.season == 2032
    assert console.track == track
    for statement in counter.statements:
        assert "replay_data.data" not in statement.lower(), counter.report()


async def test_missing_geometry_keeps_the_console_and_does_not_use_an_older_outline(
    geometry_rows, db_session
):
    db, circuit_id, ids = geometry_rows
    backfill_track_geometry(db)
    db.execute(
        update(ReplayData).where(ReplayData.id == ids[-1]).values(track_geometry=None)
    )
    db.commit()
    assert await ReplayService.get_latest_track_geometry(db_session, circuit_id) is None
    console = await ConsoleReplayService.get_console_replay(db_session, 2032, 1)
    assert console.cars and console.track is None


async def test_versioned_console_includes_geometry_and_preserves_legacy_clients(
    geometry_rows, client
):
    db, _, _ = geometry_rows
    backfill_track_geometry(db)
    headers = {"X-API-Key": settings.lapwise_api_key}
    original = await client.get("/api/replay/console/2032/1", headers=headers)
    versioned = await client.get("/api/replay/console/2032/1/v2", headers=headers)
    assert original.status_code == versioned.status_code == 200
    assert original.json() == versioned.json()
    assert versioned.json()["track"]["track"] == TRACK
    assert "max-age=604800" in versioned.headers["cache-control"]
    missing = await client.get("/api/replay/console/2032/99/v2", headers=headers)
    assert missing.status_code == 404
    assert missing.headers["cache-control"] == "private, no-store"
