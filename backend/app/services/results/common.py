"""Shared helpers for the results services."""

import math
from typing import Optional

from sqlalchemy import func, select

from app.models import Driver, Session, SessionResult


def _make_slug(jolpica_id: Optional[str], full_name: str) -> str:
    """Compute URL-safe driver slug from jolpica_id or full_name."""
    if jolpica_id:
        return jolpica_id.replace("_", "-")
    return full_name.lower().replace(" ", "-")


def latest_headshot_subquery():
    """Correlated subquery to fetch the latest valid headshot URL for a driver."""
    return (
        select(SessionResult.headshot_url)
        .join(Session, SessionResult.session_id == Session.id)
        .where(SessionResult.driver_id == Driver.id)
        .where(SessionResult.headshot_url.isnot(None))
        .where(SessionResult.headshot_url != "None")
        .where(SessionResult.headshot_url != "nan")
        .where(SessionResult.headshot_url != "")
        .order_by(Session.date.desc(), Session.round.desc())
        .limit(1)
        .scalar_subquery()
    )


def headshot_fallback_expr():
    """Prefer the session headshot if valid, otherwise fall back to latest."""
    cleaned = func.nullif(
        func.nullif(func.nullif(SessionResult.headshot_url, "None"), "nan"), ""
    )
    return func.coalesce(cleaned, latest_headshot_subquery())


def sanitize_float(value: Optional[float]) -> Optional[float]:
    """Convert inf/nan float values to None for JSON serialization"""
    if value is None:
        return None
    if math.isnan(value) or math.isinf(value):
        return None
    return value
