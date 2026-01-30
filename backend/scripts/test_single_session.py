"""
Test Script: Ingest Single Session

Tests the ingestion of all 4 data sources for a single session.
Usage: PYTHONPATH=$PWD python scripts/test_single_session.py
"""

import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from scripts.ingest_season import ingest_season

# Test with 2024 Bahrain GP (Round 1), Race only
if __name__ == "__main__":
    print("=" * 70)
    print("TESTING SINGLE SESSION INGESTION")
    print("Session: 2024 Bahrain GP (Round 1) - Race")
    print("=" * 70)
    print()

    # Ingest only race for round 1 of 2024
    # We'll pass session types as 'race' only
    ingest_season(2024, session_types=["race"], strict_mode=False)

    print()
    print("=" * 70)
    print("TEST COMPLETE!")
    print("Check the output above for:")
    print("  - Lap data ingested")
    print("  - Weather data ingested")
    print("  - Track status data ingested")
    print("  - Race control messages ingested")
    print("=" * 70)
