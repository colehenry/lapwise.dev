"""
Manual smoke script: ingest one F1 session through the production pipeline.

This is intentionally not named test_*.py so pytest does not collect it.

Usage:
    PYTHONPATH=$PWD python scripts/ingest_single_session_smoke.py
    PYTHONPATH=$PWD python scripts/ingest_single_session_smoke.py 2026 5 race
"""

import os
import sys

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from scripts.ingest_single import main as ingest_single_main

if __name__ == "__main__":
    year = sys.argv[1] if len(sys.argv) > 1 else "2024"
    round_num = sys.argv[2] if len(sys.argv) > 2 else "1"
    session_type = sys.argv[3] if len(sys.argv) > 3 else "race"

    print("=" * 70)
    print("SINGLE SESSION INGESTION SMOKE")
    print(f"Session: {year} R{round_num} {session_type}")
    print("=" * 70)
    print()

    sys.argv = ["scripts/ingest_single.py", year, round_num, session_type]
    ingest_single_main()

    print()
    print("=" * 70)
    print("SMOKE COMPLETE")
    print("=" * 70)
