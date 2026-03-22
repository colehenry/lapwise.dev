"""
Ingest F1 team (constructor) logos from Wikipedia.
"""
import asyncio
import sys
import os

# Add backend to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

import json
import urllib.parse
import urllib.request
from sqlalchemy import text
from app.database import AsyncSessionLocal

WIKI_SEARCH = "https://en.wikipedia.org/w/api.php"
WIKI_SUMMARY = "https://en.wikipedia.org/api/rest_v1/page/summary"
COMMONS_API = "https://commons.wikimedia.org/w/api.php"
SEMAPHORE = asyncio.Semaphore(5)
HTTP_HEADERS = {
    "User-Agent": "LapwiseBot/1.0 (https://lapwise.dev; contact@lapwise.dev)"
}

# Manual overrides for known teams (Wikipedia page titles)
WIKI_OVERRIDES = {
    "Red Bull": "Red_Bull_Racing",
    "Mercedes": "Mercedes-AMG_Petronas_F1_Team",
    "Ferrari": "Scuderia_Ferrari",
    "McLaren": "McLaren_Racing",
    "Aston Martin": "Aston_Martin_in_Formula_One",
    "Alpine": "Alpine_F1_Team",
    "Williams": "Williams_Grand_Prix_Engineering",
    "RB": "RB_Formula_One_Team",
    "Haas": "Haas_F1_Team",
    "Sauber": "Sauber_Motorsport",
    "Alfa Romeo": "Alfa_Romeo_in_Formula_One",
    "AlphaTauri": "Scuderia_AlphaTauri",
    "Renault": "Renault_in_Formula_One",
    "Racing Point": "Racing_Point_F1_Team",
    "Force India": "Force_India",
    "Toro Rosso": "Scuderia_Toro_Rosso",
    "Lotus": "Lotus_F1",
    "Manor Marussia": "Manor_Motorsport",
    "Marussia": "Marussia_F1",
    "Caterham": "Caterham_F1",
    "HRT": "HRT_Formula_1_Team",
    "Virgin": "Virgin_Racing",
    "Lotus F1": "Lotus_F1",
    "Benetton": "Benetton_Formula",
    "Jordan": "Jordan_Grand_Prix",
    "BAR": "British_American_Racing",
    "Jaguar": "Jaguar_Racing",
    "Toyota": "Toyota_Racing_(Formula_One)",
    "BMW Sauber": "BMW_Sauber",
}

# Official F1 CDN logo URLs for current teams (2026 season)
# These are direct image URLs from formula1.com team pages.
F1_CDN_OVERRIDES = {
    "Alpine": "https://media.formula1.com/image/upload/c_fit,h_64/q_auto/v1740000000/common/f1/2025/alpine/2025alpinelogowhite.webp",
    "Aston Martin": "https://media.formula1.com/image/upload/c_fit,h_64/q_auto/v1740000000/common/f1/2025/astonmartin/2025astonmartinlogowhite.webp",
    "Audi": "https://media.formula1.com/image/upload/c_fit,h_64/q_auto/v1740000000/common/f1/2026/audi/2026audilogowhite.webp",
    "Cadillac": "https://media.formula1.com/image/upload/c_fit,h_64/q_auto/v1740000000/common/f1/2026/cadillac/2026cadillaclogowhite.webp",
    "Ferrari": "https://media.formula1.com/image/upload/c_fit,h_64/q_auto/v1740000000/common/f1/2025/ferrari/2025ferrarilogolight.webp",
    "Haas": "https://media.formula1.com/image/upload/c_fit,h_64/q_auto/v1740000000/common/f1/2025/haas/2025haaslogowhite.webp",
    "Haas F1 Team": "https://media.formula1.com/image/upload/c_fit,h_64/q_auto/v1740000000/common/f1/2025/haas/2025haaslogowhite.webp",
    "McLaren": "https://media.formula1.com/image/upload/c_fit,h_64/q_auto/v1740000000/common/f1/2025/mclaren/2025mclarenlogowhite.webp",
    "Mercedes": "https://media.formula1.com/image/upload/c_fit,h_64/q_auto/v1740000000/common/f1/2025/mercedes/2025mercedeslogowhite.webp",
    "Kick Sauber": "https://media.formula1.com/image/upload/c_fit,h_64/q_auto/v1740000000/common/f1/2025/kicksauber/2025kicksauberlogowhite.webp",
    "Sauber": "https://media.formula1.com/image/upload/c_fit,h_64/q_auto/v1740000000/common/f1/2025/kicksauber/2025kicksauberlogowhite.webp",
    "Stake": "https://media.formula1.com/image/upload/c_fit,h_64/q_auto/v1740000000/common/f1/2025/kicksauber/2025kicksauberlogowhite.webp",
    "Racing Bulls": "https://media.formula1.com/image/upload/c_fit,h_64/q_auto/v1740000000/common/f1/2025/racingbulls/2025racingbullslogowhite.webp",
    "RB": "https://media.formula1.com/image/upload/c_fit,h_64/q_auto/v1740000000/common/f1/2025/racingbulls/2025racingbullslogowhite.webp",
    "Red Bull": "https://media.formula1.com/image/upload/c_fit,h_64/q_auto/v1740000000/common/f1/2025/redbullracing/2025redbullracinglogowhite.webp",
    "Red Bull Racing": "https://media.formula1.com/image/upload/c_fit,h_64/q_auto/v1740000000/common/f1/2025/redbullracing/2025redbullracinglogowhite.webp",
    "Williams": "https://media.formula1.com/image/upload/c_fit,h_64/q_auto/v1740000000/common/f1/2025/williams/2025williamslogowhite.webp",
}

# Manual overrides for Commons logo files (fallbacks)
# Use File: titles without the "File:" prefix.
COMMONS_OVERRIDES = {
    "McLaren": "McLaren_Racing_logo.svg",
    "Mercedes": "Mercedes_AMG_Petronas_F1_Logo.svg",
    "Red Bull": "Red_Bull_Racing_logo.svg",
    "Ferrari": "Ferrari_wordmark.svg",
    "Aston Martin": "Aston_Martin_F1_Team_logo.svg",
    "Alpine": "Alpine_F1_Team_logo.svg",
    "Williams": "Williams_Racing_2023_logo.svg",
    "Haas": "Haas_F1_Team_logo.svg",
    "Sauber": "Stake_F1_Team_Kick_Sauber_logo.svg",
    "RB": "RB_Formula_One_Team_logo.svg",
}


async def fetch_json(url: str, params=None):
    try:
        async with SEMAPHORE:
            if params:
                query = urllib.parse.urlencode(params)
                full_url = f"{url}?{query}"
            else:
                full_url = url
            req = urllib.request.Request(full_url, headers=HTTP_HEADERS)
            with urllib.request.urlopen(req, timeout=15) as resp:
                if resp.status == 200:
                    return json.loads(resp.read().decode("utf-8"))
    except Exception as e:
        print(f"Error fetching {url}: {e}")
    return None


async def fetch_commons_image(file_title: str, thumb_width: int = 256) -> str | None:
    """Fetch a direct image URL from Wikimedia Commons (prefer PNG thumbs for SVGs)."""
    params = {
        "action": "query",
        "format": "json",
        "titles": f"File:{file_title}",
        "prop": "imageinfo",
        "iiprop": "url|mime",
        "iiurlwidth": str(thumb_width),
    }
    data = await fetch_json(COMMONS_API, params)
    if not data:
        return None
    pages = data.get("query", {}).get("pages", {})
    for page in pages.values():
        imageinfo = page.get("imageinfo", [])
        if not imageinfo:
            continue
        info = imageinfo[0]
        mime = info.get("mime", "")
        # For SVGs, use the PNG thumb URL. Otherwise, use the original file URL.
        if mime == "image/svg+xml" and info.get("thumburl"):
            return info["thumburl"]
        if info.get("url"):
            return info["url"]
    return None


async def wiki_search_logo(name: str) -> str | None:
    """Search Wikipedia for a team and get their thumbnail/logo."""
    # Try the name directly or with "F1 team" suffix
    search_queries = [f"{name} Formula One team", f"{name} racing team", name]

    for query in search_queries:
        params = {
            "action": "query",
            "format": "json",
            "list": "search",
            "srsearch": query,
            "srlimit": "3",
        }
        data = await fetch_json(WIKI_SEARCH, params)
        if not data:
            continue

        results = data.get("query", {}).get("search", [])
        for result in results:
            title = result.get("title", "").replace(" ", "_")
            # Get the summary with thumbnail
            summary = await fetch_json(f"{WIKI_SUMMARY}/{title}")
            if summary and "thumbnail" in summary:
                # Wikipedia summaries often have the logo as the main image for F1 teams
                return summary["thumbnail"]["source"]

    return None


async def find_logo(
    team_name: str,
) -> tuple:
    # Prefer official F1 CDN logo overrides for current teams
    if team_name in F1_CDN_OVERRIDES:
        return (team_name, F1_CDN_OVERRIDES[team_name], "f1_cdn_override")

    # Prefer Commons overrides (clean logo files)
    if team_name in COMMONS_OVERRIDES:
        commons_file = COMMONS_OVERRIDES[team_name]
        url = await fetch_commons_image(commons_file)
        if url:
            return (team_name, url, "commons_override")

    # Check manual overrides first
    search_name = team_name
    if team_name in WIKI_OVERRIDES:
        search_name = WIKI_OVERRIDES[team_name]
        summary = await fetch_json(f"{WIKI_SUMMARY}/{search_name}")
        if summary and "thumbnail" in summary:
            return (team_name, summary["thumbnail"]["source"], "override")

    # Use Wikipedia search API
    img = await wiki_search_logo(team_name)
    if img:
        return (team_name, img, "wiki_search")

    return (team_name, None, None)


async def main():
    async with AsyncSessionLocal() as db:
        # Get unique team names
        r = await db.execute(text("SELECT DISTINCT name FROM teams ORDER BY name"))
        teams = [row[0] for row in r.fetchall()]
        print(f"Found {len(teams)} unique teams to process")

        found = 0
        sources = {}

        batch_size = 5
        for i in range(0, len(teams), batch_size):
            batch = teams[i : i + batch_size]
            tasks = []
            for name in batch:
                tasks.append(find_logo(name))

            results = await asyncio.gather(*tasks)

            for name, url, source in results:
                if url:
                    found += 1
                    sources[source] = sources.get(source, 0) + 1
                    # Update all team records with this name
                    await db.execute(
                        text("UPDATE teams SET logo_url = :url WHERE name = :name"),
                        {"url": url, "name": name},
                    )
                    print(f"  OK  [{source:14s}] {name}")
                else:
                    print(f"  --  [NOT FOUND     ] {name}")

            await db.commit()
            progress = min(i + batch_size, len(teams))
            print(f"Progress: {progress}/{len(teams)}, {found} found")

        print(f"\n{'='*60}")
        print(f"Done! Found logos for {found}/{len(teams)} teams")
        print(f"Sources: {sources}")


if __name__ == "__main__":
    asyncio.run(main())
