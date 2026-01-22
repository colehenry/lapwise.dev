"""
Populate country_code for existing drivers in the database.

This script fetches driver data from FastF1 and updates the country_code
field for all drivers in the database that are missing this information.
"""

import asyncio
import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
import fastf1

from app.database import engine
from app.models import Driver


async def populate_country_codes():
    """Populate country codes for all drivers in the database."""

    print("Starting country code population...")

    # Get all drivers from database
    async with AsyncSession(engine) as session:
        result = await session.execute(select(Driver))
        drivers = result.scalars().all()

        print(f"Found {len(drivers)} drivers in database")

        # Collect country codes from FastF1 sessions
        driver_country_map = {}

        # Check recent seasons to get driver info (2024, 2023, 2022)
        for year in [2024, 2023, 2022, 2021, 2020]:
            print(f"\nFetching driver data from {year} season...")
            try:
                # Get first race of the season
                f1_session = fastf1.get_session(year, 1, 'R')
                f1_session.load()

                # Get driver results
                for _, driver_row in f1_session.results.iterrows():
                    driver_code = driver_row['Abbreviation']
                    country_code = driver_row.get('CountryCode')

                    if driver_code and country_code:
                        if driver_code not in driver_country_map:
                            driver_country_map[driver_code] = country_code
                            print(f"  {driver_code}: {country_code}")

            except Exception as e:
                print(f"  Error loading {year} session: {e}")
                continue

        print(f"\nCollected country codes for {len(driver_country_map)} drivers")

        # Update database
        updated_count = 0
        for driver in drivers:
            if driver.driver_code in driver_country_map:
                country_code = driver_country_map[driver.driver_code]

                # Update the driver
                stmt = (
                    update(Driver)
                    .where(Driver.id == driver.id)
                    .values(country_code=country_code)
                )
                await session.execute(stmt)
                updated_count += 1
                print(f"Updated {driver.driver_code}: {driver.full_name} -> {country_code}")

        # Commit all changes
        await session.commit()

        print(f"\n✅ Successfully updated {updated_count} drivers with country codes!")


if __name__ == "__main__":
    # Enable FastF1 cache
    cache_dir = Path(__file__).parent.parent.parent / "cache"
    cache_dir.mkdir(exist_ok=True)
    fastf1.Cache.enable_cache(str(cache_dir))

    # Run the population
    asyncio.run(populate_country_codes())
