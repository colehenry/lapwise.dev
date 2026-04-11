"""
Summary Service

Generates AI summaries for F1 sessions using Claude Haiku.
Designed for sync usage in ingestion scripts.
"""

import json
from sqlalchemy import select
from sqlalchemy.orm import Session as DBSession

from app.models import (
    Session,
    SessionResult,
    Driver,
    Team,
    Weather,
    TrackStatus,
    SessionSummary,
)
from app.config import settings

MODEL_ID = "claude-haiku-4-5-20251001"


class SummaryService:
    """Generates and stores AI session summaries."""

    @staticmethod
    def generate_summary(db: DBSession, session_id: int) -> SessionSummary | None:
        """
        Generate an AI summary for a session.

        Returns the created SessionSummary, or None if generation fails.
        """
        # Skip if summary already exists
        existing = db.execute(
            select(SessionSummary).where(SessionSummary.session_id == session_id)
        ).scalar_one_or_none()
        if existing:
            print(f"  ✓ Summary already exists for session {session_id}")
            return existing

        # Load session data
        session = db.execute(
            select(Session).where(Session.id == session_id)
        ).scalar_one_or_none()
        if not session:
            print(f"  ✗ Session {session_id} not found")
            return None

        # Load results with driver/team info
        results = db.execute(
            select(SessionResult, Driver, Team)
            .join(Driver, SessionResult.driver_id == Driver.id)
            .join(Team, SessionResult.team_id == Team.id)
            .where(SessionResult.session_id == session_id)
            .order_by(SessionResult.position)
        ).all()

        if not results:
            print(f"  ✗ No results for session {session_id}")
            return None

        # Load weather data
        weather_rows = (
            db.execute(
                select(Weather)
                .where(Weather.session_id == session_id)
                .order_by(Weather.session_time_seconds)
            )
            .scalars()
            .all()
        )

        # Load track status (safety cars, red flags, etc.)
        track_status_rows = (
            db.execute(
                select(TrackStatus)
                .where(TrackStatus.session_id == session_id)
                .order_by(TrackStatus.session_time_seconds)
            )
            .scalars()
            .all()
        )

        # Try to fetch YouTube transcript
        transcript_text = None
        if session.highlights_video_id:
            transcript_text = SummaryService._fetch_transcript(
                session.highlights_video_id
            )

        # Build the prompt
        prompt = SummaryService._build_prompt(
            session, results, weather_rows, track_status_rows, transcript_text
        )

        # Call Claude
        summary_data = SummaryService._call_claude(prompt)
        if not summary_data:
            return None

        # Store summary
        summary = SessionSummary(
            session_id=session_id,
            summary_text=summary_data["summary"],
            key_facts=json.dumps(summary_data["top_3"]),
            model_used=MODEL_ID,
            tokens_used=summary_data.get("tokens_used"),
        )
        db.add(summary)
        db.commit()
        db.refresh(summary)

        print(
            f"  ✓ Generated summary for {session.event_name} [{session.session_type}]"
        )
        return summary

    @staticmethod
    def _build_prompt(session, results, weather_rows, track_status_rows, transcript):
        """Build a structured prompt for Claude based on session data."""
        session_type = session.session_type
        event_name = session.event_name
        year = session.year
        round_num = session.round

        # Results table
        results_lines = []
        for row in results:
            sr = row.SessionResult
            driver = row.Driver
            team = row.Team
            if session_type in ("qualifying", "sprint_qualifying"):
                times = []
                if sr.q1_time_seconds:
                    times.append(f"Q1: {sr.q1_time_seconds:.3f}s")
                if sr.q2_time_seconds:
                    times.append(f"Q2: {sr.q2_time_seconds:.3f}s")
                if sr.q3_time_seconds:
                    times.append(f"Q3: {sr.q3_time_seconds:.3f}s")
                time_str = ", ".join(times) if times else "No time"
                results_lines.append(
                    f"P{sr.position}: {driver.full_name} ({team.name}) - {time_str}"
                )
            else:
                time_str = f"{sr.time_seconds:.3f}s" if sr.time_seconds else sr.status
                pts = f" [{sr.points}pts]" if sr.points else ""
                fl = " [FASTEST LAP]" if sr.fastest_lap else ""
                grid = f" (Grid: P{sr.grid_position})" if sr.grid_position else ""
                results_lines.append(
                    f"P{sr.position}: {driver.full_name} ({team.name})"
                    f" - {time_str}{grid}{pts}{fl}"
                )
        results_text = "\n".join(results_lines)

        # DNFs
        dnfs = [
            f"{row.Driver.full_name} ({row.SessionResult.status})"
            for row in results
            if row.SessionResult.status
            and row.SessionResult.status
            not in ("Finished", "+1 Lap", "+2 Laps", "Unknown")
            and "Lap" not in str(row.SessionResult.status)
        ]
        dnf_text = (
            f"\nRetirements/DNFs: {', '.join(dnfs)}" if dnfs else "\nNo retirements."
        )

        # Weather summary
        weather_text = ""
        if weather_rows:
            first_w = weather_rows[0]
            last_w = weather_rows[-1]
            rain = any(w.rainfall for w in weather_rows)
            weather_text = (
                f"\nWeather: Air {first_w.air_temp}-{last_w.air_temp}°C, "
                f"Track {first_w.track_temp}-{last_w.track_temp}°C"
                f"{', RAIN' if rain else ', Dry'}"
            )

        # Track status events (safety cars, red flags)
        status_labels = {
            "1": "Green",
            "2": "Yellow Flag",
            "4": "Safety Car",
            "5": "Red Flag",
            "6": "VSC",
            "7": "VSC Ending",
        }
        notable_events = [
            f"- {status_labels.get(ts.status, ts.status)}: {ts.message}"
            for ts in track_status_rows
            if ts.status in ("4", "5", "6")
        ]
        track_events_text = (
            "\n\nNotable track events:\n" + "\n".join(notable_events)
            if notable_events
            else ""
        )

        # Transcript context
        transcript_section = ""
        if transcript:
            # Truncate to ~3000 chars to keep prompt reasonable
            truncated = transcript[:3000]
            transcript_section = (
                f"\n\nYouTube highlights transcript (additional context):\n{truncated}"
            )

        # Session type label
        type_labels = {
            "race": "Race",
            "qualifying": "Qualifying",
            "sprint_race": "Sprint Race",
            "sprint_qualifying": "Sprint Qualifying",
            "fp1": "Free Practice 1",
            "fp2": "Free Practice 2",
            "fp3": "Free Practice 3",
        }
        session_label = type_labels.get(session_type, session_type)

        prompt = f"""You are an expert Formula 1 analyst. Analyze the following {session_label} session data from the {year} {event_name} (Round {round_num}).

RESULTS:
{results_text}
{dnf_text}
{weather_text}
{track_events_text}
{transcript_section}

Based on this data, provide:
1. A concise 2-3 paragraph narrative summary of the session highlighting the key storylines
2. The top 3 most important, surprising, or dramatic things that happened

You MUST respond with valid JSON in this exact format:
{{
  "summary": "Your 2-3 paragraph narrative summary here...",
  "top_3": [
    {{"headline": "Short headline", "detail": "1-2 sentence explanation"}},
    {{"headline": "Short headline", "detail": "1-2 sentence explanation"}},
    {{"headline": "Short headline", "detail": "1-2 sentence explanation"}}
  ]
}}

Be specific with driver names, lap times, and positions. Highlight unexpected results, dramatic moments, and championship implications. Use an engaging but factual tone."""

        return prompt

    @staticmethod
    def _call_claude(prompt: str) -> dict | None:
        """Call Claude Haiku and parse the JSON response."""
        if not settings.anthropic_api_key:
            print("  ✗ ANTHROPIC_API_KEY not set, skipping summary generation")
            return None

        try:
            import anthropic

            client = anthropic.Anthropic(api_key=settings.anthropic_api_key)
            response = client.messages.create(
                model=MODEL_ID,
                max_tokens=1500,
                messages=[{"role": "user", "content": prompt}],
            )

            text = response.content[0].text
            tokens_used = response.usage.input_tokens + response.usage.output_tokens

            # Parse JSON from response
            parsed = json.loads(text)
            parsed["tokens_used"] = tokens_used
            return parsed

        except json.JSONDecodeError:
            # Try to extract JSON from markdown code blocks
            try:
                import re

                match = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", text, re.DOTALL)
                if match:
                    parsed = json.loads(match.group(1))
                    parsed["tokens_used"] = tokens_used
                    return parsed
            except Exception:
                pass
            print("  ✗ Failed to parse Claude response as JSON")
            return None
        except Exception as e:
            print(f"  ✗ Claude API error: {e}")
            return None

    @staticmethod
    def _fetch_transcript(video_id: str) -> str | None:
        """Fetch YouTube auto-generated transcript for a video."""
        try:
            from youtube_transcript_api import YouTubeTranscriptApi

            transcript_list = YouTubeTranscriptApi.get_transcript(video_id)
            text = " ".join(entry["text"] for entry in transcript_list)
            return text
        except Exception as e:
            print(f"  ℹ️  Could not fetch transcript for {video_id}: {e}")
            return None
