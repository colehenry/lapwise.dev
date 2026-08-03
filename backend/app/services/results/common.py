"""Shared helpers for the results services."""

import math
from types import SimpleNamespace
from typing import Optional

from sqlalchemy import func, literal_column, select
from sqlalchemy.orm import aliased

from app.models import Driver, Session, SessionResult


def json_rows(model, alias_name: str, conditions):
    """Scalar subquery returning matching rows as one JSON array.

    Lets several independent lookups travel in a single statement.
    `conditions` receives the aliased model and returns a filter sequence.
    """
    alias = aliased(model, name=alias_name)
    return (
        select(
            func.coalesce(
                func.jsonb_agg(func.to_jsonb(literal_column(alias_name))),
                literal_column("'[]'::jsonb"),
            )
        )
        .select_from(alias)
        .where(*conditions(alias))
        .scalar_subquery()
    )


def as_records(rows) -> list[SimpleNamespace]:
    """Attribute access over rows returned by `json_rows`."""
    return [SimpleNamespace(**row) for row in rows or []]


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
