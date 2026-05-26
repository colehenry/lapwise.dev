"""
FastF1 Data Exploration Script

This script helps us understand what data FastF1 provides so we can design
our database schema appropriately.

Run this script to see:
1. What races are available in a season
2. What data structure race results have
3. What fields are available for drivers and teams
"""

import fastf1
import json


def explore_event_schedule(year: int = 2024):
    """
    Fetch and display the race calendar for a given year.

    This shows us what events/races happened and what sessions are available.
    """
    print(f"\n{'=' * 60}")
    print(f"EXPLORING {year} RACE CALENDAR")
    print(f"{'=' * 60}\n")

    # Get the event schedule (this is fast, no heavy downloads)
    schedule = fastf1.get_event_schedule(year)

    print(f"Total events in {year}: {len(schedule)}")
    print(f"\nSchedule columns available:\n{list(schedule.columns)}\n")

    # Show first 3 races as examples
    print("First 3 races:\n")
    print(
        schedule[["RoundNumber", "Country", "Location", "EventName", "EventDate"]].head(
            3
        )
    )

    return schedule


def explore_race_results(year: int = 2024, round_number: int = 2):
    """
    Fetch and display race results for a specific race.

    This is the KEY function - it shows us what data we get about drivers,
    teams, and race results.
    """
    print(f"\n{'=' * 60}")
    print(f"EXPLORING RACE RESULTS: {year} Round {round_number}")
    print(f"{'=' * 60}\n")

    # Step 1: Get the session (specifying year, round, and session type)
    print("Step 1: Getting session object...")
    session = fastf1.get_session(year, round_number, "Race")

    # Step 2: Load the data (this downloads from API - can take 10-30 seconds)
    print("Step 2: Loading data (this may take 10-30 seconds)...")
    session.load()

    print(f"✓ Session loaded: {session.event['EventName']}")
    print(f"  Location: {session.event['Location']}")
    print(f"  Date: {session.event['EventDate']}\n")

    # Step 3: Get the results
    results = session.results

    print(f"Number of drivers: {len(results)}")
    print(f"\nAvailable columns in results:\n{list(results.columns)}\n")

    # Show first 5 finishers
    print("Top 5 finishers:")
    print("-" * 60)

    # Select key columns to display (you'll see ALL columns above)
    display_cols = [
        "Position",
        "Abbreviation",  # 3-letter driver code (e.g., VER, HAM)
        "FullName",
        "TeamName",
        "GridPosition",  # Starting position
        "Status",  # Finished, DNF, etc.
        "Points",
        "HeadshotUrl",
    ]

    print(results[display_cols].head(5))

    print("\n" + "-" * 60)
    print("Sample data for position 1 (winner):")
    print("-" * 60)

    # Show ALL data for the winner so we can see every field
    winner = results.iloc[0]
    for column in results.columns:
        print(f"{column:25s} = {winner[column]}")

    return results


def explore_laps_data(year: int = 2024, round_number: int = 2):
    """
    Fetch and display lap times for a race.

    This shows us lap-by-lap data for all drivers.
    """
    print(f"\n{'=' * 60}")
    print(f"EXPLORING LAP DATA: {year} Round {round_number}")
    print(f"{'=' * 60}\n")

    session = fastf1.get_session(year, round_number, "Race")
    print("Loading session data...")
    session.load()

    laps = session.laps

    print(f"Total laps recorded: {len(laps)}")
    print(f"\nAvailable columns in laps:\n{list(laps.columns)}\n")

    # Show first 5 laps
    print("First 5 laps (any driver):")
    print(
        laps[
            [
                "Driver",
                "LapNumber",
                "LapTime",
                "Sector1Time",
                "Sector2Time",
                "Sector3Time",
                "Compound",
                "TyreLife",
            ]
        ].head(5)
    )

    return laps


def main():
    """
    Main exploration function.

    Uncomment the sections you want to explore!
    """

    # Enable FastF1 cache (speeds up repeated requests)
    # First, ensure the cache directory exists
    import os

    cache_dir = "../cache"
    if not os.path.exists(cache_dir):
        os.makedirs(cache_dir)
        print(f"✓ Created cache directory at {cache_dir}\n")

    fastf1.Cache.enable_cache(cache_dir)

    print("\n" + "=" * 60)
    print("FASTF1 DATA EXPLORATION")
    print("=" * 60)

    try:
        # 1. Explore what races are available
        schedule = explore_event_schedule(2024)

        # 2. Explore race results (finishing positions, drivers, teams)
        results = explore_race_results(2024, 1)  # Round 1 = first race

        # 3. Explore lap data (OPTIONAL - comment out if you want to see results first)
        # laps = explore_laps_data(2024, 1)

        print("\n" + "=" * 60)
        print("EXPLORATION COMPLETE!")
        print("=" * 60)
        print("\nNow you can:")
        print("1. Look at the columns available in results")
        print("2. Think about what database tables you need")
        print("3. Design your database schema")

    except Exception as e:
        print(f"\n❌ Error occurred: {e}")
        print("\nPossible reasons:")
        print("- No internet connection")
        print("- FastF1 API is down")
        print("- Invalid year/round combination")
        print("- Data not available for that race yet")


if __name__ == "__main__":
    main()
