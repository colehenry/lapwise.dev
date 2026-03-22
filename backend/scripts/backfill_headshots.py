"""
Backfill driver headshots from multiple sources:
1. F1 CDN (for 2018+ drivers) - formula1.com/content/dam/...
2. Wikipedia (for all drivers) - via page summary API thumbnails

Uses Jolpica API Wikipedia URLs when available, falls back to name-based lookup.
"""
import asyncio
import sys
import urllib.parse

sys.path.insert(0, "/Users/colehenry/Documents/github/lapwise/lapwise.dev/backend")

import aiohttp

from app.database import AsyncSessionLocal
from sqlalchemy import text

F1_CDN_BASE = "https://www.formula1.com/content/dam/fom-website/drivers"
WIKI_API = "https://en.wikipedia.org/api/rest_v1/page/summary"
JOLPICA_API = "https://api.jolpi.ca/ergast/f1/drivers"

# Concurrency limiter to avoid hammering APIs
SEMAPHORE = asyncio.Semaphore(10)
# Wikipedia requires a User-Agent header or returns 403
HTTP_HEADERS = {
    "User-Agent": "LapwiseBot/1.0 (https://lapwise.dev; contact@lapwise.dev)"
}


async def fetch_json(session: aiohttp.ClientSession, url: str):
    """Fetch JSON from a URL, return None on failure."""
    try:
        async with SEMAPHORE:
            async with session.get(
                url, timeout=aiohttp.ClientTimeout(total=15)
            ) as resp:
                if resp.status == 200:
                    return await resp.json()
    except Exception:
        pass
    return None


async def test_url(session: aiohttp.ClientSession, url: str) -> bool:
    """Test if a URL returns HTTP 200."""
    try:
        async with SEMAPHORE:
            async with session.head(
                url, timeout=aiohttp.ClientTimeout(total=10)
            ) as resp:
                return resp.status == 200
    except Exception:
        return False


def build_f1_cdn_urls(full_name: str):
    """Build possible F1 CDN URLs for a driver."""
    parts = full_name.strip().split()
    if len(parts) < 2:
        return []

    first = parts[0]
    last = parts[-1]

    urls = []
    for suffix in ["01", "02", "03"]:
        f3 = first[:3].upper()
        l3 = last[:3].upper()
        driver_id = f"{f3}{l3}{suffix}"
        letter = driver_id[0]
        id_lower = driver_id.lower()
        first_enc = urllib.parse.quote(first, safe="")
        last_enc = urllib.parse.quote(last, safe="")
        url = (
            f"{F1_CDN_BASE}/{letter}/{driver_id}_{first_enc}_{last_enc}/{id_lower}.png"
        )
        urls.append(url)

    return urls


def name_to_wiki_title(full_name: str) -> str:
    """Convert a driver name to a Wikipedia article title guess."""
    # Replace spaces with underscores
    title = full_name.strip().replace(" ", "_")
    return urllib.parse.quote(title, safe="_")


async def get_wiki_image_from_jolpica(
    session: aiohttp.ClientSession, jolpica_id: str
) -> str | None:
    """Get Wikipedia thumbnail via Jolpica -> Wikipedia URL -> Wikipedia API."""
    data = await fetch_json(session, f"{JOLPICA_API}/{jolpica_id}/")
    if not data:
        return None

    try:
        drivers = data["MRData"]["DriverTable"]["Drivers"]
        if not drivers:
            return None
        wiki_url = drivers[0].get("url", "")
        if "/wiki/" not in wiki_url:
            return None
        wiki_title = wiki_url.split("/wiki/")[-1]
    except (KeyError, IndexError):
        return None

    return await get_wiki_thumbnail(session, wiki_title)


async def get_wiki_thumbnail(
    session: aiohttp.ClientSession, wiki_title: str
) -> str | None:
    """Get thumbnail from Wikipedia summary API."""
    data = await fetch_json(session, f"{WIKI_API}/{wiki_title}")
    if not data:
        return None

    # Try thumbnail first (smaller, good for headshots)
    thumb = data.get("thumbnail", {}).get("source")
    if thumb:
        return thumb

    # Fall back to original image
    orig = data.get("originalimage", {}).get("source")
    return orig


async def get_wiki_image_from_name(
    session: aiohttp.ClientSession, full_name: str
) -> str | None:
    """Try to get Wikipedia image by guessing the article title from name."""
    # Try exact name
    title = name_to_wiki_title(full_name)
    img = await get_wiki_thumbnail(session, title)
    if img:
        return img

    # Try with "(racing driver)" suffix for disambiguation
    img = await get_wiki_thumbnail(session, f"{title}_(racing_driver)")
    if img:
        return img

    # Try with "(Formula One)" suffix
    img = await get_wiki_thumbnail(session, f"{title}_(Formula_One)")
    return img


async def find_headshot(
    session: aiohttp.ClientSession,
    driver_id: int,
    code: str | None,
    name: str,
    jolpica_id: str | None,
) -> tuple:
    """Try multiple sources to find a headshot for a driver."""
    # Strategy 1: F1 CDN (fastest, best quality for recent drivers)
    for url in build_f1_cdn_urls(name):
        if await test_url(session, url):
            return (driver_id, code, name, url, "f1_cdn")

    # Strategy 2: Wikipedia via Jolpica (most reliable for named drivers)
    if jolpica_id:
        img = await get_wiki_image_from_jolpica(session, jolpica_id)
        if img:
            return (driver_id, code, name, img, "wiki_jolpica")

    # Strategy 3: Wikipedia via name guess
    img = await get_wiki_image_from_name(session, name)
    if img:
        return (driver_id, code, name, img, "wiki_name")

    return (driver_id, code, name, None, None)


async def main():
    async with AsyncSessionLocal() as db:
        # Get all drivers without headshots that have session results
        r = await db.execute(
            text(
                """
            SELECT d.id, d.driver_code, d.full_name, d.jolpica_id
            FROM drivers d
            JOIN session_results sr ON sr.driver_id = d.id
            WHERE d.id NOT IN (
                SELECT DISTINCT sr2.driver_id FROM session_results sr2
                WHERE sr2.headshot_url IS NOT NULL
                  AND sr2.headshot_url != 'None'
                  AND sr2.headshot_url != 'nan'
                  AND sr2.headshot_url LIKE 'http%'
            )
            GROUP BY d.id, d.driver_code, d.full_name, d.jolpica_id
            ORDER BY d.full_name
        """
            )
        )
        drivers = r.fetchall()
        print(f"Found {len(drivers)} drivers without headshots\n")

        found = 0
        not_found = []
        sources = {"f1_cdn": 0, "wiki_jolpica": 0, "wiki_name": 0}

        async with aiohttp.ClientSession(headers=HTTP_HEADERS) as http:
            batch_size = 15
            for i in range(0, len(drivers), batch_size):
                batch = drivers[i : i + batch_size]
                tasks = []

                for did, code, name, jolpica_id in batch:
                    tasks.append(find_headshot(http, did, code, name, jolpica_id))

                results = await asyncio.gather(*tasks)

                for did, code, name, url, source in results:
                    if url:
                        found += 1
                        sources[source] += 1
                        await db.execute(
                            text(
                                """
                                UPDATE session_results
                                SET headshot_url = :url
                                WHERE driver_id = :did
                                  AND (headshot_url IS NULL
                                       OR headshot_url = 'None'
                                       OR headshot_url = 'nan'
                                       OR headshot_url NOT LIKE 'http%')
                            """
                            ),
                            {"url": url, "did": did},
                        )
                        print(f"  OK  [{source:13s}] {code or '---':6s} {name:30s}")
                    else:
                        not_found.append((code, name))

                await db.commit()

                progress = min(i + batch_size, len(drivers))
                if progress % 60 == 0 or progress >= len(drivers):
                    print(
                        f"\n  Progress: {progress}/{len(drivers)} checked, {found} found\n"
                    )

        print(f"\n{'='*60}")
        print(f"Done! Found headshots for {found}/{len(drivers)} drivers")
        print(f"Sources: {sources}")
        print(f"Still missing: {len(not_found)} drivers")
        if not_found:
            print(f"\nDrivers still without headshots ({len(not_found)}):")
            for code, name in not_found:
                print(f"  {code or '---':6s} {name}")


if __name__ == "__main__":
    asyncio.run(main())
