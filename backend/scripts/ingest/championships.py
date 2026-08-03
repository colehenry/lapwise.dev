"""Refresh derived canonical classifications after points-bearing sessions."""


def refresh_championship_standings(db, year: int) -> None:
    # Local import avoids a package initialization cycle with the CLI backfill.
    from scripts.backfill_canonical_championships import _backfill_year

    errors = _backfill_year(db, year)
    if errors:
        db.rollback()
        raise RuntimeError(
            f"Canonical standings refresh for {year} blocked: {'; '.join(errors)}"
        )
    db.commit()
