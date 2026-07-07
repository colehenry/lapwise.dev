"""
One-time script: merge duplicate team rows caused by FastF1/Jolpica name mismatches.

For each alias → canonical pair, finds both rows for the same year, re-points all
session_results to the canonical team, then deletes the alias row.
"""

import asyncio
from sqlalchemy import select, update, delete
from app.database import AsyncSessionLocal
from app.models import Team, SessionResult


# (alias_name, canonical_name, year_min, year_max)
# year_min/year_max are inclusive; None means unbounded.
ALIASES_TO_MERGE = [
    ("Red Bull", "Red Bull Racing", None, None),
    ("Alpine F1 Team", "Alpine", None, None),
    ("RB F1 Team", "Racing Bulls", None, None),
    ("Cadillac F1 Team", "Cadillac", None, None),
    # Sauber rebranded to Audi for 2026+
    ("Sauber", "Audi", 2026, None),
]


async def main():
    async with AsyncSessionLocal() as db:
        years_result = await db.execute(
            select(Team.year).distinct().order_by(Team.year)
        )
        years = [r[0] for r in years_result]

        total_merged = 0

        for year in years:
            for alias_name, canonical_name, year_min, year_max in ALIASES_TO_MERGE:
                in_range = (year_min is None or year >= year_min) and (
                    year_max is None or year <= year_max
                )
                if not in_range:
                    continue

                alias_result = await db.execute(
                    select(Team).where(Team.year == year, Team.name == alias_name)
                )
                alias_team = alias_result.scalar_one_or_none()
                if not alias_team:
                    continue

                canonical_result = await db.execute(
                    select(Team).where(Team.year == year, Team.name == canonical_name)
                )
                canonical_team = canonical_result.scalar_one_or_none()
                if not canonical_team:
                    # No canonical counterpart — rename the alias row instead
                    print(
                        f"  {year}: renaming '{alias_name}' → '{canonical_name}' (no canonical found)"
                    )
                    alias_team.name = canonical_name
                    await db.commit()
                    total_merged += 1
                    continue

                # Re-point session_results
                updated = await db.execute(
                    update(SessionResult)
                    .where(SessionResult.team_id == alias_team.id)
                    .values(team_id=canonical_team.id)
                )
                row_count = updated.rowcount

                await db.execute(delete(Team).where(Team.id == alias_team.id))
                await db.commit()

                print(
                    f"  {year}: merged '{alias_name}' (id={alias_team.id}) → "
                    f"'{canonical_name}' (id={canonical_team.id}), "
                    f"moved {row_count} result rows"
                )
                total_merged += 1

        print(f"\nDone. {total_merged} duplicate(s) merged.")


if __name__ == "__main__":
    asyncio.run(main())
