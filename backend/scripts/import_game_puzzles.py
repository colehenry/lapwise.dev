"""Load frozen board snapshots from `data/game_puzzles` into the `puzzles` table.

The files stay on disk as the authoring output. This moves them into the store
the service reads, so a board can publish on its date without a deploy.

An existing row is updated only while it is a draft. A published board is
immutable under the rules doc, so a changed file against a published row is
reported and skipped rather than written.

Usage:
    PYTHONPATH=$PWD python scripts/import_game_puzzles.py --dry-run
    PYTHONPATH=$PWD python scripts/import_game_puzzles.py
    PYTHONPATH=$PWD python scripts/import_game_puzzles.py --publish
"""

import argparse
import json
import sys
from datetime import date
from pathlib import Path

from sqlalchemy import select

from app.models.game import DEFAULT_ELIGIBILITY_FLOOR, Puzzle
from scripts.ingest.utils import get_db_session

PUZZLE_DIRECTORY = Path(__file__).resolve().parents[1] / "data" / "game_puzzles"

# Column name to snapshot key. The JSON keys are the authoring format and the
# column names are the storage format; they are deliberately not the same for
# the two header fields.
SNAPSHOT_FIELDS = {
    "row_categories": "rows",
    "column_categories": "columns",
    "answers": "answers",
    "rookie_options": "rookie_options",
    "rookie_evidence": "rookie_evidence",
}


def load_files() -> list[dict]:
    boards = []
    for path in sorted(PUZZLE_DIRECTORY.glob("grid-*.json")):
        with path.open(encoding="utf-8") as handle:
            boards.append(json.load(handle))
    return boards


def _published_on(raw: dict) -> date | None:
    value = raw.get("published_on")
    return date.fromisoformat(value) if value else None


def _apply(row: Puzzle, raw: dict, publish: bool) -> None:
    row.number = raw["number"]
    row.public_id = raw["id"]
    row.published_on = _published_on(raw)
    row.answer_version = raw.get("answer_version", 1)
    row.max_guesses = raw.get("max_guesses", 12)
    row.eligibility_floor = raw.get("eligibility_floor", DEFAULT_ELIGIBILITY_FLOOR)
    for column, key in SNAPSHOT_FIELDS.items():
        setattr(row, column, raw.get(key))
    if publish and row.published_on is not None:
        row.status = "published"


def _differs(row: Puzzle, raw: dict) -> bool:
    if row.public_id != raw["id"] or row.published_on != _published_on(raw):
        return True
    return any(
        getattr(row, column) != raw.get(key) for column, key in SNAPSHOT_FIELDS.items()
    )


def import_boards(db, publish: bool, dry_run: bool) -> bool:
    boards = load_files()
    if not boards:
        print(f"No board files under {PUZZLE_DIRECTORY}")
        return False

    existing = {
        row.number: row
        for row in db.execute(
            select(Puzzle).where(Puzzle.number.in_([b["number"] for b in boards]))
        ).scalars()
    }

    ok = True
    for raw in boards:
        number = raw["number"]
        row = existing.get(number)
        cells = len(raw.get("answers") or {})
        evidence = len(raw.get("rookie_evidence") or {})
        label = f"{raw['id']} ({cells} cells, {evidence} evidence records)"

        if row is None:
            if not dry_run:
                new_row = Puzzle()
                _apply(new_row, raw, publish)
                db.add(new_row)
            print(f"  insert {label}")
            continue

        if not _differs(row, raw):
            if publish and row.status != "published" and row.published_on is not None:
                if not dry_run:
                    row.status = "published"
                print(f"  publish {label}")
            else:
                print(f"  unchanged {label}")
            continue

        if row.status == "published":
            print(f"  SKIP {label}: file differs from a published board")
            ok = False
            continue

        if not dry_run:
            _apply(row, raw, publish)
        print(f"  update {label}")

    if dry_run:
        db.rollback()
        print("Dry run; nothing written.")
    else:
        db.commit()
    return ok


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--dry-run", action="store_true", help="Report actions without writing"
    )
    parser.add_argument(
        "--publish",
        action="store_true",
        help="Mark imported boards with a date as published",
    )
    args = parser.parse_args()

    db = get_db_session()
    try:
        ok = import_boards(db, args.publish, args.dry_run)
    finally:
        db.close()

    if not ok:
        sys.exit(1)


if __name__ == "__main__":
    main()
