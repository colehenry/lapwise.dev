"""
Summary Service

Generates AI summaries for F1 sessions using Claude Haiku.
Designed for sync usage in ingestion scripts.
"""

import json
import logging
import math

from sqlalchemy import select
from sqlalchemy.orm import Session as DBSession

from app.config import settings
from app.models import (
    Driver,
    Lap,
    RaceControlMessage,
    Session,
    SessionResult,
    SessionSummary,
    Team,
    TrackStatus,
    Weather,
)

MODEL_ID = "claude-haiku-4-5-20251001"

logger = logging.getLogger(__name__)


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
            logger.info("Summary already exists for session %s", session_id)
            return existing

        # Load session data
        session = db.execute(
            select(Session).where(Session.id == session_id)
        ).scalar_one_or_none()
        if not session:
            logger.warning("Session %s not found", session_id)
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
            logger.warning("No results for session %s", session_id)
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

        # Load lap-by-lap positions and pit data for race narrative fact checks.
        lap_rows = []
        race_control_rows = []
        if session.session_type in ("race", "sprint_race"):
            lap_rows = db.execute(
                select(Lap, Driver)
                .join(Driver, Lap.driver_id == Driver.id)
                .where(Lap.session_id == session_id)
                .order_by(Lap.lap_number, Lap.position)
            ).all()

            race_control_rows = (
                db.execute(
                    select(RaceControlMessage)
                    .where(RaceControlMessage.session_id == session_id)
                    .order_by(RaceControlMessage.session_time_seconds)
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
            session,
            results,
            weather_rows,
            track_status_rows,
            lap_rows,
            race_control_rows,
            transcript_text,
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

        logger.info(
            "Generated summary for %s [%s]",
            session.event_name,
            session.session_type,
        )
        return summary

    @staticmethod
    def _build_prompt(
        session,
        results,
        weather_rows,
        track_status_rows,
        lap_rows,
        race_control_rows,
        transcript,
    ):
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

        race_dynamics_text = SummaryService._build_race_dynamics_context(
            session_type, results, lap_rows, race_control_rows
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
{race_dynamics_text}
{transcript_section}

Based on this data, provide:
1. A concise 2-3 paragraph narrative summary of the session highlighting the key storylines
2. The top 3 most important, surprising, or dramatic things that happened, with each item covering a different event or storyline

You MUST respond with valid JSON in this exact format:
{{
  "summary": "Your 2-3 paragraph narrative summary here...",
  "top_3": [
    {{"headline": "Short headline", "detail": "1-2 sentence explanation"}},
    {{"headline": "Short headline", "detail": "1-2 sentence explanation"}},
    {{"headline": "Short headline", "detail": "1-2 sentence explanation"}}
  ]
}}

Fact-check rules:
- Final results are not enough to describe how the race unfolded. For races and sprints, verify every narrative claim against the Race Dynamics Evidence section before writing it.
- The top_3 items must be unique. Do not write three bullets that all describe the same root cause, such as the winner's Safety Car timing from slightly different angles.
- Each top_3 item should have its own subject and evidence. Prefer a mix such as: lead/winner-deciding moment, a separate recovery/drop/penalty, a podium or midfield swing, a DNF/DNS/incident, fastest lap, or teammate/team contrast.
- At most one top_3 item may focus on the race winner's victory path. At most one top_3 item may focus on a Safety Car/VSC pit-window swing unless there were multiple unrelated neutralized periods with distinct consequences.
- If two candidate bullets rely on the same laps, same pit window, and same drivers, merge them into one bullet and choose a different storyline for the remaining slot.
- Do NOT say a driver "led from pole to flag", "controlled the race", "dominated", or "never looked threatened" unless the leader timeline, lap 1 position, laps led, and gap data explicitly support it.
- Do not use the words "dominant", "dominates", "dominated", or "dominance" anywhere in the response. Use measurable wording instead, such as "led 33 laps", "controlled the final stint", or "won by 13.722s".
- Do not use "dominant", "dominates", "dominance", or headline phrases like "Dominant Victory" for a winner who lost positions at the start, first led during/after a SC/VSC pit window, or did not control the opening phase. If appropriate, say they controlled the final stint instead.
- If a Safety Car/VSC pit window materially changed the lead or track position, the headline and summary must foreground the timing/strategy swing rather than framing the win as raw dominance.
- Do not describe a gap as "comfortable" unless it was at least 5 seconds in a Grand Prix or at least 2 seconds in a sprint and was not immediately after a neutralized period.
- If the winner lost the lead, dropped positions at the start, regained P1 through pit timing, or benefited from SC/VSC timing, say that clearly.
- Do not describe a pass, surge, or on-track overtake unless lap-position changes and context support it. A lead gained during a pit/SC cycle should be described as strategy/timing, not a racing move.
- Use conservative language for position changes. Say "moved ahead", "took the lead", or "lost places" unless the supplied transcript or race-control evidence explicitly describes the overtaking move.
- Do not invent driving-mechanics detail such as inside/outside lines, battery/ERS deployment, tyre degradation management, car setup, pressure, or track-temperature effects unless that exact context is present in the supplied evidence.
- Use only the pit stops listed in Race Dynamics Evidence. Never infer "conceptual", hidden, extra, or forced pit stops that are not listed.
- If the pit-stop evidence covers only the top finishers, call them "top finishers", not "all points finishers" or the full field.
- Treat the YouTube transcript as supporting context only. If it conflicts with lap positions, pit stops, race control, or final results, trust the structured data.
- Do not infer incidents, strategy intent, championship implications, or luck unless the supplied data supports that exact claim.

Be specific with driver names, lap times, lap numbers, positions, pit stops, and safety-car timing. Highlight unexpected results and dramatic moments only when they are backed by the evidence above. Use an engaging but factual tone."""

        return prompt

    @staticmethod
    def _build_race_dynamics_context(
        session_type: str, results, lap_rows, race_control_rows
    ) -> str:
        """Build compact lap-position, pit-stop, and race-control context."""
        if session_type not in ("race", "sprint_race") or not lap_rows:
            return ""

        result_by_driver_id = {
            row.Driver.id: row.SessionResult for row in results if row.Driver
        }
        driver_names = {row.Driver.id: row.Driver.full_name for row in results}
        driver_codes = {
            row.Driver.id: row.Driver.driver_code or row.Driver.full_name
            for row in results
        }

        positions_by_lap: dict[int, list[tuple[int, int]]] = {}
        laps_by_driver: dict[int, list[Lap]] = {}
        status_by_lap: dict[int, set[str]] = {}

        for row in lap_rows:
            lap = row.Lap
            driver = row.Driver
            driver_names[driver.id] = driver.full_name
            driver_codes[driver.id] = driver.driver_code or driver.full_name
            laps_by_driver.setdefault(driver.id, []).append(lap)
            if lap.position is not None:
                positions_by_lap.setdefault(lap.lap_number, []).append(
                    (lap.position, driver.id)
                )
            if lap.track_status:
                for status in str(lap.track_status):
                    if status in {"4", "5", "6", "7"}:
                        status_by_lap.setdefault(lap.lap_number, set()).add(status)

        if not positions_by_lap:
            return ""

        leader_by_lap: list[tuple[int, int]] = []
        for lap_number in sorted(positions_by_lap):
            ordered = sorted(positions_by_lap[lap_number])
            leader_by_lap.append((lap_number, ordered[0][1]))

        leader_segments = SummaryService._compress_driver_segments(leader_by_lap)
        leader_text = "; ".join(
            f"{f'L{start}' if start == end else f'L{start}-{end}'} "
            f"{driver_codes.get(driver_id, driver_id)}"
            for start, end, driver_id in leader_segments
        )

        laps_led: dict[int, int] = {}
        for _, driver_id in leader_by_lap:
            laps_led[driver_id] = laps_led.get(driver_id, 0) + 1
        laps_led_text = ", ".join(
            f"{driver_codes.get(driver_id, driver_id)} {count}"
            for driver_id, count in sorted(
                laps_led.items(), key=lambda item: item[1], reverse=True
            )
        )

        top_finishers = [
            row.Driver.id
            for row in results
            if row.SessionResult.position is not None
            and row.SessionResult.position <= 5
        ]
        position_summary_lines = []
        for driver_id in top_finishers:
            driver_laps = sorted(
                laps_by_driver.get(driver_id, []), key=lambda lap: lap.lap_number
            )
            positions = [
                lap.position for lap in driver_laps if lap.position is not None
            ]
            if not positions:
                continue
            result = result_by_driver_id.get(driver_id)
            grid = getattr(result, "grid_position", None)
            finish = getattr(result, "position", None)
            lap1 = next(
                (
                    lap.position
                    for lap in driver_laps
                    if lap.lap_number == 1 and lap.position is not None
                ),
                None,
            )
            first_p1_lap = next(
                (lap.lap_number for lap in driver_laps if lap.position == 1),
                None,
            )
            position_summary_lines.append(
                f"- {driver_codes.get(driver_id, driver_id)} ({driver_names.get(driver_id)}): "
                f"grid P{grid if grid is not None else '?'}, "
                f"lap 1 P{lap1 if lap1 is not None else '?'}, "
                f"best P{min(positions)}, worst P{max(positions)}, "
                f"finish P{finish if finish is not None else '?'}, "
                f"laps led {laps_led.get(driver_id, 0)}, "
                f"first P1 lap {first_p1_lap if first_p1_lap is not None else 'never'}"
            )

        status_labels = {
            "4": "SC",
            "5": "Red Flag",
            "6": "VSC",
            "7": "VSC Ending",
        }
        status_segments = []
        for status in ("4", "6", "5", "7"):
            status_laps = [
                lap_number
                for lap_number, statuses in sorted(status_by_lap.items())
                if status in statuses
            ]
            status_segments.extend(
                f"{status_labels[status]} L{start}"
                if start == end
                else f"{status_labels[status]} L{start}-{end}"
                for start, end in SummaryService._compress_number_ranges(status_laps)
            )
        status_text = (
            ", ".join(status_segments) if status_segments else "None in lap data"
        )

        pit_lines = []
        sc_vsc_laps = {
            lap_number
            for lap_number, statuses in status_by_lap.items()
            if statuses.intersection({"4", "6"})
        }
        for driver_id in top_finishers:
            driver_laps = sorted(
                laps_by_driver.get(driver_id, []), key=lambda lap: lap.lap_number
            )
            pending_pit_in = None
            for lap in driver_laps:
                has_pit_in = SummaryService._is_finite_number(lap.pit_in_time_seconds)
                has_pit_out = SummaryService._is_finite_number(lap.pit_out_time_seconds)
                if has_pit_in:
                    pending_pit_in = lap
                    if not has_pit_out:
                        continue
                if not has_pit_out:
                    continue

                in_lap = pending_pit_in.lap_number if pending_pit_in else lap.lap_number
                out_lap = lap.lap_number
                pit_in_time = (
                    pending_pit_in.pit_in_time_seconds if pending_pit_in else None
                )
                duration_seconds = (
                    lap.pit_out_time_seconds - pit_in_time
                    if SummaryService._is_finite_number(lap.pit_out_time_seconds)
                    and SummaryService._is_finite_number(pit_in_time)
                    else None
                )
                duration = (
                    f", {duration_seconds:.1f}s"
                    if SummaryService._is_finite_number(duration_seconds)
                    else ""
                )
                neutralized = (
                    " under SC/VSC"
                    if any(
                        pit_lap in sc_vsc_laps
                        for pit_lap in range(
                            min(in_lap, out_lap), max(in_lap, out_lap) + 1
                        )
                    )
                    else ""
                )
                compound = f" to {lap.compound}" if lap.compound else ""
                lap_text = (
                    f"L{in_lap}" if in_lap == out_lap else f"L{in_lap}-L{out_lap}"
                )
                pit_lines.append(
                    f"- {driver_codes.get(driver_id, driver_id)} pit {lap_text}"
                    f"{compound}{duration}{neutralized}"
                )
                pending_pit_in = None
        pit_text = "\n".join(pit_lines[:30]) if pit_lines else "No pit stop rows found."

        race_control_lines = []
        for message in race_control_rows:
            if not message.message:
                continue
            text = message.message.upper()
            if any(
                key in text
                for key in (
                    "SAFETY CAR",
                    "VSC",
                    "PENALTY",
                    "INVESTIGATION",
                    "INCIDENT",
                    "DRS",
                    "RETIRED",
                    "STOPPED",
                )
            ):
                lap = f"L{message.lap_number}" if message.lap_number else "time"
                race_control_lines.append(f"- {lap}: {message.message}")
        race_control_text = (
            "\n".join(race_control_lines[:20])
            if race_control_lines
            else "No notable race control messages found."
        )

        return f"""

Race Dynamics Evidence (use this to fact-check the narrative):
- Leader timeline by completed lap: {leader_text}
- Laps led: {laps_led_text}
- Neutralized laps from lap data: {status_text}
- Top finisher position paths:
{chr(10).join(position_summary_lines)}
- Pit stops for top finishers:
{pit_text}
- Notable race-control messages:
{race_control_text}"""

    @staticmethod
    def _compress_driver_segments(
        lap_driver_pairs: list[tuple[int, int]],
    ) -> list[tuple[int, int, int]]:
        segments: list[tuple[int, int, int]] = []
        current_start = None
        current_end = None
        current_driver = None

        for lap_number, driver_id in lap_driver_pairs:
            if current_driver == driver_id and current_end == lap_number - 1:
                current_end = lap_number
                continue
            if current_driver is not None and current_start is not None:
                segments.append((current_start, current_end, current_driver))
            current_start = current_end = lap_number
            current_driver = driver_id

        if current_driver is not None and current_start is not None:
            segments.append((current_start, current_end, current_driver))
        return segments

    @staticmethod
    def _compress_number_ranges(numbers: list[int]) -> list[tuple[int, int]]:
        if not numbers:
            return []
        ranges: list[tuple[int, int]] = []
        start = previous = numbers[0]
        for number in numbers[1:]:
            if number == previous + 1:
                previous = number
                continue
            ranges.append((start, previous))
            start = previous = number
        ranges.append((start, previous))
        return ranges

    @staticmethod
    def _is_finite_number(value) -> bool:
        return isinstance(value, (int, float)) and math.isfinite(value)

    @staticmethod
    def _call_claude(prompt: str) -> dict | None:
        """Call Claude Haiku and parse the JSON response."""
        if not settings.anthropic_api_key:
            logger.warning("ANTHROPIC_API_KEY not set, skipping summary generation")
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
            logger.error("Failed to parse Claude response as JSON")
            return None
        except Exception as e:
            logger.error("Claude API error: %s", e)
            return None

    @staticmethod
    def _fetch_transcript(video_id: str) -> str | None:
        """Fetch YouTube auto-generated transcript for a video."""
        try:
            from youtube_transcript_api import YouTubeTranscriptApi

            fetched = YouTubeTranscriptApi().fetch(video_id)
            text = " ".join(snippet.text for snippet in fetched)
            return text
        except Exception as e:
            logger.info("Could not fetch transcript for %s: %s", video_id, e)
            return None
