"""
Highlights Video Ingestion Module

Searches YouTube for official F1 highlights videos using yt-dlp
and stores the video IDs in the sessions table.

Supports all session types: race, qualifying, sprint_race, sprint_qualifying.

Requirements:
    - yt-dlp installed (pip install yt-dlp)
"""

import subprocess
import json
import re
from sqlalchemy import select, update
from app.models.session import Session


F1_CHANNEL_ID = "UCB_qr75-ydFVKSz9nCqgPig"

# Maps session_type to YouTube search keywords
SESSION_SEARCH_TERMS = {
    "race": ["Race Highlights"],
    "qualifying": ["Qualifying Highlights"],
    "sprint_race": ["Sprint Highlights", "Sprint Race Highlights"],
    "sprint_qualifying": [
        "Sprint Qualifying Highlights",
        "Sprint Shootout Highlights",
    ],
}

# Keywords to verify in the video title (lowercase)
SESSION_TITLE_KEYWORDS = {
    "race": ["highlight", "race"],
    "qualifying": ["highlight", "qualifying"],
    "sprint_race": ["highlight", "sprint"],
    "sprint_qualifying": ["highlight", "sprint", "qualifying"],
}


def find_highlights_video_id(event_name, year, session_type="race"):
    """
    Search YouTube for an official F1 highlights video.

    Uses yt-dlp to search YouTube, filtering for the official
    FORMULA 1 channel. Returns the video ID if found, else None.
    """
    search_terms = SESSION_SEARCH_TERMS.get(session_type, ["Highlights"])
    event_name_clean = re.sub(r"\s+", " ", event_name).strip()
    search_queries = [
        f"{search_term} {year} {event_name_clean}" for search_term in search_terms
    ] + [f"{year} {event_name_clean} Highlights Formula 1"]

    try:
        keywords = SESSION_TITLE_KEYWORDS.get(session_type, ["highlight"])
        for search_query in search_queries:
            result = subprocess.run(
                [
                    "yt-dlp",
                    f"ytsearch12:{search_query}",
                    "--dump-json",
                    "--flat-playlist",
                    "--no-download",
                    "--no-warnings",
                ],
                capture_output=True,
                text=True,
                timeout=30,
            )

            if result.returncode != 0:
                print(f"    yt-dlp error: {result.stderr[:200]}")
                continue

            for line in result.stdout.strip().split("\n"):
                if not line:
                    continue
                try:
                    entry = json.loads(line)
                except json.JSONDecodeError:
                    continue

                channel_id = entry.get("channel_id", "")
                channel = entry.get("channel", "")
                title = entry.get("title", "").lower()

                is_f1 = channel_id == F1_CHANNEL_ID or "formula 1" in channel.lower()
                is_match = all(kw in title for kw in keywords)

                if is_f1 and is_match:
                    video_id = entry.get("id")
                    print(f"    Found: {entry.get('title')} ({video_id})")
                    return video_id

        print(
            "    No highlights found for:"
            f" {year} {event_name_clean} [{session_type}]"
        )
        return None

    except subprocess.TimeoutExpired:
        print(f"    Timeout searching for: {year} {event_name_clean} [{session_type}]")
        return None
    except FileNotFoundError:
        print("    ERROR: yt-dlp not installed. " "Run: pip install yt-dlp")
        return None


def ingest_highlights(db_session, season, round_num=None, overwrite=False):
    """
    Ingest YouTube highlights video IDs for all session types.

    Args:
        db_session: SQLAlchemy session
        season: Year to ingest (e.g. 2024)
        round_num: Optional specific round. If None, all rounds.
    """
    query = select(Session).where(Session.year == season)
    if round_num is not None:
        query = query.where(Session.round == round_num)

    query = query.order_by(Session.round, Session.session_type)

    sessions = db_session.execute(query).scalars().all()

    if not sessions:
        print(f"No sessions found for {season}")
        return

    found = 0
    skipped = 0
    failed = 0
    no_search = 0

    for sess in sessions:
        if sess.session_type not in SESSION_SEARCH_TERMS:
            no_search += 1
            continue

        label = f"R{sess.round:02d} [{sess.session_type}]"

        if sess.highlights_video_id and not overwrite:
            print(f"  {label} {sess.event_name}" " — already has video, skipping")
            skipped += 1
            continue

        print(f"  {label} {sess.event_name} — searching...")
        video_id = find_highlights_video_id(sess.event_name, season, sess.session_type)

        if video_id:
            db_session.execute(
                update(Session)
                .where(Session.id == sess.id)
                .values(highlights_video_id=video_id)
            )
            db_session.commit()
            found += 1
        else:
            failed += 1

    print(
        f"\nDone: {found} found, {skipped} skipped, "
        f"{failed} not found, {no_search} not applicable"
    )
    return {
        "season": season,
        "found": found,
        "skipped": skipped,
        "failed": failed,
        "no_search": no_search,
    }
