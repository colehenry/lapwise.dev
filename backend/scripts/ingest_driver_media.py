"""Driver media ingestion.

    python scripts/ingest_driver_media.py discover --driver HAM
    python scripts/ingest_driver_media.py ingest   --driver HAM --curated
    python scripts/ingest_driver_media.py ingest   --driver HAM --file "Some file.jpg"
    python scripts/ingest_driver_media.py review
    python scripts/ingest_driver_media.py approve  --asset 12

Nothing is written without --apply. Ingested rows stay unapproved until the
approve command runs, so the resolver keeps serving the legacy path meanwhile.
"""

import argparse
import asyncio
import sys
import time
from pathlib import Path
from typing import List, Optional

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import func, select, text, update  # noqa: E402

from app.database import AsyncSessionLocal  # noqa: E402
from app.models import Driver, DriverMediaAssignment, MediaAsset  # noqa: E402
from app.services.media_ingest_service import (  # noqa: E402
    IngestRejected,
    MediaIngestService,
    check_source,
    normalize,
)
from app.services.media_sources import SourceCandidate, WikimediaSource  # noqa: E402


async def _driver(db, code_or_id: str) -> Driver:
    field = Driver.id if code_or_id.isdigit() else Driver.driver_code
    value = int(code_or_id) if code_or_id.isdigit() else code_or_id.upper()
    result = await db.execute(select(Driver).where(field == value))
    driver = result.scalar_one_or_none()
    if driver is None:
        raise SystemExit(f"no driver matching {code_or_id!r}")
    return driver


def _candidates(source: WikimediaSource, driver: Driver) -> List[SourceCandidate]:
    """Curated Wikidata image first, then the Commons category as a pool."""
    if not driver.jolpica_id:
        raise SystemExit(f"{driver.full_name} has no jolpica_id to resolve")

    title = source.wikipedia_title(driver.jolpica_id)
    if not title:
        raise SystemExit(f"{driver.full_name}: no Wikipedia article via Jolpica")
    entity = source.wikidata_id(title)
    if not entity:
        raise SystemExit(f"{driver.full_name}: no Wikidata entity for {title}")

    found: List[SourceCandidate] = []
    curated = source.curated_image(entity)
    if curated:
        details = source.file_details(curated)
        if details:
            found.append(details)

    category = source.commons_category(entity)
    if category:
        seen = {c.filename for c in found}
        found.extend(
            c for c in source.category_files(category) if c.filename not in seen
        )
    return found


def _print_candidates(driver: Driver, candidates: List[SourceCandidate]) -> None:
    print(f"\n{driver.full_name}  ({len(candidates)} candidates)\n")
    for index, candidate in enumerate(candidates):
        mark = "*" if candidate.is_curated else " "
        gate = "ok " if candidate.license_allowed else "NO "
        print(
            f"{mark}{index:>3} {gate} {candidate.width:>5}x{candidate.height:<5}"
            f" {candidate.license_code[:18]:18} {candidate.filename[:56]}"
        )
    print("\n* = Wikidata curated image. Only it is a safe automatic pick;")
    print("  the rest are a review pool and include cars, helmets and crowds.")


async def cmd_discover(args) -> None:
    source = WikimediaSource()
    try:
        async with AsyncSessionLocal() as db:
            driver = await _driver(db, args.driver)
            _print_candidates(driver, _candidates(source, driver))
    finally:
        source.close()


async def cmd_ingest(args) -> None:
    source = WikimediaSource()
    try:
        async with AsyncSessionLocal() as db:
            driver = await _driver(db, args.driver)

            if args.file:
                candidate = source.file_details(args.file)
                if candidate is None:
                    raise SystemExit(f"no Commons file named {args.file!r}")
            else:
                candidates = _candidates(source, driver)
                curated = [c for c in candidates if c.is_curated]
                if not curated:
                    raise SystemExit(
                        f"{driver.full_name}: no curated image; "
                        f"run discover and pass --file"
                    )
                candidate = curated[0]

            print(f"driver     {driver.full_name} (id={driver.id})")
            print(f"file       {candidate.filename}")
            print(f"license    {candidate.license_code}")
            print(f"source     {candidate.page_url or candidate.file_url}")
            print(f"dimensions {candidate.width}x{candidate.height}")

            try:
                check_source(candidate, args.role)
            except IngestRejected as exc:
                raise SystemExit(f"rejected: {exc}")

            if not args.apply:
                print("\ndry run — pass --apply to download, upload and record")
                return

            image = normalize(MediaIngestService.download(candidate.file_url))
            print(
                f"normalized {image.width}x{image.height} "
                f"{len(image.data) / 1024:.0f}KB sha={image.sha256[:12]}"
            )

            existing = await MediaIngestService.find_by_hash(db, image.sha256)
            if existing is None:
                MediaIngestService.upload(image)
                print(f"uploaded   {image.storage_key}")
            else:
                print(f"reused     existing asset {existing.id} (same content)")

            asset, created = await MediaIngestService.record_asset(db, candidate, image)
            _, new_assignment = await MediaIngestService.assign(
                db, driver.id, asset, args.role, args.year, args.grade
            )
            await db.commit()

            print(
                f"asset      {'created' if created else 'existing'} id={asset.id} "
                f"rights={asset.rights_status}"
            )
            print(
                f"assignment {'created' if new_assignment else 'updated'} "
                f"role={args.role} year={args.year or 'career fallback'}"
            )
            print(f"\nnot yet servable — approve with: approve --asset {asset.id}")
    finally:
        source.close()


TIER_SQL = {
    "post-2000": "s.year >= 2000",
    "post-1990": "s.year >= 1990",
    "all": "TRUE",
}


async def _tier_drivers(db, tier: str) -> List[Driver]:
    """Race drivers in a tier that still lack a career-fallback headshot.

    Practice-only entrants are excluded: an FP1 reserve is not part of a game
    pool. Drivers without a `jolpica_id` are returned rather than filtered, so
    they appear in the report instead of vanishing from the count.
    """
    result = await db.execute(
        text(f"""
        SELECT DISTINCT d.id, d.full_name, d.jolpica_id, d.driver_code
        FROM drivers d
        JOIN session_results sr ON sr.driver_id = d.id
        JOIN sessions s ON s.id = sr.session_id
        LEFT JOIN driver_media_assignments a
          ON a.driver_id = d.id AND a.role = 'headshot' AND a.year IS NULL
        WHERE {TIER_SQL[tier]}
          AND s.session_type IN ('race', 'sprint_race')
          AND a.id IS NULL
        ORDER BY d.full_name
        """)
    )
    return result.all()


async def cmd_bulk(args) -> None:
    """Ingest the curated image for every driver in a tier.

    Only Wikidata's curated image is used. Category files are not safe to pick
    automatically: ranked by resolution they surface cars, helmets and museum
    pieces ahead of portraits.
    """
    source = WikimediaSource()
    counts = {"ingested": 0, "skipped": 0, "failed": 0}
    rejects: List[str] = []
    try:
        async with AsyncSessionLocal() as db:
            drivers = await _tier_drivers(db, args.tier)
            print(
                f"{len(drivers)} drivers in {args.tier} without a fallback headshot\n"
            )

            for index, driver in enumerate(drivers, start=1):
                label = f"[{index:>3}/{len(drivers)}] {driver.full_name[:26]:26}"
                if not driver.jolpica_id:
                    counts["skipped"] += 1
                    rejects.append(f"{driver.full_name}\tno jolpica_id")
                    print(f"{label} skip   no jolpica_id")
                    continue
                try:
                    title = source.wikipedia_title(driver.jolpica_id)
                    entity = source.wikidata_id(title) if title else None
                    filename = source.curated_image(entity) if entity else None
                    if not filename:
                        counts["skipped"] += 1
                        rejects.append(f"{driver.full_name}\tno curated image")
                        print(f"{label} skip   no P18")
                        continue

                    candidate = source.file_details(filename)
                    check_source(candidate, "headshot")

                    if not args.apply:
                        counts["ingested"] += 1
                        print(f"{label} would  {candidate.width}x{candidate.height}")
                        continue

                    image = normalize(MediaIngestService.download(candidate.file_url))
                    if await MediaIngestService.find_by_hash(db, image.sha256) is None:
                        MediaIngestService.upload(image)
                    asset, _ = await MediaIngestService.record_asset(
                        db, candidate, image
                    )
                    await MediaIngestService.assign(
                        db, driver.id, asset, "headshot", None, "acceptable"
                    )
                    await db.commit()
                    counts["ingested"] += 1
                    print(
                        f"{label} ok     {image.width}x{image.height} asset={asset.id}"
                    )

                except IngestRejected as exc:
                    counts["skipped"] += 1
                    rejects.append(f"{driver.full_name}\t{exc}")
                    print(f"{label} skip   {exc}")
                except Exception as exc:  # noqa: BLE001 — one driver must not stop the run
                    await db.rollback()
                    counts["failed"] += 1
                    rejects.append(f"{driver.full_name}\t{type(exc).__name__}: {exc}")
                    print(f"{label} FAIL   {type(exc).__name__}")

                time.sleep(args.delay)

        print(
            f"\ningested={counts['ingested']} skipped={counts['skipped']} "
            f"failed={counts['failed']}"
        )
        if rejects:
            report = Path(args.report)
            report.write_text("\n".join(rejects) + "\n")
            print(f"{len(rejects)} needing manual selection written to {report}")
        if args.apply:
            print("all pending — review before anything is served")
    finally:
        source.close()


async def cmd_review(args) -> None:
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(MediaAsset, Driver.full_name, DriverMediaAssignment)
            .join(
                DriverMediaAssignment,
                DriverMediaAssignment.media_asset_id == MediaAsset.id,
            )
            .join(Driver, Driver.id == DriverMediaAssignment.driver_id)
            .where(MediaAsset.rights_status == "pending")
            .order_by(MediaAsset.id)
            .limit(args.limit)
        )
        rows = result.all()
        if not rows:
            print("nothing pending review")
            return

        from app.services.media_service import public_url

        for asset, name, assignment in rows:
            print(f"\nasset {asset.id}  {name}")
            print(f"  role     {assignment.role}  year={assignment.year or '-'}")
            print(f"  license  {asset.license_code}  ({asset.width}x{asset.height})")
            print(f"  credit   {asset.attribution_text[:70]}")
            print(f"  source   {asset.source_url}")
            print(f"  hosted   {public_url(asset.storage_key)}")
        print(f"\n{len(rows)} pending. approve with: approve --asset <id>")


async def cmd_approve(args) -> None:
    async with AsyncSessionLocal() as db:
        status = "removed" if args.reject else "approved"
        await db.execute(
            update(MediaAsset)
            .where(MediaAsset.id == args.asset)
            .values(rights_status=status, reviewed_at=func.now())
        )
        if not args.reject:
            await db.execute(
                update(DriverMediaAssignment)
                .where(DriverMediaAssignment.media_asset_id == args.asset)
                .values(reviewed_at=func.now())
            )
        await db.commit()
        print(f"asset {args.asset} -> {status}")


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    subs = parser.add_subparsers(dest="command", required=True)

    discover = subs.add_parser("discover", help="list candidates, write nothing")
    discover.add_argument("--driver", required=True, help="driver code or id")
    discover.set_defaults(func=cmd_discover)

    ingest = subs.add_parser("ingest", help="normalize, upload and record")
    ingest.add_argument("--driver", required=True, help="driver code or id")
    ingest.add_argument(
        "--file", help="Commons filename; omit to use the curated image"
    )
    ingest.add_argument("--curated", action="store_true", help="use the curated image")
    ingest.add_argument(
        "--role", default="headshot", choices=["headshot", "portrait", "banner"]
    )
    ingest.add_argument("--year", type=int, help="season; omit for career fallback")
    ingest.add_argument(
        "--grade",
        default="acceptable",
        choices=["studio", "clean", "acceptable", "poor"],
    )
    ingest.add_argument(
        "--apply", action="store_true", help="write; default is dry run"
    )
    ingest.set_defaults(func=cmd_ingest)

    bulk = subs.add_parser("bulk", help="ingest curated images for a whole tier")
    bulk.add_argument(
        "--tier", default="post-2000", choices=["post-2000", "post-1990", "all"]
    )
    bulk.add_argument(
        "--delay",
        type=float,
        default=0.5,
        help="seconds between drivers, to stay polite to Wikimedia",
    )
    bulk.add_argument("--report", default="media_manual_queue.tsv")
    bulk.add_argument("--apply", action="store_true", help="write; default is dry run")
    bulk.set_defaults(func=cmd_bulk)

    review = subs.add_parser("review", help="list assets awaiting approval")
    review.add_argument("--limit", type=int, default=25)
    review.set_defaults(func=cmd_review)

    approve = subs.add_parser("approve", help="make an asset servable")
    approve.add_argument("--asset", type=int, required=True)
    approve.add_argument("--reject", action="store_true", help="mark removed instead")
    approve.set_defaults(func=cmd_approve)

    return parser


def main(argv: Optional[List[str]] = None) -> None:
    args = build_parser().parse_args(argv)
    asyncio.run(args.func(args))


if __name__ == "__main__":
    main()
