"""Derives the homepage console payload from ingested lap rows.

The console replays a race from `lap_start_time_seconds`, which is the real
session clock. Lap times are not summed to reconstruct it: 62 of Monza 2026's
1,054 lap rows carry no lap time, and a clock built by addition truncates every
car at the first gap.
"""

import re
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Circuit, Driver, Lap, Session, SessionResult, Team
from app.schemas.console import (
    ConsoleCar,
    ConsoleFastestLap,
    ConsoleFeedEvent,
    ConsoleLap,
    ConsoleReplayResponse,
    ConsoleStatusWindow,
)
from app.services.results.common import (
    headshot_fallback_expr,
    pit_durations,
    sanitize_float,
)
from app.services.results.session_data import SessionDataService

# A car with fewer laps than this is a formation-lap casualty, not a race.
MIN_LAPS = 4

# No car starting a lap for this long is a stoppage, not slow running.
STOPPAGE_SECONDS = 240

# Kept clear of the flag itself so the jump lands on green running.
STOPPAGE_MARGIN = 30

# Trailing a car by more than this many laps means it did not finish.
RETIREMENT_MARGIN = 2

# A pit "stop" this long is the field parked in the lane under a red flag.
RED_FLAG_HOLD_SECONDS = 180

# FastF1 track status codes.
STATUS_CODES = {
    "1": "green",
    "2": "yellow",
    "4": "sc",
    "5": "red",
    "6": "vsc",
    "7": "vsc",
}

STATUS_TEXT = {
    "yellow": "Yellow flag",
    "sc": "Safety car deployed",
    "red": "Red flag — session suspended",
    "vsc": "Virtual safety car",
}

_INCIDENT_CAR = re.compile(r"CAR \d+ \(([A-Z]{3})\)")
_TRAILING_CLOCK = re.compile(r"\s*\(\d{2}:\d{2}:\d{2}\)\s*$")


def _r1(value: Optional[float]) -> Optional[float]:
    return None if value is None else round(value, 1)


def _r3(value: Optional[float]) -> Optional[float]:
    return None if value is None else round(value, 3)


def _as_int(value: Optional[float]) -> Optional[int]:
    return None if value is None else round(value)


def _mmss(seconds: float) -> str:
    return f"{int(seconds // 60)}:{seconds % 60:06.3f}"


class ConsoleReplayService:
    """Assembles the single payload the homepage console renders from."""

    @staticmethod
    async def get_console_replay(
        db: AsyncSession, season: int, round_num: int
    ) -> Optional[ConsoleReplayResponse]:
        session = (
            await db.execute(
                select(Session)
                .where(Session.year == season)
                .where(Session.round == round_num)
                .where(Session.session_type == "race")
            )
        ).scalar_one_or_none()
        if session is None:
            return None

        circuit = (
            await db.execute(select(Circuit).where(Circuit.id == session.circuit_id))
        ).scalar_one_or_none()

        drivers = await ConsoleReplayService._driver_laps(db, session.id)
        if not drivers:
            return None

        total_laps = max(lap["lap_number"] for d in drivers for lap in d["laps"])
        cars = ConsoleReplayService._cars(drivers)
        if not cars:
            return None

        t0 = min(car.start[0] for car in cars)
        t_end = max(car.end for car in cars)

        status_events = await SessionDataService.get_track_status(db, session.id)
        race_control = await SessionDataService.get_race_control_events(db, session.id)

        return ConsoleReplayResponse(
            event_name=session.event_name,
            circuit_id=session.circuit_id,
            circuit_name=circuit.name if circuit else "",
            date=str(session.date),
            total_laps=total_laps,
            t0=_r1(t0),
            t_end=_r1(t_end),
            lead_changes=ConsoleReplayService._lead_changes(cars, total_laps),
            fastest_lap=ConsoleReplayService._fastest_lap(drivers),
            skips=ConsoleReplayService._skips(cars),
            status=ConsoleReplayService._status(status_events, t_end),
            cars=cars,
            feed=ConsoleReplayService._feed(
                drivers, total_laps, status_events, race_control
            ),
        )

    @staticmethod
    async def _driver_laps(db: AsyncSession, session_id: int) -> list[dict]:
        """Every lap row of the race, grouped by driver, finishing order first."""
        rows = (
            await db.execute(
                select(
                    Lap.driver_id,
                    Lap.lap_number,
                    Lap.lap_time_seconds,
                    Lap.lap_start_time_seconds,
                    Lap.compound,
                    Lap.tyre_life,
                    Lap.sector1_time_seconds,
                    Lap.sector2_time_seconds,
                    Lap.sector3_time_seconds,
                    Lap.speed_i1,
                    Lap.speed_i2,
                    Lap.speed_fl,
                    Lap.speed_st,
                    Lap.position,
                    Lap.pit_in_time_seconds,
                    Lap.pit_out_time_seconds,
                    Lap.is_personal_best,
                    Driver.driver_code,
                    Driver.full_name,
                    Team.name.label("team_name"),
                    Team.team_color,
                    SessionResult.position.label("final_position"),
                    headshot_fallback_expr().label("headshot_url"),
                )
                .join(Driver, Lap.driver_id == Driver.id)
                .join(
                    SessionResult,
                    (SessionResult.session_id == Lap.session_id)
                    & (SessionResult.driver_id == Lap.driver_id),
                )
                .join(Team, SessionResult.team_id == Team.id)
                .where(Lap.session_id == session_id)
                .order_by(SessionResult.position, Lap.lap_number)
            )
        ).all()
        if not rows:
            return []

        durations = await pit_durations(db, session_id)

        grouped: dict[int, dict] = {}
        for row in rows:
            driver = grouped.setdefault(
                row.driver_id,
                {
                    "driver_code": row.driver_code,
                    "full_name": row.full_name,
                    "team_name": row.team_name,
                    "team_color": row.team_color,
                    "headshot_url": row.headshot_url,
                    "final_position": row.final_position,
                    "laps": [],
                },
            )
            driver["laps"].append(
                {
                    "lap_number": row.lap_number,
                    "lap_time": sanitize_float(row.lap_time_seconds),
                    "lap_start": sanitize_float(row.lap_start_time_seconds),
                    "compound": row.compound,
                    "tyre_life": row.tyre_life,
                    "sectors": [
                        sanitize_float(row.sector1_time_seconds),
                        sanitize_float(row.sector2_time_seconds),
                        sanitize_float(row.sector3_time_seconds),
                    ],
                    "speeds": [
                        sanitize_float(row.speed_i1),
                        sanitize_float(row.speed_i2),
                        sanitize_float(row.speed_fl),
                        sanitize_float(row.speed_st),
                    ],
                    "position": row.position,
                    "pit_in": sanitize_float(row.pit_in_time_seconds),
                    "pit_out": sanitize_float(row.pit_out_time_seconds),
                    "pit_duration": durations.get((row.driver_id, row.lap_number)),
                    "personal_best": row.is_personal_best,
                }
            )
        return list(grouped.values())

    @staticmethod
    def _cars(drivers: list[dict]) -> list[ConsoleCar]:
        """Timed cars only, each carrying its own lap-start clock."""
        cars: list[ConsoleCar] = []
        for driver in drivers:
            laps = [lap for lap in driver["laps"] if lap["lap_start"] is not None]
            if len(laps) < MIN_LAPS:
                continue
            last = laps[-1]
            cars.append(
                ConsoleCar(
                    driver_code=driver["driver_code"],
                    full_name=driver["full_name"],
                    team_name=driver["team_name"],
                    team_color=driver["team_color"],
                    headshot_url=driver["headshot_url"],
                    final_position=driver["final_position"],
                    start=[_r3(lap["lap_start"]) for lap in laps],
                    # A car still running when the flag falls has no lap time on
                    # its final row, so the nominal lap keeps the trace moving.
                    end=_r3(last["lap_start"] + (last["lap_time"] or 90)),
                    laps=[
                        ConsoleLap(
                            t=_r3(lap["lap_time"]),
                            c=(lap["compound"] or "?")[0],
                            age=lap["tyre_life"],
                            s=[_r3(v) for v in lap["sectors"]],
                            v=[_as_int(v) for v in lap["speeds"]],
                            pos=lap["position"],
                            pit=1
                            if lap["pit_in"] is not None or lap["pit_out"] is not None
                            else 0,
                            pb=1 if lap["personal_best"] else 0,
                        )
                        for lap in laps
                    ],
                )
            )
        return cars

    @staticmethod
    def _skips(cars: list[ConsoleCar]) -> list[list[float]]:
        """Windows in which nobody starts a lap — a stoppage playback jumps."""
        boundaries = sorted({start for car in cars for start in car.start})
        skips = []
        for previous, current in zip(boundaries, boundaries[1:]):
            if current - previous > STOPPAGE_SECONDS:
                skips.append(
                    [_r1(previous + STOPPAGE_MARGIN), _r1(current - STOPPAGE_MARGIN)]
                )
        return skips

    @staticmethod
    def _status(events, t_end: float) -> list[ConsoleStatusWindow]:
        """Each non-green stretch, running until the next status change."""
        windows = []
        for index, event in enumerate(events):
            code = STATUS_CODES.get(event.status, "green")
            if code == "green":
                continue
            following = events[index + 1] if index + 1 < len(events) else None
            start = _r1(event.session_time_seconds)
            end = _r1(following.session_time_seconds if following else t_end)
            if end > start:
                windows.append(
                    ConsoleStatusWindow(
                        **{
                            "from": start,
                            "to": end,
                            "code": code,
                            "label": event.message,
                        }
                    )
                )
        return windows

    @staticmethod
    def _lead_changes(cars: list[ConsoleCar], total_laps: int) -> int:
        changes = 0
        previous = None
        for index in range(total_laps):
            leader = next(
                (c for c in cars if index < len(c.laps) and c.laps[index].pos == 1),
                None,
            )
            if leader is None:
                continue
            if previous and leader.driver_code != previous:
                changes += 1
            previous = leader.driver_code
        return changes

    @staticmethod
    def _best_lap(drivers: list[dict]) -> Optional[tuple]:
        """The quickest lap at full precision: `(seconds, driver, lap row)`."""
        best = None
        for driver in drivers:
            for lap in driver["laps"]:
                if lap["lap_time"] is None:
                    continue
                if best is None or lap["lap_time"] < best[0]:
                    best = (lap["lap_time"], driver, lap)
        return best

    @staticmethod
    def _fastest_lap(drivers: list[dict]) -> Optional[ConsoleFastestLap]:
        best = ConsoleReplayService._best_lap(drivers)
        if best is None:
            return None
        seconds, driver, lap = best
        return ConsoleFastestLap(
            driver_code=driver["driver_code"],
            seconds=_r3(seconds),
            lap=lap["lap_number"],
        )

    @staticmethod
    def _feed(
        drivers, total_laps, status_events, race_control
    ) -> list[ConsoleFeedEvent]:
        """Events that actually happened, on the clock the replay runs on."""
        leader = next(
            (d for d in drivers if d["final_position"] == 1),
            drivers[0],
        )
        leader_starts = [
            lap["lap_start"] for lap in leader["laps"] if lap["lap_start"] is not None
        ]

        def lap_at(seconds: float) -> int:
            """Track status carries no lap, so read it off the leader's laps."""
            passed = sum(1 for start in leader_starts if start <= seconds)
            return max(1, passed)

        events: list[ConsoleFeedEvent] = []

        def push(t, lap, kind, text, code=None):
            if t is None:
                return
            events.append(
                ConsoleFeedEvent(
                    t=_r1(t), lap=lap, kind=kind, text=text, driver_code=code
                )
            )

        ConsoleReplayService._car_events(drivers, total_laps, lap_at, push)
        ConsoleReplayService._lead_events(drivers, total_laps, push)
        ConsoleReplayService._fastest_lap_event(drivers, lap_at, push)

        for event in status_events:
            kind = STATUS_CODES.get(event.status)
            if kind is None or kind == "green":
                continue
            push(
                event.session_time_seconds,
                lap_at(event.session_time_seconds),
                kind,
                STATUS_TEXT[kind],
            )

        ConsoleReplayService._steward_events(race_control, lap_at, push)

        events.sort(key=lambda e: e.t)
        return events

    @staticmethod
    def _car_events(drivers, total_laps, lap_at, push) -> None:
        """Pit stops and retirements, per car."""
        for driver in drivers:
            code = driver["driver_code"]
            for lap in driver["laps"]:
                if lap["pit_in"] is None:
                    continue
                held = lap["pit_duration"]
                if held is not None and held > RED_FLAG_HOLD_SECONDS:
                    text = f"{code} into the pit lane under the red flag"
                else:
                    position = lap["position"] if lap["position"] is not None else "?"
                    duration = f" — {held:.1f}s" if held else ""
                    text = f"{code} pits from P{position}{duration}"
                push(lap["pit_in"], lap_at(lap["pit_in"]), "pit", text, code)

            if len(driver["laps"]) < total_laps - RETIREMENT_MARGIN:
                last = driver["laps"][-1]
                if last["lap_start"] is None:
                    continue
                push(
                    last["lap_start"] + (last["lap_time"] or 60),
                    lap_at(last["lap_start"]),
                    "out",
                    f"{code} out on lap {last['lap_number']}",
                    code,
                )

    @staticmethod
    def _lead_events(drivers, total_laps, push) -> None:
        previous = None
        for index in range(total_laps):
            leader = next(
                (
                    d
                    for d in drivers
                    if index < len(d["laps"]) and d["laps"][index]["position"] == 1
                ),
                None,
            )
            if leader is None:
                continue
            if previous and leader["driver_code"] != previous:
                push(
                    leader["laps"][index]["lap_start"],
                    index + 1,
                    "lead",
                    f"{leader['driver_code']} leads on lap {index + 1}",
                    leader["driver_code"],
                )
            previous = leader["driver_code"]

    @staticmethod
    def _fastest_lap_event(drivers, lap_at, push) -> None:
        """The fastest lap, placed at the moment it was completed.

        Matched on the lap row itself rather than on a rounded time, so a lap
        whose seconds round to a neighbour's cannot claim the event.
        """
        best = ConsoleReplayService._best_lap(drivers)
        if best is None:
            return
        seconds, driver, lap = best
        if lap["lap_start"] is None:
            return
        push(
            lap["lap_start"] + seconds,
            lap_at(lap["lap_start"]),
            "fast",
            f"{driver['driver_code']} sets the fastest lap — {_mmss(seconds)}",
            driver["driver_code"],
        )

    @staticmethod
    def _steward_events(race_control, lap_at, push) -> None:
        """Safety-car calls and the first stewards' note per incident."""
        seen: set[str] = set()
        for event in race_control:
            lap = event.lap_number or lap_at(event.session_time_seconds)
            if event.category == "SafetyCar":
                text = event.message.lower()
                push(event.session_time_seconds, lap, "sc", text[:1].upper() + text[1:])
                continue
            if event.category != "Other" or "INCIDENT" not in event.message:
                continue
            match = _INCIDENT_CAR.search(event.message)
            car = match.group(1) if match else None
            investigated = "INVESTIGATED" in event.message
            key = f"{car}-{'inv' if investigated else 'noted'}"
            if key in seen:
                continue
            seen.add(key)
            reason = " - ".join(event.message.split(" - ")[1:]) or "under investigation"
            reason = _TRAILING_CLOCK.sub("", reason).lower()
            verdict = "investigating" if investigated else "noted"
            push(
                event.session_time_seconds,
                lap,
                "steward",
                f"Stewards {verdict} {car or 'an incident'} — {reason}",
                car,
            )
