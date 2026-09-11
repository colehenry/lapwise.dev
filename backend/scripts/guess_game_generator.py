"""Build a reviewed future queue for the guess game.

Usage:
    PYTHONPATH=$PWD python scripts/guess_game_generator.py --start 2026-09-12 --days 7
    PYTHONPATH=$PWD python scripts/guess_game_generator.py --start 2026-09-12 --days 7 --write
"""

import argparse
import asyncio
import random
from datetime import date, timedelta

from sqlalchemy import func, select

from app.database import AsyncSessionLocal
from app.models import GuessGamePuzzle
from app.services.driver_fact_service import FACT_ALGORITHM_VERSION
from app.services.guess_game_generation_service import (
    ANSWER_LAST_RACED_FLOOR,
    ANSWER_MINIMUM_STARTS,
    RECENT_VARIETY_WINDOW,
    choose_driver,
    eligible_drivers,
)


def arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Generate guess-game puzzles")
    parser.add_argument("--start", type=date.fromisoformat, required=True)
    parser.add_argument("--days", type=int, default=7)
    parser.add_argument("--seed", type=int, default=20260910)
    parser.add_argument("--status", choices=("draft", "approved"), default="approved")
    parser.add_argument(
        "--write", action="store_true", help="Write rows; otherwise dry-run"
    )
    return parser.parse_args()


async def generate(args: argparse.Namespace) -> None:
    if args.days < 1:
        raise SystemExit("--days must be positive")
    async with AsyncSessionLocal() as db:
        eligible, complete_count = await eligible_drivers(db)
        print(
            f"eligible={len(eligible)} complete={complete_count}"
            f" last_raced>={ANSWER_LAST_RACED_FLOOR} starts>={ANSWER_MINIMUM_STARTS}"
        )
        if not eligible:
            raise SystemExit("No eligible drivers")
        existing = list(
            (
                await db.scalars(
                    select(GuessGamePuzzle).order_by(GuessGamePuzzle.published_on)
                )
            ).all()
        )
        published_dates = {
            row.published_on for row in existing if row.status == "published"
        }
        next_number = (
            int(await db.scalar(select(func.max(GuessGamePuzzle.number))) or 0) + 1
        )
        recent = [row.answer_snapshot for row in existing if row.answer_snapshot]
        rng = random.Random(args.seed)
        created = []
        for offset in range(args.days):
            target = args.start + timedelta(days=offset)
            if target in published_dates:
                print(f"{target}: refused; a published puzzle already owns this date")
                continue
            candidate = choose_driver(eligible, recent, rng)
            duplicate = any(
                snapshot["driver_slug"] == candidate.driver_slug
                for snapshot in recent[-RECENT_VARIETY_WINDOW:]
            )
            warning = " WARNING duplicate answer" if duplicate else ""
            print(
                f"{target}: #{next_number} {candidate.full_name}"
                f" ({candidate.signature_constructor.name}){warning}"
            )
            snapshot = candidate.snapshot()
            recent.append(snapshot)
            created.append(
                GuessGamePuzzle(
                    public_id=f"guess-{next_number:04d}",
                    number=next_number,
                    status=args.status,
                    published_on=target,
                    max_guesses=10,
                    answer_driver_id=candidate.driver_id,
                    answer_snapshot=snapshot,
                    fact_algorithm_version=FACT_ALGORITHM_VERSION,
                )
            )
            next_number += 1
        if args.write:
            db.add_all(created)
            await db.commit()
            print(f"wrote={len(created)}")
        else:
            print(f"dry-run={len(created)}; pass --write to create the queue")


if __name__ == "__main__":
    asyncio.run(generate(arguments()))
