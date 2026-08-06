"""Local contact sheet for approving ingested driver media.

    python scripts/review_media.py            # http://localhost:8001

Shows each pending asset beside a square crop preview, because an image can
read well full-size and badly at the 96px the game grid uses. Clicking the face
stores a focal point, which is what makes the square crops look like a set.

Localhost only. No auth, never deployed, not part of the FastAPI app.
"""

import argparse
import io
import sys
from pathlib import Path

import uvicorn
from fastapi import FastAPI
from fastapi.responses import HTMLResponse, JSONResponse, Response
from PIL import Image
from pydantic import BaseModel
from sqlalchemy import func, select, text, update

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.database import AsyncSessionLocal  # noqa: E402
from app.models import Driver, DriverMediaAssignment, MediaAsset  # noqa: E402
from app.services.media_ingest_service import (  # noqa: E402
    MIN_LONG_EDGE,
    IngestRejected,
    MediaIngestService,
    check_source,
    normalize,
)
from app.services.media_service import public_url  # noqa: E402
from app.services.media_sources import (  # noqa: E402
    WikimediaSource,
    rank_candidates_for,
)

app = FastAPI(title="Lapwise media review")

PAGE = Path(__file__).with_name("review_media.html")


class Decision(BaseModel):
    asset_id: int
    approved: bool
    focal_x: float | None = None
    focal_y: float | None = None
    grade: str | None = None


@app.get("/", response_class=HTMLResponse)
async def index() -> str:
    return PAGE.read_text()


@app.get("/api/pending")
async def pending(limit: int = 200) -> JSONResponse:
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(MediaAsset, Driver, DriverMediaAssignment)
            .join(
                DriverMediaAssignment,
                DriverMediaAssignment.media_asset_id == MediaAsset.id,
            )
            .join(Driver, Driver.id == DriverMediaAssignment.driver_id)
            .where(MediaAsset.rights_status == "pending")
            .order_by(Driver.full_name)
            .limit(limit)
        )
        return JSONResponse(
            [
                {
                    "asset_id": asset.id,
                    "driver": driver.full_name,
                    "code": driver.driver_code,
                    "url": public_url(asset.storage_key),
                    "width": asset.width,
                    "height": asset.height,
                    "license": asset.license_code,
                    "credit": asset.attribution_text,
                    "source": asset.source_url,
                    "role": assignment.role,
                    "year": assignment.year,
                    "grade": assignment.visual_grade,
                }
                for asset, driver, assignment in result.all()
            ]
        )


@app.post("/api/decide")
async def decide(decision: Decision) -> JSONResponse:
    """Approve or reject one asset, storing focal point and grade."""
    async with AsyncSessionLocal() as db:
        await db.execute(
            update(MediaAsset)
            .where(MediaAsset.id == decision.asset_id)
            .values(
                rights_status="approved" if decision.approved else "removed",
                reviewed_at=func.now(),
                removed_at=None if decision.approved else func.now(),
            )
        )

        values = {"reviewed_at": func.now() if decision.approved else None}
        if decision.focal_x is not None:
            values["focal_x"] = decision.focal_x
            values["focal_y"] = decision.focal_y
        if decision.grade:
            values["visual_grade"] = decision.grade

        await db.execute(
            update(DriverMediaAssignment)
            .where(DriverMediaAssignment.media_asset_id == decision.asset_id)
            .values(**values)
        )
        await db.commit()
    return JSONResponse({"ok": True})


SELECT_PAGE = Path(__file__).with_name("select_media.html")


class Pick(BaseModel):
    driver_id: int
    filename: str


@app.get("/select", response_class=HTMLResponse)
async def select_page() -> str:
    return SELECT_PAGE.read_text()


@app.get("/api/gaps")
async def gaps() -> JSONResponse:
    """Race drivers with no approved career-fallback headshot."""
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            text("""
            SELECT DISTINCT d.id, d.full_name, d.driver_code, d.jolpica_id
            FROM drivers d
            JOIN session_results sr ON sr.driver_id = d.id
            JOIN sessions s ON s.id = sr.session_id
            WHERE s.year >= 2000
              AND s.session_type IN ('race', 'sprint_race')
              AND NOT EXISTS (
                SELECT 1 FROM driver_media_assignments a
                JOIN media_assets m ON m.id = a.media_asset_id
                WHERE a.driver_id = d.id AND a.role = 'headshot'
                  AND a.year IS NULL AND m.rights_status = 'approved'
                  AND a.reviewed_at IS NOT NULL)
            ORDER BY d.full_name
            """)
        )
        return JSONResponse(
            [
                {"driver_id": i, "driver": n, "code": c, "jolpica_id": j}
                for i, n, c, j in result.all()
            ]
        )


@app.get("/api/candidates/{driver_id}")
async def candidates(driver_id: int) -> JSONResponse:
    """Ranked Commons candidates, merged from the category and a name search.

    Ranking is presentation order only. Name searches return other people
    entirely, group shots and objects, so every pick here is a human decision.
    """
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(Driver).where(Driver.id == driver_id))
        driver = result.scalar_one()

    source = WikimediaSource()
    try:
        found: list = []
        if driver.jolpica_id:
            title = source.wikipedia_title(driver.jolpica_id)
            entity = source.wikidata_id(title) if title else None
            if entity:
                category = source.commons_category(entity)
                if category:
                    found.extend(source.category_files(category))
        found.extend(source.search_files(driver.full_name))

        seen: set[str] = set()
        unique = []
        for candidate in found:
            if candidate.filename not in seen:
                seen.add(candidate.filename)
                unique.append(candidate)

        surname = driver.full_name.split()[-1]
        ranked = rank_candidates_for(unique, surname, MIN_LONG_EDGE)
        return JSONResponse(
            {
                "driver": driver.full_name,
                "candidates": [
                    {
                        "filename": c.filename,
                        "thumb": c.thumb_url,
                        "page": c.page_url,
                        "width": c.width,
                        "height": c.height,
                        "license": c.license_code,
                        "credit": c.attribution_text,
                    }
                    for c in ranked[:24]
                ],
            }
        )
    finally:
        source.close()


@app.post("/api/pick")
async def pick(choice: Pick) -> JSONResponse:
    """Ingest a chosen Commons file; it lands pending for normal review."""
    source = WikimediaSource()
    try:
        candidate = source.file_details(choice.filename)
        if candidate is None:
            return JSONResponse({"ok": False, "error": "file not found"}, 404)
        try:
            check_source(candidate, "headshot")
        except IngestRejected as exc:
            return JSONResponse({"ok": False, "error": str(exc)}, 400)

        image = normalize(MediaIngestService.download(candidate.file_url))
        async with AsyncSessionLocal() as db:
            if await MediaIngestService.find_by_hash(db, image.sha256) is None:
                MediaIngestService.upload(image)
            asset, _ = await MediaIngestService.record_asset(db, candidate, image)
            await MediaIngestService.assign(
                db, choice.driver_id, asset, "headshot", None, "acceptable"
            )
            await db.commit()
            return JSONResponse({"ok": True, "asset_id": asset.id})
    finally:
        source.close()


APPROVED_PAGE = Path(__file__).with_name("approved_media.html")

TIER_YEARS = {"1": "s.year = 2026", "2": "s.year >= 2000", "3": "s.year >= 1990"}


@app.get("/approved", response_class=HTMLResponse)
async def approved_page() -> str:
    return APPROVED_PAGE.read_text()


@app.get("/api/approved")
async def approved(tier: str = "1") -> JSONResponse:
    """Approved headshots for a tier, framed exactly as the site will render them."""
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            text(f"""
            SELECT DISTINCT d.full_name, d.driver_code, m.storage_key, m.width,
                   m.height, m.license_code, a.focal_x, a.focal_y, a.visual_grade
            FROM drivers d
            JOIN session_results sr ON sr.driver_id = d.id
            JOIN sessions s ON s.id = sr.session_id
            JOIN driver_media_assignments a
              ON a.driver_id = d.id AND a.role = 'headshot' AND a.year IS NULL
            JOIN media_assets m ON m.id = a.media_asset_id
            WHERE {TIER_YEARS.get(tier, TIER_YEARS["1"])}
              AND s.session_type IN ('race', 'sprint_race')
              AND m.rights_status = 'approved' AND a.reviewed_at IS NOT NULL
            ORDER BY d.full_name
            """)
        )
        return JSONResponse(
            [
                {
                    "driver": name,
                    "code": code,
                    "url": public_url(key),
                    "key": key,
                    "width": w,
                    "height": h,
                    "license": lic,
                    # NULL means the CSS default, which is what was reviewed.
                    "focal_x": fx if fx is not None else 0.5,
                    "focal_y": fy if fy is not None else 0.4,
                    "has_focal": fx is not None,
                    "grade": grade,
                }
                for name, code, key, w, h, lic, fx, fy, grade in result.all()
            ]
        )


_THUMBS: dict[tuple, bytes] = {}


@app.get("/api/thumb")
def thumb(key: str, w: int = 96, fx: float = 0.5, fy: float = 0.4) -> Response:
    """Square focal crop resampled properly, the way an image CDN would.

    The browser cannot be asked to draw a 2048px file at 96px: at that ratio it
    falls back to a cheap filter and the result aliases. Lanczos here matches
    what `next/image` produces, so the preview is honest.
    """
    cache_key = (key, w, round(fx, 3), round(fy, 3))
    if cache_key not in _THUMBS:
        raw = MediaIngestService.download(public_url(key))
        image = Image.open(io.BytesIO(raw)).convert("RGB")

        side = min(image.width, image.height)
        left = round((image.width - side) * fx)
        top = round((image.height - side) * fy)
        square = image.crop((left, top, left + side, top + side))

        square = square.resize((w, w), Image.LANCZOS)
        buffer = io.BytesIO()
        square.save(buffer, format="JPEG", quality=88, optimize=True)
        _THUMBS[cache_key] = buffer.getvalue()

    return Response(
        _THUMBS[cache_key],
        media_type="image/jpeg",
        headers={"Cache-Control": "public, max-age=3600"},
    )


@app.get("/api/stats")
async def stats() -> JSONResponse:
    async with AsyncSessionLocal() as db:
        rows = await db.execute(
            select(MediaAsset.rights_status, func.count()).group_by(
                MediaAsset.rights_status
            )
        )
        return JSONResponse(dict(rows.all()))


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--port", type=int, default=8001)
    args = parser.parse_args()
    print(f"\n  media review → http://localhost:{args.port}\n")
    uvicorn.run(app, host="127.0.0.1", port=args.port, log_level="warning")


if __name__ == "__main__":
    main()
