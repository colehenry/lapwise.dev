"""
Fold provisional constructors into the season team they duplicate.

An id-less ingest (Sprint Qualifying, practice reserves) that ran before the
season-team fallback existed minted a `lapwise-provisional` constructor for
every team on the grid. Each one shadows a source-backed constructor whose
season team carries the same name, splitting that team's results in two.

For every provisional constructor whose season team name matches exactly one
source-backed team in the same year: re-point its session results, delete its
team and constructor rows, and resolve the identity issue that reported it.

Usage:
    PYTHONPATH=$PWD python scripts/merge_provisional_constructors.py
    PYTHONPATH=$PWD python scripts/merge_provisional_constructors.py --apply

Dry-run by default; --apply commits.
"""

from __future__ import annotations

import argparse
import sys

from sqlalchemy import delete, select, update

from app.models import (
    Constructor,
    ConstructorExternalId,
    IngestIdentityIssue,
    SessionResult,
    Team,
)
from scripts.ingest.utils import get_db_session


def _provisional_teams(db) -> list[Team]:
    provisional_ids = select(ConstructorExternalId.constructor_id).where(
        ConstructorExternalId.source == "lapwise-provisional"
    )
    backed_ids = select(ConstructorExternalId.constructor_id).where(
        ConstructorExternalId.source != "lapwise-provisional"
    )
    return list(
        db.execute(
            select(Team)
            .where(Team.constructor_id.in_(provisional_ids))
            .where(Team.constructor_id.not_in(backed_ids))
            .order_by(Team.year, Team.name)
        ).scalars()
    )


def _canonical_team(db, provisional: Team) -> Team | None:
    backed_ids = select(ConstructorExternalId.constructor_id).where(
        ConstructorExternalId.source != "lapwise-provisional"
    )
    matches = list(
        db.execute(
            select(Team).where(
                Team.year == provisional.year,
                Team.name == provisional.name,
                Team.id != provisional.id,
                Team.constructor_id.in_(backed_ids),
            )
        ).scalars()
    )
    return matches[0] if len(matches) == 1 else None


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args(argv)

    db = get_db_session()
    try:
        merged = 0
        for provisional in _provisional_teams(db):
            canonical = _canonical_team(db, provisional)
            if canonical is None:
                print(
                    f"skip {provisional.year} {provisional.name!r}: "
                    "no single source-backed team to merge into"
                )
                continue

            moved = db.execute(
                update(SessionResult)
                .where(SessionResult.team_id == provisional.id)
                .values(team_id=canonical.id)
            ).rowcount
            db.execute(delete(Team).where(Team.id == provisional.id))
            db.execute(
                delete(Constructor).where(Constructor.id == provisional.constructor_id)
            )
            db.execute(
                update(IngestIdentityIssue)
                .where(
                    IngestIdentityIssue.entity_type == "constructor",
                    IngestIdentityIssue.year == provisional.year,
                    IngestIdentityIssue.raw_name == provisional.source_name,
                    IngestIdentityIssue.status == "open",
                )
                .values(status="resolved")
            )
            print(
                f"{provisional.year} {provisional.name!r}: constructor "
                f"{provisional.constructor_id} -> {canonical.constructor_id}, "
                f"moved {moved} result rows"
            )
            merged += 1

        if args.apply:
            db.commit()
            print(f"\nMerged {merged} provisional constructors.")
        else:
            db.rollback()
            print(f"\nDry run: {merged} would merge. Re-run with --apply to commit.")
    finally:
        db.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
