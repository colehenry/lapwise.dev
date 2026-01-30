"""
Generate track map PNG files for all F1 circuits in a season.

This script uses FastF1 telemetry data to create accurate track maps
with white lines on transparent backgrounds for use in the frontend.

Track maps are named by circuit_id from the database (e.g., "1.png", "2.png").

Usage:
    PYTHONPATH=$PWD python scripts/generate_track_maps.py 2025
    PYTHONPATH=$PWD python scripts/generate_track_maps.py 2025 --output-dir ../frontend/public/track-maps
"""

import argparse
import asyncio
import os
import sys
from pathlib import Path

import fastf1
import matplotlib
import matplotlib.pyplot as plt
import numpy as np
from sqlalchemy import select

from app.database import get_db
from app.models.circuit import Circuit

# Use non-interactive backend
matplotlib.use("Agg")


def rotate(xy, *, angle):
    """Rotate coordinates by given angle in radians."""
    rot_mat = np.array(
        [[np.cos(angle), np.sin(angle)], [-np.sin(angle), np.cos(angle)]]
    )
    return np.matmul(xy, rot_mat)


def generate_track_map(
    session, output_path, line_color="white", bg_color=None, dpi=150, linewidth=4
):
    """
    Generate a track map PNG from session telemetry data.

    Args:
        session: FastF1 session object (already loaded)
        output_path: Path to save the PNG file
        line_color: Color of the track line (default: white)
        bg_color: Background color (default: None = transparent)
        dpi: Resolution of output image
        linewidth: Width of track line
    """
    try:
        # Get fastest lap for clean track outline
        lap = session.laps.pick_fastest()
        if lap is None:
            print(f"  ⚠️  No lap data available")
            return False

        telemetry = lap.get_telemetry()
        circuit_info = session.get_circuit_info()

        # Extract and rotate track coordinates
        track = telemetry.loc[:, ("X", "Y")].to_numpy()
        track_angle = circuit_info.rotation / 180 * np.pi
        rotated_track = rotate(track, angle=track_angle)

        # Create figure with no background
        fig, ax = plt.subplots(figsize=(8, 8))

        # Plot track line
        ax.plot(
            rotated_track[:, 0],
            rotated_track[:, 1],
            linewidth=linewidth,
            color=line_color,
        )

        # Configure axes
        ax.set_aspect("equal")
        ax.axis("off")

        # Set background colors
        if bg_color is None:
            # Transparent background
            fig.patch.set_alpha(0)
            ax.patch.set_alpha(0)
        else:
            # Solid background
            fig.patch.set_facecolor(bg_color)
            ax.patch.set_facecolor(bg_color)

        # Save with tight bounding box
        plt.savefig(
            output_path, dpi=dpi, bbox_inches="tight", transparent=(bg_color is None)
        )
        plt.close()

        # Get file size
        file_size = os.path.getsize(output_path) / 1024
        print(f"  ✅ Saved to {output_path} ({file_size:.1f} KB)")
        return True

    except Exception as e:
        print(f"  ❌ Error: {e}")
        return False


async def get_circuit_mapping():
    """
    Get mapping of circuit location -> circuit_id from database.

    Returns:
        dict: Mapping of location strings to circuit IDs
    """
    mapping = {}
    async for db in get_db():
        result = await db.execute(select(Circuit))
        circuits = result.scalars().all()
        for circuit in circuits:
            # Store multiple variations for matching
            mapping[circuit.location.lower()] = circuit.id
            mapping[circuit.name.lower()] = circuit.id
            # Add some common aliases
            if "miami gardens" in circuit.location.lower():
                mapping["miami"] = circuit.id
            if "monte carlo" in circuit.location.lower():
                mapping["monaco"] = circuit.id
            if "marina bay" in circuit.location.lower():
                mapping["singapore"] = circuit.id
            if (
                "yas island" in circuit.location.lower()
                or "yas marina" in circuit.location.lower()
            ):
                mapping["abu dhabi"] = circuit.id
        break
    return mapping


async def async_main():
    parser = argparse.ArgumentParser(description="Generate F1 track maps for a season")
    parser.add_argument("season", type=int, help="Season year (e.g., 2025)")
    parser.add_argument(
        "--output-dir",
        default="track_maps",
        help="Output directory for PNG files (default: track_maps)",
    )
    parser.add_argument(
        "--line-color", default="white", help="Track line color (default: white)"
    )
    parser.add_argument(
        "--bg-color",
        default=None,
        help="Background color (default: None = transparent)",
    )
    parser.add_argument(
        "--dpi", type=int, default=150, help="Image resolution (default: 150)"
    )
    parser.add_argument(
        "--linewidth", type=int, default=4, help="Track line width (default: 4)"
    )
    parser.add_argument(
        "--session-type",
        default="R",
        help="Session type to use for data (default: R = Race)",
    )

    args = parser.parse_args()

    # Enable FastF1 cache
    cache_dir = Path(__file__).parent.parent / "cache"
    cache_dir.mkdir(exist_ok=True)
    fastf1.Cache.enable_cache(str(cache_dir))

    # Create output directory
    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    print(f"\n🏎️  Generating track maps for {args.season} season")
    print(f"📁 Output directory: {output_dir.absolute()}")
    print(f"🎨 Style: {args.line_color} lines, ", end="")
    print(
        f"{'transparent background' if args.bg_color is None else args.bg_color + ' background'}\n"
    )

    # Get season schedule
    try:
        schedule = fastf1.get_event_schedule(args.season)
    except Exception as e:
        print(f"❌ Failed to get season schedule: {e}")
        sys.exit(1)

    # Get circuit ID mapping from database
    print("📊 Loading circuit data from database...")
    circuit_mapping = await get_circuit_mapping()
    print(f"   Found {len(circuit_mapping)} circuit mappings\n")

    # Filter to actual race events (exclude testing)
    race_events = schedule[schedule["EventFormat"] != "testing"]

    success_count = 0
    failed_events = []
    skipped_events = []

    for idx, event in race_events.iterrows():
        event_name = event["EventName"]
        round_num = event["RoundNumber"]
        location = event["Location"]

        print(f"[{round_num}/{len(race_events)}] {event_name} ({location})")

        # Try to find circuit ID
        location_lower = location.lower()
        circuit_id = circuit_mapping.get(location_lower)

        if circuit_id is None:
            print(f"  ⚠️  Circuit not found in database, skipping")
            skipped_events.append(f"{event_name} ({location})")
            print()
            continue

        print(f"  📍 Circuit ID: {circuit_id}")

        try:
            # Use circuit_id for filename
            output_path = output_dir / f"{circuit_id}.png"

            # Skip if track map already exists
            if output_path.exists():
                print(f"  ⏭️  Track map already exists, skipping")
                success_count += 1
                print()
                continue

            # Load session
            session = fastf1.get_session(args.season, round_num, args.session_type)
            session.load()

            # Generate track map
            success = generate_track_map(
                session,
                output_path,
                line_color=args.line_color,
                bg_color=args.bg_color,
                dpi=args.dpi,
                linewidth=args.linewidth,
            )

            if success:
                success_count += 1
            else:
                failed_events.append(event_name)

        except Exception as e:
            print(f"  ❌ Failed to load session: {e}")
            failed_events.append(event_name)

        print()

    # Summary
    print("\n" + "=" * 60)
    print(f"✅ Successfully generated: {success_count}/{len(race_events)} track maps")
    if skipped_events:
        print(f"⏭️  Skipped (not in DB): {', '.join(skipped_events)}")
    if failed_events:
        print(f"❌ Failed events: {', '.join(failed_events)}")
    print("=" * 60 + "\n")


def main():
    """Entry point that runs async main function."""
    asyncio.run(async_main())


if __name__ == "__main__":
    main()
