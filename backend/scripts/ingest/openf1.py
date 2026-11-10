"""OpenF1 shaped as the FastF1 session the ingest functions already read."""

import time
from datetime import datetime, timedelta

import fastf1.core
import pandas as pd
import requests

BASE_URL = "https://api.openf1.org/v1"

# Free tier allows 3 requests/second and 30/minute.
MIN_SECONDS_BETWEEN_CALLS = 2.1
REQUEST_TIMEOUT = 120

# Samples arrive at roughly 3.6 Hz per driver; a wider window risks the
# response size cap, a narrower one wastes the per-minute budget.
SAMPLE_WINDOW = timedelta(minutes=5)

SESSION_NAMES = {
    "race": "Race",
    "qualifying": "Qualifying",
    "sprint_race": "Sprint",
    "sprint_qualifying": "Sprint Qualifying",
    "fp1": "Practice 1",
    "fp2": "Practice 2",
    "fp3": "Practice 3",
}

# A session is matched to its weekend by date, since OpenF1 carries no round.
WEEKEND_RADIUS_DAYS = 5

_last_call_at = 0.0


def _get(resource, **params):
    """One paced GET against OpenF1, returning rows or an empty list."""
    global _last_call_at

    wait = MIN_SECONDS_BETWEEN_CALLS - (time.monotonic() - _last_call_at)
    if wait > 0:
        time.sleep(wait)

    response = requests.get(
        f"{BASE_URL}/{resource}", params=params, timeout=REQUEST_TIMEOUT
    )
    _last_call_at = time.monotonic()

    if response.status_code != 200:
        return []

    payload = response.json()
    return payload if isinstance(payload, list) else []


def _parse_time(value):
    if not value:
        return None
    return datetime.fromisoformat(value)


def find_session(year, round_date, session_type):
    """The OpenF1 session row for one weekend's session, or None."""
    session_name = SESSION_NAMES.get(session_type)
    if not session_name:
        return None

    rows = _get("sessions", year=year, session_name=session_name)
    if not rows:
        return None

    target = round_date.date() if hasattr(round_date, "date") else round_date
    for row in rows:
        start = _parse_time(row.get("date_start"))
        if not start:
            continue
        if abs((start.date() - target).days) <= WEEKEND_RADIUS_DAYS:
            return row
    return None


def _sampled(resource, session_key, start, end):
    """Every row of a time-series resource, walked in windows."""
    rows = []
    window_start = start
    while window_start < end:
        window_end = min(window_start + SAMPLE_WINDOW, end)
        rows.extend(
            _get(
                resource,
                session_key=session_key,
                **{
                    "date>": window_start.isoformat(),
                    "date<": window_end.isoformat(),
                },
            )
        )
        window_start = window_end
    return rows


def _personal_bests(frame):
    """A per-driver fastest-lap flag, which pick_fastest() requires."""
    flags = pd.Series(False, index=frame.index)
    for _, group in frame.groupby("Driver"):
        timed = group["LapTime"].dropna()
        if not timed.empty:
            flags.loc[timed.idxmin()] = True
    return flags


class OpenF1Session:
    """A loaded session exposing the attributes the ingest functions read."""

    source = "openf1"

    def __init__(self, session_row, event):
        self.session_key = session_row["session_key"]
        self.circuit_key = session_row.get("circuit_key")
        self.year = session_row.get("year")
        self.event = event
        self.date_start = _parse_time(session_row.get("date_start"))
        self.date_end = _parse_time(session_row.get("date_end"))
        self.t0_date = self.date_start

        self._drivers = []
        self._stints = []
        self.laps = pd.DataFrame()
        self.results = pd.DataFrame()
        self.weather_data = pd.DataFrame()
        self.race_control_messages = pd.DataFrame()
        self.track_status = pd.DataFrame()
        self.pos_data = {}
        self.car_data = {}
        self.drivers = []

    def load(self, laps=True, telemetry=False, weather=True, messages=True):
        """Fetch and shape the session's data."""
        self._drivers = _get("drivers", session_key=self.session_key)
        self._stints = _get("stints", session_key=self.session_key)
        self.drivers = [str(row["driver_number"]) for row in self._drivers]

        if laps:
            self.laps = self._build_laps()
        self.results = self._build_results()
        if weather:
            self.weather_data = self._build_weather()
        if messages:
            self.race_control_messages = self._build_race_control()
        if telemetry:
            self._load_telemetry()

    def adopt_classification(self, fastf1_session):
        """Take results and event metadata from a FastF1 session.

        OpenF1 has no source driver, constructor or grid identity, so the
        result ingest must resolve against FastF1's.
        """
        try:
            results = fastf1_session.results
        except Exception:
            return
        if results is not None and len(results) > 0:
            self.results = results
        self.event = fastf1_session.event

    def acronyms(self):
        """Driver code by car number."""
        return {
            row["driver_number"]: row.get("name_acronym")
            for row in self._drivers
            if row.get("name_acronym")
        }

    def _stint_lookup(self):
        """Compound and tyre age by driver number and lap number."""
        lookup = {}
        for stint in self._stints:
            number = stint.get("driver_number")
            first = stint.get("lap_start")
            last = stint.get("lap_end")
            if number is None or first is None or last is None:
                continue
            age_at_start = stint.get("tyre_age_at_start")
            for lap_number in range(int(first), int(last) + 1):
                lookup[(number, lap_number)] = {
                    "compound": stint.get("compound"),
                    "stint": stint.get("stint_number"),
                    "tyre_life": (
                        None
                        if age_at_start is None
                        else int(age_at_start) + lap_number - int(first)
                    ),
                    "fresh_tyre": age_at_start == 0,
                }
        return lookup

    def _lap_positions(self):
        """The running order each driver held as each lap began."""
        rows = _get("position", session_key=self.session_key)
        by_driver = {}
        for row in rows:
            moment = _parse_time(row.get("date"))
            if moment is None:
                continue
            by_driver.setdefault(row["driver_number"], []).append(
                (moment, row.get("position"))
            )
        for changes in by_driver.values():
            changes.sort(key=lambda change: change[0])
        return by_driver

    def _position_at(self, positions, number, moment):
        held = None
        for changed_at, position in positions.get(number, []):
            if changed_at > moment:
                break
            held = position
        return held

    def _build_laps(self):
        rows = _get("laps", session_key=self.session_key)
        if not rows:
            return pd.DataFrame()

        acronyms = self.acronyms()
        stints = self._stint_lookup()
        positions = self._lap_positions()

        records = []
        for row in rows:
            number = row.get("driver_number")
            driver = acronyms.get(number)
            lap_number = row.get("lap_number")
            if not driver or lap_number is None:
                continue

            started_at = _parse_time(row.get("date_start"))
            stint = stints.get((number, int(lap_number)), {})
            compound = stint.get("compound")

            records.append(
                {
                    "Driver": driver,
                    "DriverNumber": str(number),
                    "LapNumber": lap_number,
                    "LapTime": self._as_timedelta(row.get("lap_duration")),
                    "Sector1Time": self._as_timedelta(row.get("duration_sector_1")),
                    "Sector2Time": self._as_timedelta(row.get("duration_sector_2")),
                    "Sector3Time": self._as_timedelta(row.get("duration_sector_3")),
                    "LapStartTime": self._offset(started_at),
                    "SpeedI1": row.get("i1_speed"),
                    "SpeedI2": row.get("i2_speed"),
                    "SpeedST": row.get("st_speed"),
                    "Stint": stint.get("stint"),
                    "Compound": compound.upper() if compound else None,
                    "TyreLife": stint.get("tyre_life"),
                    "FreshTyre": stint.get("fresh_tyre"),
                    "Position": self._position_at(positions, number, started_at)
                    if started_at
                    else None,
                    "PitOutTime": self._offset(started_at)
                    if row.get("is_pit_out_lap")
                    else None,
                }
            )

        frame = pd.DataFrame(records)
        if frame.empty:
            return frame
        frame["IsPersonalBest"] = _personal_bests(frame)
        frame["IsAccurate"] = frame["LapTime"].notna()
        return fastf1.core.Laps(frame)

    def _build_results(self):
        rows = _get("session_result", session_key=self.session_key)
        if not rows:
            return pd.DataFrame()

        acronyms = self.acronyms()
        by_number = {row["driver_number"]: row for row in self._drivers}

        records = []
        for row in rows:
            number = row.get("driver_number")
            driver = by_number.get(number, {})
            records.append(
                {
                    "Abbreviation": acronyms.get(number),
                    "DriverNumber": str(number),
                    "FullName": driver.get("full_name"),
                    "FirstName": driver.get("first_name"),
                    "LastName": driver.get("last_name"),
                    "TeamName": driver.get("team_name"),
                    "TeamColor": driver.get("team_colour"),
                    "HeadshotUrl": driver.get("headshot_url"),
                    "CountryCode": driver.get("country_code"),
                    "Position": row.get("position"),
                    "Points": row.get("points"),
                    "GridPosition": None,
                    "Status": self._status(row),
                    "Time": self._as_timedelta(self._total_seconds(row)),
                    "Laps": row.get("number_of_laps"),
                }
            )
        return pd.DataFrame(records)

    @staticmethod
    def _status(row):
        if row.get("dns"):
            return "Did not start"
        if row.get("dsq"):
            return "Disqualified"
        if row.get("dnf"):
            return "Retired"
        return "Finished"

    @staticmethod
    def _total_seconds(row):
        """The winner's elapsed time, and every other driver's gap to it."""
        if row.get("position") == 1:
            duration = row.get("duration")
            return None if isinstance(duration, list) else duration
        gap = row.get("gap_to_leader")
        return gap if isinstance(gap, (int, float)) else None

    def _build_weather(self):
        rows = _get("weather", session_key=self.session_key)
        if not rows:
            return pd.DataFrame()
        return pd.DataFrame(
            [
                {
                    "Time": self._offset(_parse_time(row.get("date"))),
                    "AirTemp": row.get("air_temperature"),
                    "TrackTemp": row.get("track_temperature"),
                    "Humidity": row.get("humidity"),
                    "Pressure": row.get("pressure"),
                    "WindSpeed": row.get("wind_speed"),
                    "WindDirection": row.get("wind_direction"),
                    "Rainfall": bool(row.get("rainfall")),
                }
                for row in rows
            ]
        )

    def _build_race_control(self):
        rows = _get("race_control", session_key=self.session_key)
        if not rows:
            return pd.DataFrame()
        return pd.DataFrame(
            [
                {
                    "Time": self._offset(_parse_time(row.get("date"))),
                    "Category": row.get("category"),
                    "Message": row.get("message"),
                    "Status": row.get("flag"),
                    "Flag": row.get("flag"),
                    "Scope": row.get("scope"),
                    "Sector": row.get("sector"),
                    "RacingNumber": row.get("driver_number"),
                    "Lap": row.get("lap_number"),
                }
                for row in rows
            ]
        )

    def _load_telemetry(self):
        """Position and car channels per driver, keyed as FastF1 keys them."""
        start = self.date_start
        end = self.date_end or (start + timedelta(hours=3))

        locations = _sampled("location", self.session_key, start, end)
        car_rows = _sampled("car_data", self.session_key, start, end)

        self.pos_data = self._frames_by_driver(
            locations,
            {"x": "X", "y": "Y", "z": "Z"},
        )
        self.car_data = self._frames_by_driver(
            car_rows,
            {
                "speed": "Speed",
                "n_gear": "nGear",
                "throttle": "Throttle",
                "brake": "Brake",
                "drs": "DRS",
                "rpm": "RPM",
            },
        )

    def _frames_by_driver(self, rows, columns):
        grouped = {}
        for row in rows:
            number = str(row.get("driver_number"))
            record = {"Date": _parse_time(row.get("date"))}
            record["SessionTime"] = self._offset(record["Date"])
            for source, target in columns.items():
                record[target] = row.get(source)
            grouped.setdefault(number, []).append(record)

        frames = {}
        for number, records in grouped.items():
            frame = pd.DataFrame(records).sort_values("Date").reset_index(drop=True)
            frames[number] = frame
        return frames

    def _offset(self, moment):
        """A timestamp as seconds from the session start."""
        if moment is None or self.date_start is None:
            return None
        return pd.Timedelta(seconds=(moment - self.date_start).total_seconds())

    @staticmethod
    def _as_timedelta(seconds):
        if seconds is None:
            return pd.NaT
        return pd.Timedelta(seconds=float(seconds))

    def seconds_from_start(self, timestamp):
        """An OpenF1 timestamp as seconds from the session start."""
        moment = _parse_time(timestamp)
        if moment is None or self.date_start is None:
            return 0.0
        return (moment - self.date_start).total_seconds()

    def pit_stops(self):
        """OpenF1's pit lane timings for this session."""
        return _get("pit", session_key=self.session_key)

    def get_circuit_info(self):
        """No corner geometry; callers fall back to an empty corner list."""
        return None


def load_openf1_session(year, round_date, session_type, event=None, telemetry=False):
    """A loaded OpenF1 session for one weekend's session, or None."""
    session_row = find_session(year, round_date, session_type)
    if not session_row:
        return None

    session = OpenF1Session(session_row, event)
    is_practice = session_type in ("fp1", "fp2", "fp3")
    session.load(
        laps=True,
        telemetry=telemetry,
        weather=not is_practice,
        messages=not is_practice,
    )
    return session
