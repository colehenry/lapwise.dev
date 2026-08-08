"""Wikimedia lookup for driver imagery.

Resolves a driver to candidate Commons files and their license metadata.
No database access and no image bytes: rights are established before anything
is downloaded.
"""

import re
from dataclasses import dataclass
from typing import List, Optional

import httpx

USER_AGENT = "LapwiseBot/1.0 (https://lapwise.dev; contact@lapwise.dev)"
WIKIPEDIA_API = "https://en.wikipedia.org/w/api.php"
WIKIDATA_API = "https://www.wikidata.org/w/api.php"
COMMONS_API = "https://commons.wikimedia.org/w/api.php"
JOLPICA_DRIVER = "https://api.jolpi.ca/ergast/f1/drivers/{driver_id}.json"
THUMB_WIDTH = 400

# Accepted because they permit commercial reuse and cropping. CC BY-SA is
# included knowingly: derivative crops inherit share-alike.
ALLOWED_LICENSE_PATTERNS = (
    r"^cc0\b",
    r"^public domain\b",
    r"^cc by \d",
    r"^cc by-sa \d",
)
# ND forbids the crops this pipeline produces; NC forbids commercial reuse.
DENIED_LICENSE_PATTERNS = (r"\bnd\b", r"\bnc\b", r"fair use", r"gfdl")

_TAG = re.compile(r"<[^>]+>")
_WS = re.compile(r"\s+")


@dataclass(frozen=True)
class SourceCandidate:
    """One Commons file with the provenance needed to decide on it."""

    filename: str
    file_url: str
    page_url: str
    width: int
    height: int
    mime_type: str
    thumb_url: str
    license_code: str
    license_url: Optional[str]
    author_name: Optional[str]
    attribution_text: str
    is_curated: bool

    @property
    def long_edge(self) -> int:
        return max(self.width, self.height)

    @property
    def license_allowed(self) -> bool:
        return license_allowed(self.license_code)


def license_allowed(license_code: Optional[str]) -> bool:
    """Whether a Commons license string permits hosting and cropping."""
    if not license_code:
        return False
    value = license_code.strip().lower()
    if any(re.search(p, value) for p in DENIED_LICENSE_PATTERNS):
        return False
    return any(re.match(p, value) for p in ALLOWED_LICENSE_PATTERNS)


def _plain(value: Optional[str]) -> str:
    """Commons returns HTML in extmetadata fields."""
    if not value:
        return ""
    return _WS.sub(" ", _TAG.sub("", value)).strip()


class WikimediaSource:
    """Driver to Commons file resolution over the MediaWiki APIs."""

    def __init__(self, client: Optional[httpx.Client] = None) -> None:
        self._client = client or httpx.Client(
            headers={"User-Agent": USER_AGENT}, timeout=25.0
        )

    def _get(self, url: str, params: dict) -> dict:
        response = self._client.get(url, params={**params, "format": "json"})
        response.raise_for_status()
        return response.json()

    def wikipedia_title(self, jolpica_id: str) -> Optional[str]:
        """Wikipedia article title from the Jolpica driver record."""
        response = self._client.get(JOLPICA_DRIVER.format(driver_id=jolpica_id))
        if response.status_code != 200:
            return None
        drivers = response.json()["MRData"]["DriverTable"]["Drivers"]
        if not drivers or "url" not in drivers[0]:
            return None
        return httpx.URL(drivers[0]["url"]).path.rsplit("/", 1)[-1]

    def wikidata_id(self, wikipedia_title: str) -> Optional[str]:
        """Wikidata entity for an article, following redirects.

        Redirects matter: several drivers are filed under a different name than
        the one Jolpica reports.
        """
        data = self._get(
            WIKIPEDIA_API,
            {
                "action": "query",
                "prop": "pageprops",
                "titles": wikipedia_title,
                "redirects": "1",
            },
        )
        pages = data.get("query", {}).get("pages", {})
        for page in pages.values():
            entity = page.get("pageprops", {}).get("wikibase_item")
            if entity:
                return entity
        return None

    def _claim(self, entity: str, prop: str) -> Optional[str]:
        data = self._get(
            WIKIDATA_API,
            {"action": "wbgetclaims", "entity": entity, "property": prop},
        )
        claims = data.get("claims", {}).get(prop)
        if not claims:
            return None
        return claims[0]["mainsnak"]["datavalue"]["value"]

    def curated_image(self, entity: str) -> Optional[str]:
        """Wikidata P18, the image chosen to depict this person."""
        return self._claim(entity, "P18")

    def commons_category(self, entity: str) -> Optional[str]:
        """Wikidata P373, the Commons category collecting this person's files."""
        return self._claim(entity, "P373")

    def _to_candidates(
        self, pages: dict, curated: Optional[str]
    ) -> List[SourceCandidate]:
        candidates: List[SourceCandidate] = []
        for page in pages.values():
            info = (page.get("imageinfo") or [None])[0]
            if not info:
                continue
            meta = info.get("extmetadata", {})

            def field(key: str) -> Optional[str]:
                return (meta.get(key) or {}).get("value")

            filename = page["title"].removeprefix("File:")
            author = _plain(field("Artist")) or None
            license_code = _plain(field("LicenseShortName"))
            candidates.append(
                SourceCandidate(
                    filename=filename,
                    file_url=info["url"],
                    page_url=info.get("descriptionurl", ""),
                    width=info.get("width", 0),
                    height=info.get("height", 0),
                    mime_type=info.get("mime", ""),
                    license_code=license_code,
                    license_url=_plain(field("LicenseUrl")) or None,
                    author_name=author,
                    attribution_text=_plain(field("Attribution"))
                    or (f"{author} via Wikimedia Commons" if author else filename),
                    thumb_url=info.get("thumburl") or info["url"],
                    is_curated=filename == curated,
                )
            )
        return candidates

    def file_details(self, filename: str) -> Optional[SourceCandidate]:
        """Full metadata for one named Commons file."""
        data = self._get(
            COMMONS_API,
            {
                "action": "query",
                "titles": f"File:{filename}",
                "prop": "imageinfo",
                "iiprop": "url|size|mime|extmetadata",
                "iiurlwidth": THUMB_WIDTH,
            },
        )
        pages = data.get("query", {}).get("pages", {})
        found = self._to_candidates(pages, filename)
        return found[0] if found else None

    def category_files(self, category: str, limit: int = 40) -> List[SourceCandidate]:
        """Files in a Commons category, unranked.

        Deliberately unsorted. Ranking by resolution surfaces cars, helmets and
        museum pieces ahead of portraits, because those are photographed better
        than mid-century drivers were.
        """
        data = self._get(
            COMMONS_API,
            {
                "action": "query",
                "generator": "categorymembers",
                "gcmtitle": f"Category:{category}",
                "gcmtype": "file",
                "gcmlimit": limit,
                "prop": "imageinfo",
                "iiprop": "url|size|mime|extmetadata",
                "iiurlwidth": THUMB_WIDTH,
            },
        )
        pages = data.get("query", {}).get("pages", {})
        return self._to_candidates(pages, None)

    def search_files(self, name: str, limit: int = 40) -> List[SourceCandidate]:
        """Commons files whose title contains the driver's name."""
        data = self._get(
            COMMONS_API,
            {
                "action": "query",
                "generator": "search",
                "gsrsearch": f'intitle:"{name}"',
                "gsrnamespace": 6,
                "gsrlimit": limit,
                "prop": "imageinfo",
                "iiprop": "url|size|mime|extmetadata",
                "iiurlwidth": THUMB_WIDTH,
            },
        )
        return self._to_candidates(data.get("query", {}).get("pages", {}), None)

    def close(self) -> None:
        self._client.close()


# Filenames describing objects rather than people. Race and grand prix are
# deliberately absent: good portraits are routinely named after the event.
_OBJECT_WORDS = re.compile(
    r"\b(car|helmet|helm|integralhelm|casco|casque|cockpit|garage|chassis|livery|"
    r"logo|signature|grave|statue|museum|museo|monument|circuit|track|pit ?lane|"
    r"wheel|engine|motor|tyre|tire|trophy|poster|plaque|memorial|crash|"
    r"accelerat\w*|corner|straight|paddock view|steering)\b",
    re.I,
)


def rank_candidates_for(
    candidates: List[SourceCandidate], surname: str, min_long_edge: int
) -> List[SourceCandidate]:
    """Order candidates most portrait-like first.

    Ordering only. These are never auto-ingested: name searches return other
    people entirely (there is a footballer named Sergio Perez), group shots, and
    objects, none of which a score reliably separates from a driver portrait.
    """

    def points(candidate: SourceCandidate) -> int:
        name = candidate.filename.lower()
        score = 40 if surname.lower() in name else -60
        if "cropped" in name:
            score += 35  # Commons convention for a portrait crop
        if candidate.height >= candidate.width:
            score += 20
        if candidate.height >= candidate.width * 1.15:
            score += 10
        if _OBJECT_WORDS.search(name):
            score -= 70
        if candidate.long_edge >= 1200:
            score += 5
        return score

    usable = [
        candidate
        for candidate in candidates
        if candidate.license_allowed
        and candidate.mime_type.startswith("image/")
        and candidate.long_edge >= min_long_edge
    ]
    return sorted(usable, key=points, reverse=True)
