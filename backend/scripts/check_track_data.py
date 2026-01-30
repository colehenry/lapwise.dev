"""
Track Data Verification Script

Checks which circuits have track length data populated and reports
any circuits that are missing this data.

Requirements:
    - PYTHONPATH must include backend directory

Usage:
    PYTHONPATH=$PWD python scripts/check_track_data.py
"""

import asyncio
from app.database import get_db
from app.models import Circuit
from sqlalchemy import select


async def main():
    print("Checking track length data...")
    async for session in get_db():
        result = await session.execute(select(Circuit))
        circuits = result.scalars().all()

        print(f"Found {len(circuits)} circuits.")
        count_with_length = 0
        for circuit in circuits:
            status = "✅" if circuit.track_length_km else "❌"
            if circuit.track_length_km:
                count_with_length += 1
            print(f"{status} {circuit.name}: {circuit.track_length_km} km")

        print(
            f"\nSummary: {count_with_length}/{len(circuits)} circuits have length data."
        )
        break  # Only need one session


if __name__ == "__main__":
    asyncio.run(main())
