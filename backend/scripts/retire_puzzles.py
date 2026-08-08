"""Delete boards from the editorial queue.

The admin API refuses to delete anything but a draft, because a published board
is a record rather than a proposal. That leaves no route to retire a board that
should never have published, which is what this is for.

The guard is sessions, not status. A board nobody has played is a proposal
whatever its status column says; a board with a single recorded attempt is a
result, and deleting it destroys that player's time. Once sessions accumulate
this script refuses on its own rather than relying on anyone remembering.

Usage:
    PYTHONPATH=$PWD python scripts/retire_puzzles.py --all --dry-run
    PYTHONPATH=$PWD python scripts/retire_puzzles.py --boards 1-5
"""

import argparse
import sys

from sqlalchemy import func, select

from app.models.game import GameSession, Puzzle
from scripts.ingest.utils import get_db_session


def _parse_boards(spec: str) -> list[int]:
    if "-" in spec:
        start, end = (int(part) for part in spec.split("-", 1))
        return list(range(start, end + 1))
    return [int(spec)]


def retire(db, numbers: list[int] | None, dry_run: bool) -> bool:
    statement = select(
        Puzzle.id,
        Puzzle.number,
        Puzzle.public_id,
        Puzzle.status,
        Puzzle.published_on,
        func.count(GameSession.id).label("sessions"),
    ).outerjoin(GameSession, GameSession.puzzle_id == Puzzle.id)
    if numbers is not None:
        statement = statement.where(Puzzle.number.in_(numbers))
    rows = db.execute(
        statement.group_by(Puzzle.id, Puzzle.number, Puzzle.public_id).order_by(
            Puzzle.number
        )
    ).all()

    if not rows:
        print("No matching boards.")
        return True

    played = [row for row in rows if row.sessions]
    for row in rows:
        mark = "REFUSE" if row.sessions else "delete"
        played_note = f", {row.sessions} session(s)" if row.sessions else ""
        print(
            f"  {mark} #{row.number} {row.public_id}"
            f" [{row.status} {row.published_on or 'undated'}{played_note}]"
        )

    if played:
        print(f"\n{len(played)} board(s) have recorded sessions and were not deleted.")
        return False

    if dry_run:
        print("\nDry run; nothing deleted.")
        return True

    db.execute(Puzzle.__table__.delete().where(Puzzle.id.in_([r.id for r in rows])))
    db.commit()
    print(f"\nDeleted {len(rows)} board(s).")
    return True


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--boards", default=None, help="Board number or range")
    parser.add_argument("--all", action="store_true", help="Every board")
    parser.add_argument("--dry-run", action="store_true", help="Report only")
    args = parser.parse_args()

    if not args.all and args.boards is None:
        parser.error("choose --boards or --all")

    db = get_db_session()
    try:
        ok = retire(db, None if args.all else _parse_boards(args.boards), args.dry_run)
    finally:
        db.close()

    if not ok:
        sys.exit(1)


if __name__ == "__main__":
    main()
