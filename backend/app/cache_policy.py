"""
Response Cache Policy

Classifies every public endpoint by freshness so shared caches can serve
repeat navigation without origin work. The default is `no-store`: an endpoint
becomes cacheable only by matching a rule here, so a new route cannot leak
into a shared cache by omission.

Season-scoped paths resolve against the current year. A completed season's
results never change, so they carry a long TTL; the running season carries a
short TTL plus stale-while-revalidate.
"""

import re
from datetime import date

NO_STORE = "private, no-store"

# Freshness tiers, in seconds: (max-age, stale-while-revalidate)
_COMPLETED_SEASON = (7 * 24 * 3600, 30 * 24 * 3600)
_RUNNING_SEASON = (60, 300)
_ARCHIVE = (600, 3600)
_METADATA = (3600, 86400)
_LATEST = (300, 3600)
_STATIC_ASSET = (7 * 24 * 3600, 30 * 24 * 3600)

# Paths that must never enter a shared cache, matched before anything else.
_PRIVATE_PREFIXES = (
    "/auth",
    "/api/users",
    "/api/admin",
    "/api/comments",
)

_SEASON_RESULTS = re.compile(r"^/api/results/(\d{4})(/|$)")

# (pattern, tier). Order matters: the first match wins.
_PUBLIC_RULES: list[tuple[re.Pattern[str], tuple[int, int]]] = [
    (re.compile(r"^/api/results/seasons$"), _METADATA),
    (re.compile(r"^/api/results/latest$"), _LATEST),
    (re.compile(r"^/api/replay/(seasons|available)$"), _METADATA),
    (re.compile(r"^/api/replay/track/\d+$"), _STATIC_ASSET),
    (re.compile(r"^/api/events/"), _ARCHIVE),
    (re.compile(r"^/api/(drivers|constructors|circuits)(/|$)"), _ARCHIVE),
]


def _directive(max_age: int, stale_while_revalidate: int) -> str:
    return f"public, max-age={max_age}, stale-while-revalidate={stale_while_revalidate}"


def add_vary_header(response, field: str) -> None:
    """Append a field to Vary without dropping one an upstream layer set."""
    existing = response.headers.get("Vary")
    if not existing:
        response.headers["Vary"] = field
        return
    fields = [part.strip() for part in existing.split(",")]
    if field.lower() not in {part.lower() for part in fields}:
        response.headers["Vary"] = f"{existing}, {field}"


def cache_control_for(path: str, *, today: date | None = None) -> str:
    """
    Resolve the Cache-Control directive for a request path.

    Returns `private, no-store` for anything not explicitly public.
    """
    if any(path.startswith(prefix) for prefix in _PRIVATE_PREFIXES):
        return NO_STORE

    season_match = _SEASON_RESULTS.match(path)
    if season_match:
        season = int(season_match.group(1))
        current_year = (today or date.today()).year
        tier = _COMPLETED_SEASON if season < current_year else _RUNNING_SEASON
        return _directive(*tier)

    for pattern, tier in _PUBLIC_RULES:
        if pattern.match(path):
            return _directive(*tier)

    return NO_STORE
