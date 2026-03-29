"""
Replay Frame Generation

Extracts telemetry from FastF1, interpolates to 10 FPS frames,
and stores as compressed MessagePack blobs for race replay playback.
"""

import gzip

import msgpack
import numpy as np
import pandas as pd

from .utils import timedelta_to_seconds
from .team_colors import enrich_team_color

# Constants
FPS = 10
DT = 1.0 / FPS  # 0.1 seconds per frame

# Tyre compound encoding
COMPOUND_MAP = {
    "SOFT": 0,
    "MEDIUM": 1,
    "HARD": 2,
    "INTERMEDIATE": 3,
    "WET": 4,
    "UNKNOWN": 5,
    "TEST_UNKNOWN": 5,
    "HYPERSOFT": 0,
    "ULTRASOFT": 0,
    "SUPERSOFT": 0,
    "SUPERHARD": 2,
}


def rotate(xy, *, angle):
    """Rotate coordinates by given angle in radians."""
    rot_mat = np.array(
        [[np.cos(angle), np.sin(angle)], [-np.sin(angle), np.cos(angle)]]
    )
    return np.matmul(xy, rot_mat)


def normalize_coords(coords, target_range=1000.0, padding=0.05):
    """
    Normalize coordinates to [0, target_range] with aspect ratio preserved.

    Args:
        coords: Nx2 array of [x, y] coordinates
        target_range: Target coordinate range (default 1000)
        padding: Fraction of padding on each side (default 5%)

    Returns:
        Normalized Nx2 array
    """
    x_min, y_min = coords.min(axis=0)
    x_max, y_max = coords.max(axis=0)

    x_span = x_max - x_min
    y_span = y_max - y_min

    # Use the larger span to preserve aspect ratio
    max_span = max(x_span, y_span)
    if max_span == 0:
        return coords * 0  # Degenerate case

    usable_range = target_range * (1 - 2 * padding)
    scale = usable_range / max_span
    offset = target_range * padding

    # Center the smaller dimension
    x_center_offset = (usable_range - x_span * scale) / 2
    y_center_offset = (usable_range - y_span * scale) / 2

    normalized = np.empty_like(coords)
    x_off = offset + x_center_offset
    y_off = offset + y_center_offset
    normalized[:, 0] = (coords[:, 0] - x_min) * scale + x_off
    normalized[:, 1] = (coords[:, 1] - y_min) * scale + y_off

    return normalized


def extract_track_polyline(fastf1_session):
    """
    Extract track polyline from the fastest lap telemetry.

    Returns:
        tuple: (polyline as list of [x,y], rotation_degrees) or (None, None)
    """
    try:
        fastest_lap = fastf1_session.laps.pick_fastest()
        if fastest_lap is None:
            return None, None

        telemetry = fastest_lap.get_telemetry()
        circuit_info = fastf1_session.get_circuit_info()

        track = telemetry.loc[:, ("X", "Y")].to_numpy()
        rotation_deg = circuit_info.rotation
        track_angle = rotation_deg / 180 * np.pi
        rotated = rotate(track, angle=track_angle)
        normalized = normalize_coords(rotated)

        # Convert to list of [x, y] pairs, rounded for compactness
        polyline = [[round(float(p[0]), 1), round(float(p[1]), 1)] for p in normalized]
        return polyline, float(rotation_deg)

    except Exception as e:
        print(f"  ⚠️  Could not extract track polyline: {e}")
        return None, None


def extract_driver_telemetry(fastf1_session, track_rotation_rad, norm_params):
    """
    Extract and concatenate telemetry for all drivers across all laps.

    Args:
        fastf1_session: Loaded FastF1 session
        track_rotation_rad: Rotation angle in radians
        norm_params: Dict with normalization parameters
            (x_min, y_min, scale, offset, etc.)

    Returns:
        dict: {driver_code: DataFrame with columns
            [t, x, y, speed, gear, drs,
             compound_idx, tyre_life, lap, position]}
    """
    all_laps = fastf1_session.laps
    if all_laps is None or len(all_laps) == 0:
        return {}

    drivers_data = {}
    unique = all_laps["Driver"].unique()
    driver_codes = [d for d in unique if d and str(d) != "nan"]

    for driver_code in driver_codes:
        try:
            driver_laps = all_laps.pick_drivers(driver_code)
            if driver_laps is None or len(driver_laps) == 0:
                continue

            all_telemetry = []

            for _, lap_row in driver_laps.iterrows():
                try:
                    tel = lap_row.get_telemetry()
                    if tel is None or len(tel) == 0:
                        continue

                    # Extract time as seconds from session start
                    if "SessionTime" in tel.columns:
                        t = tel["SessionTime"].dt.total_seconds().values
                    elif "Time" in tel.columns:
                        t = tel["Time"].dt.total_seconds().values
                    else:
                        continue

                    # Extract and transform coordinates
                    xy = tel.loc[:, ("X", "Y")].to_numpy()
                    xy_rotated = rotate(xy, angle=track_rotation_rad)
                    xy_norm = _apply_normalization(xy_rotated, norm_params)

                    n = len(t)

                    # Get lap-level data
                    compound = str(lap_row.get("Compound", "UNKNOWN"))
                    compound_idx = COMPOUND_MAP.get(compound.upper(), 5)
                    tyre_life = (
                        int(lap_row.get("TyreLife", 0))
                        if not pd.isna(lap_row.get("TyreLife"))
                        else 0
                    )
                    lap_num = (
                        int(lap_row.get("LapNumber", 0))
                        if not pd.isna(lap_row.get("LapNumber"))
                        else 0
                    )
                    position = (
                        int(lap_row.get("Position", 0))
                        if not pd.isna(lap_row.get("Position"))
                        else 0
                    )

                    # Build per-sample arrays
                    cols = tel.columns
                    zeros = np.zeros(n)
                    speed = tel["Speed"].values if "Speed" in cols else zeros
                    gear = tel["nGear"].values if "nGear" in cols else zeros
                    drs = tel["DRS"].values if "DRS" in cols else zeros

                    # DRS: convert to binary (>=10 means open in FastF1)
                    drs_binary = np.where(
                        np.isnan(drs),
                        0,
                        np.where(drs >= 10, 1, 0),
                    )

                    df = pd.DataFrame(
                        {
                            "t": t,
                            "x": xy_norm[:, 0],
                            "y": xy_norm[:, 1],
                            "speed": speed,
                            "gear": gear,
                            "drs": drs_binary,
                            "compound_idx": np.full(n, compound_idx),
                            "tyre_life": np.full(n, tyre_life),
                            "lap": np.full(n, lap_num),
                            "position": np.full(n, position),
                        }
                    )

                    all_telemetry.append(df)

                except Exception:
                    continue

            if all_telemetry:
                combined = pd.concat(all_telemetry, ignore_index=True)
                combined.sort_values("t", inplace=True)
                combined.drop_duplicates(subset=["t"], keep="last", inplace=True)
                drivers_data[driver_code] = combined

        except Exception as e:
            print(f"    ⚠️  Could not extract telemetry for " f"{driver_code}: {e}")
            continue

    return drivers_data


def _apply_normalization(coords, params):
    """Apply pre-computed normalization parameters to coordinates."""
    normalized = np.empty_like(coords)
    normalized[:, 0] = (
        (coords[:, 0] - params["x_min"]) * params["scale"]
        + params["offset"]
        + params["x_center_offset"]
    )
    normalized[:, 1] = (
        (coords[:, 1] - params["y_min"]) * params["scale"]
        + params["offset"]
        + params["y_center_offset"]
    )
    return normalized


def compute_normalization_params(fastf1_session, track_rotation_rad):
    """
    Compute normalization parameters from the fastest lap track outline.
    These are reused for all driver telemetry to ensure consistent coordinates.
    """
    fastest_lap = fastf1_session.laps.pick_fastest()
    if fastest_lap is None:
        return None

    telemetry = fastest_lap.get_telemetry()
    track = telemetry.loc[:, ("X", "Y")].to_numpy()
    rotated = rotate(track, angle=track_rotation_rad)

    target_range = 1000.0
    padding = 0.05

    x_min, y_min = rotated.min(axis=0)
    x_max, y_max = rotated.max(axis=0)
    x_span = x_max - x_min
    y_span = y_max - y_min
    max_span = max(x_span, y_span)

    if max_span == 0:
        return None

    usable_range = target_range * (1 - 2 * padding)
    scale = usable_range / max_span
    offset = target_range * padding
    x_center_offset = (usable_range - x_span * scale) / 2
    y_center_offset = (usable_range - y_span * scale) / 2

    return {
        "x_min": float(x_min),
        "y_min": float(y_min),
        "scale": float(scale),
        "offset": float(offset),
        "x_center_offset": float(x_center_offset),
        "y_center_offset": float(y_center_offset),
    }


def interpolate_frames(drivers_data, t_min, t_max):
    """
    Interpolate all driver telemetry to uniform 25 FPS time grid.

    Returns:
        tuple: (timeline array, dict of {driver_code:
            dict of interpolated arrays})
    """
    timeline = np.arange(t_min, t_max, DT)

    interpolated = {}

    for driver_code, df in drivers_data.items():
        t = df["t"].values
        if len(t) < 2:
            continue

        # Continuous interpolation for position/speed
        x_interp = np.interp(timeline, t, df["x"].values)
        y_interp = np.interp(timeline, t, df["y"].values)
        speed_interp = np.interp(timeline, t, df["speed"].values)

        # Nearest-neighbor for categorical values
        indices = np.searchsorted(t, timeline, side="right") - 1
        indices = np.clip(indices, 0, len(t) - 1)

        gear_interp = df["gear"].values[indices]
        drs_interp = df["drs"].values[indices]
        compound_interp = df["compound_idx"].values[indices]
        tyre_life_interp = df["tyre_life"].values[indices]
        lap_interp = df["lap"].values[indices]
        position_interp = df["position"].values[indices]

        # Mask frames outside driver's telemetry range
        valid_mask = (timeline >= t[0]) & (timeline <= t[-1])

        interpolated[driver_code] = {
            "x": x_interp,
            "y": y_interp,
            "speed": speed_interp,
            "gear": gear_interp,
            "drs": drs_interp,
            "compound_idx": compound_interp,
            "tyre_life": tyre_life_interp,
            "lap": lap_interp,
            "position": position_interp,
            "valid": valid_mask,
        }

    return timeline, interpolated


def build_track_status_timeline(fastf1_session, timeline):
    """
    Build per-frame safety car state from track status data.

    Status codes: 0=green, 1=yellow, 4=SC, 5=red, 6=VSC, 7=VSC ending
    Returns: array of SC state per frame (0=none, 1=SC, 2=VSC)
    """
    n_frames = len(timeline)
    sc_state = np.zeros(n_frames, dtype=int)

    track_status = fastf1_session.track_status
    if track_status is None or len(track_status) == 0:
        return sc_state

    # Build list of (time, status_code) events
    events = []
    for _, row in track_status.iterrows():
        t = timedelta_to_seconds(row.get("Time"))
        status = str(row.get("Status", "1"))
        if t is not None:
            events.append((t, status))

    events.sort(key=lambda x: x[0])

    current_sc = 0
    event_idx = 0

    for i, t in enumerate(timeline):
        while event_idx < len(events) and events[event_idx][0] <= t:
            status_code = events[event_idx][1]
            if status_code == "4":
                current_sc = 1  # Safety Car
            elif status_code == "6":
                current_sc = 2  # VSC
            elif status_code in ("1", "7"):
                current_sc = 0  # Green / VSC ending
            event_idx += 1
        sc_state[i] = current_sc

    return sc_state


def build_weather_samples(fastf1_session, timeline):
    """
    Sample weather data, only including frames where weather changes.

    Returns:
        list of (frame_index, weather_dict) tuples
    """
    weather_data = fastf1_session.weather_data
    if weather_data is None or len(weather_data) == 0:
        return []

    # Build time-sorted weather events
    weather_events = []
    for _, row in weather_data.iterrows():
        t = timedelta_to_seconds(row.get("Time"))
        if t is None:
            continue
        weather_events.append(
            {
                "t": t,
                "air_temp": round(float(row.get("AirTemp", 0)), 1),
                "track_temp": round(float(row.get("TrackTemp", 0)), 1),
                "humidity": round(float(row.get("Humidity", 0)), 1),
                "wind_speed": round(float(row.get("WindSpeed", 0)), 1),
                "rainfall": bool(row.get("Rainfall", False)),
            }
        )

    if not weather_events:
        return []

    weather_events.sort(key=lambda x: x["t"])

    # Find which weather event applies at each frame, emit on change
    samples = []
    last_weather = None
    event_idx = 0

    n_events = len(weather_events)
    for i, t in enumerate(timeline):
        while event_idx < n_events and weather_events[event_idx]["t"] <= t:
            event_idx += 1

        current_idx = max(0, event_idx - 1)
        w = weather_events[current_idx]
        w_key = (w["air_temp"], w["track_temp"], w["humidity"], w["rainfall"])

        if w_key != last_weather:
            samples.append(
                (
                    i,
                    {
                        "air_temp": w["air_temp"],
                        "track_temp": w["track_temp"],
                        "humidity": w["humidity"],
                        "wind_speed": w["wind_speed"],
                        "rainfall": w["rainfall"],
                    },
                )
            )
            last_weather = w_key

    return samples


def build_race_control_messages(fastf1_session):
    """
    Extract race control messages with timestamps.

    Returns:
        list of dicts with t, category, message, driver fields
    """
    rcm = fastf1_session.race_control_messages
    if rcm is None or len(rcm) == 0:
        return []

    messages = []
    for _, row in rcm.iterrows():
        t = timedelta_to_seconds(row.get("Time"))
        if t is None:
            continue

        msg_text = row.get("Message")
        if not msg_text or str(msg_text) == "nan":
            continue

        category = row.get("Category")
        if category and str(category) != "nan":
            category = str(category)
        else:
            category = None

        driver_num = row.get("RacingNumber")
        if driver_num and str(driver_num) != "nan":
            try:
                driver_num = int(driver_num)
            except (ValueError, TypeError):
                driver_num = None
        else:
            driver_num = None

        messages.append(
            {
                "t": round(float(t), 2),
                "category": category,
                "message": str(msg_text),
                "driver_number": driver_num,
            }
        )

    messages.sort(key=lambda x: x["t"])
    return messages


def get_driver_metadata(fastf1_session, year):
    """
    Build driver metadata dict with team colors and names.

    Returns:
        dict: {driver_code: {color, full_name, number}}
    """
    results = fastf1_session.results
    if results is None or len(results) == 0:
        return {}

    drivers = {}
    for _, row in results.iterrows():
        code = row.get("Abbreviation")
        if not code or str(code) == "nan":
            continue

        # Get team color
        color = enrich_team_color(row, year)
        if not color:
            color = "999999"  # Default gray

        first_name = str(row.get("FirstName", ""))
        last_name = str(row.get("LastName", ""))
        full_name = f"{first_name} {last_name}".strip()

        number = row.get("DriverNumber")
        try:
            number = int(number)
        except (ValueError, TypeError):
            number = 0

        drivers[code] = {
            "color": color,
            "full_name": full_name,
            "number": number,
        }

    return drivers


def generate_replay_data(fastf1_session, session_id, season, round_num, event_name):
    """
    Generate complete replay data for a race session.

    Args:
        fastf1_session: Loaded FastF1 session
            (with laps=True, telemetry loaded)
        session_id: Database session ID
        season: Season year
        round_num: Round number
        event_name: Event name string

    Returns:
        tuple: (compressed_bytes, metadata_dict) or (None, None) on failure
    """
    print("  🎬 Generating replay frames...")

    # Step 1: Extract track polyline
    polyline, rotation_deg = extract_track_polyline(fastf1_session)
    if polyline is None:
        print("  ❌ Could not extract track polyline")
        return None, None

    print(f"    Track: {len(polyline)} points")

    # Step 2: Compute normalization params
    track_rotation_rad = rotation_deg / 180 * np.pi
    norm_params = compute_normalization_params(fastf1_session, track_rotation_rad)
    if norm_params is None:
        print("  ❌ Could not compute normalization params")
        return None, None

    # Step 3: Extract driver telemetry
    drivers_data = extract_driver_telemetry(
        fastf1_session, track_rotation_rad, norm_params
    )
    if not drivers_data:
        print("  ❌ No driver telemetry extracted")
        return None, None

    driver_list = ", ".join(sorted(drivers_data.keys()))
    print(f"    Drivers: {len(drivers_data)} ({driver_list})")

    # Step 4: Determine time range
    t_min = min(df["t"].min() for df in drivers_data.values())
    t_max = max(df["t"].max() for df in drivers_data.values())
    duration_min = (t_max - t_min) / 60
    print(f"    Time range: {t_min:.1f}s - {t_max:.1f}s" f" ({duration_min:.1f} min)")

    # Step 5: Interpolate to 25 FPS
    timeline, interpolated = interpolate_frames(drivers_data, t_min, t_max)
    n_frames = len(timeline)
    replay_min = n_frames / FPS / 60
    print(f"    Frames: {n_frames} ({replay_min:.1f} min at {FPS} FPS)")

    # Step 6: Build track status timeline
    sc_state = build_track_status_timeline(fastf1_session, timeline)

    # Step 7: Build weather samples
    weather_samples = build_weather_samples(fastf1_session, timeline)

    # Step 8: Build race control messages
    race_control = build_race_control_messages(fastf1_session)

    # Step 9: Get driver metadata
    driver_meta = get_driver_metadata(fastf1_session, season)

    # Step 10: Determine total laps
    all_laps = fastf1_session.laps
    total_laps = int(all_laps["LapNumber"].max()) if len(all_laps) > 0 else 0

    # Step 11: Assemble frames
    # Build weather lookup by frame index
    weather_by_frame = {}
    for frame_idx, w_data in weather_samples:
        weather_by_frame[frame_idx] = w_data

    frames = []
    current_weather = None

    for i in range(n_frames):
        # Update weather if changed at this frame
        if i in weather_by_frame:
            current_weather = weather_by_frame[i]
            frame_weather = current_weather
        else:
            frame_weather = None

        # Build per-driver data for this frame
        d = {}
        max_lap = 0
        for driver_code, interp in interpolated.items():
            if not interp["valid"][i]:
                continue

            x = round(float(interp["x"][i]), 1)
            y = round(float(interp["y"][i]), 1)
            speed = round(float(interp["speed"][i]), 1)
            gear = int(interp["gear"][i])
            drs = int(interp["drs"][i])
            compound = int(interp["compound_idx"][i])
            tyre_life = int(interp["tyre_life"][i])
            lap = int(interp["lap"][i])
            pos = int(interp["position"][i])

            d[driver_code] = [
                x,
                y,
                speed,
                gear,
                drs,
                compound,
                tyre_life,
                lap,
                pos,
            ]
            max_lap = max(max_lap, lap)

        frame = {
            "t": round(float(timeline[i] - t_min), 2),
            "lap": max_lap,
            "d": d,
            "sc": int(sc_state[i]),
        }
        if frame_weather is not None:
            frame["w"] = frame_weather

        frames.append(frame)

    # Step 12: Build final payload
    payload = {
        "metadata": {
            "session_id": session_id,
            "season": season,
            "round": round_num,
            "event_name": event_name,
            "total_frames": n_frames,
            "fps": FPS,
            "total_duration_seconds": round(float(t_max - t_min), 2),
            "total_laps": total_laps,
        },
        "track": {
            "polyline": polyline,
            "rotation_deg": rotation_deg,
        },
        "drivers": driver_meta,
        "frames": frames,
        "race_control": race_control,
    }

    # Step 13: Serialize with MessagePack + gzip
    packed = msgpack.packb(payload, use_bin_type=True)
    compressed = gzip.compress(packed, compresslevel=6)

    size_mb = len(compressed) / (1024 * 1024)
    print(f"    Compressed size: {size_mb:.2f} MB")

    metadata = {
        "total_frames": n_frames,
        "total_duration_seconds": round(float(t_max - t_min), 2),
        "total_laps": total_laps,
        "driver_count": len(driver_meta),
        "compressed_size_bytes": len(compressed),
    }

    return compressed, metadata
