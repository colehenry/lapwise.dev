"""
Second pass: backfill remaining driver headshots using Wikipedia search API
for drivers whose names didn't directly match Wikipedia article titles.
"""
import asyncio
import sys

sys.path.insert(0, "/Users/colehenry/Documents/github/lapwise/lapwise.dev/backend")

import aiohttp

from app.database import AsyncSessionLocal
from sqlalchemy import text

WIKI_SEARCH = "https://en.wikipedia.org/w/api.php"
WIKI_SUMMARY = "https://en.wikipedia.org/api/rest_v1/page/summary"
JOLPICA_API = "https://api.jolpi.ca/ergast/f1/drivers"
SEMAPHORE = asyncio.Semaphore(8)
HTTP_HEADERS = {
    "User-Agent": "LapwiseBot/1.0 (https://lapwise.dev; contact@lapwise.dev)"
}

# Manual overrides for known disambiguation issues
WIKI_OVERRIDES = {
    "Anthony Foyt": "A._J._Foyt",
    "Juan Fangio": "Juan_Manuel_Fangio",
    "Boy Lunger": "Brett_Lunger",  # Same person?
    "Nino Farina": "Giuseppe_Farina",
    "Prince Bira": "Birabongse_Bhanudej",
    "Toulo de Graffenried": "Emmanuel_de_Graffenried",
}


async def fetch_json(session: aiohttp.ClientSession, url: str, params=None):
    try:
        async with SEMAPHORE:
            async with session.get(
                url, params=params, timeout=aiohttp.ClientTimeout(total=15)
            ) as resp:
                if resp.status == 200:
                    return await resp.json()
    except Exception:
        pass
    return None


async def wiki_search_thumbnail(
    session: aiohttp.ClientSession, name: str
) -> str | None:
    """Search Wikipedia for a driver and get their thumbnail."""
    # Search for the driver
    params = {
        "action": "query",
        "format": "json",
        "list": "search",
        "srsearch": f"{name} Formula One racing driver",
        "srlimit": "3",
    }
    data = await fetch_json(session, WIKI_SEARCH, params)
    if not data:
        return None

    results = data.get("query", {}).get("search", [])
    for result in results:
        title = result.get("title", "").replace(" ", "_")
        # Get the summary with thumbnail
        summary = await fetch_json(session, f"{WIKI_SUMMARY}/{title}")
        if summary and "thumbnail" in summary:
            return summary["thumbnail"]["source"]

    return None


async def jolpica_wiki_thumbnail(
    session: aiohttp.ClientSession, jolpica_id: str
) -> str | None:
    """Try Jolpica -> Wikipedia URL -> thumbnail."""
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
        summary = await fetch_json(session, f"{WIKI_SUMMARY}/{wiki_title}")
        if summary and "thumbnail" in summary:
            return summary["thumbnail"]["source"]
    except (KeyError, IndexError):
        pass
    return None


async def find_headshot(
    session: aiohttp.ClientSession,
    driver_id: int,
    code: str | None,
    name: str,
    jolpica_id: str | None,
) -> tuple:
    # Check manual overrides first
    if name in WIKI_OVERRIDES:
        summary = await fetch_json(
            session, f"{WIKI_SUMMARY}/{WIKI_OVERRIDES[name]}"
        )
        if summary and "thumbnail" in summary:
            return (driver_id, code, name, summary["thumbnail"]["source"], "override")

    # Try Jolpica path again (some may have failed due to rate limiting)
    if jolpica_id:
        img = await jolpica_wiki_thumbnail(session, jolpica_id)
        if img:
            return (driver_id, code, name, img, "jolpica_retry")

    # Use Wikipedia search API
    img = await wiki_search_thumbnail(session, name)
    if img:
        return (driver_id, code, name, img, "wiki_search")

    return (driver_id, code, name, None, None)


async def main():
    async with AsyncSessionLocal() as db:
        r = await db.execute(
            text("""
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
        """)
        )
        drivers = r.fetchall()
        print(f"Found {len(drivers)} drivers still without headshots\n")

        found = 0
        not_found = []
        sources = {}

        async with aiohttp.ClientSession(headers=HTTP_HEADERS) as http:
            batch_size = 10
            for i in range(0, len(drivers), batch_size):
                batch = drivers[i : i + batch_size]
                tasks = []
                for did, code, name, jolpica_id in batch:
                    tasks.append(find_headshot(http, did, code, name, jolpica_id))

                results = await asyncio.gather(*tasks)

                for did, code, name, url, source in results:
                    if url:
                        found += 1
                        sources[source] = sources.get(source, 0) + 1
                        await db.execute(
                            text("""
                                UPDATE session_results
                                SET headshot_url = :url
                                WHERE driver_id = :did
                                  AND (headshot_url IS NULL
                                       OR headshot_url = 'None'
                                       OR headshot_url = 'nan'
                                       OR headshot_url NOT LIKE 'http%')
                            """),
                            {"url": url, "did": did},
                        )
                        print(f"  OK  [{source:14s}] {code or '---':6s} {name}")
                    else:
                        not_found.append((code, name))

                await db.commit()
                progress = min(i + batch_size, len(drivers))
                if progress % 50 == 0 or progress >= len(drivers):
                    print(f"\n  Progress: {progress}/{len(drivers)}, {found} found\n")

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
