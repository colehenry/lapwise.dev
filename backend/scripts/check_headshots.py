"""Check headshot coverage stats."""
import asyncio
import sys

sys.path.insert(0, "/Users/colehenry/Documents/github/lapwise/lapwise.dev/backend")

from app.database import AsyncSessionLocal
from sqlalchemy import text


async def check():
    async with AsyncSessionLocal() as db:
        r = await db.execute(
            text("SELECT COUNT(DISTINCT driver_id) FROM session_results")
        )
        total = r.scalar()

        r = await db.execute(
            text(
                "SELECT COUNT(DISTINCT driver_id) FROM session_results "
                "WHERE headshot_url IS NOT NULL "
                "AND headshot_url != 'None' "
                "AND headshot_url != 'nan' "
                "AND headshot_url LIKE 'http%'"
            )
        )
        with_photo = r.scalar()

        print(f"Total drivers with results: {total}")
        print(f"With headshot: {with_photo}")
        print(f"Without headshot: {total - with_photo}")
        print(f"Coverage: {with_photo/total*100:.1f}%")

        # Show remaining without
        r = await db.execute(
            text(
                "SELECT d.driver_code, d.full_name "
                "FROM drivers d "
                "JOIN session_results sr ON sr.driver_id = d.id "
                "WHERE d.id NOT IN ("
                "  SELECT DISTINCT sr2.driver_id FROM session_results sr2 "
                "  WHERE sr2.headshot_url IS NOT NULL "
                "  AND sr2.headshot_url != 'None' "
                "  AND sr2.headshot_url != 'nan' "
                "  AND sr2.headshot_url LIKE 'http%'"
                ") "
                "GROUP BY d.driver_code, d.full_name "
                "ORDER BY d.full_name"
            )
        )
        rows = r.fetchall()
        if rows:
            print(f"\nRemaining without headshots:")
            for row in rows:
                print(f"  {row[0] or '---':6s} {row[1]}")


asyncio.run(check())
