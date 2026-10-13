"""Shared fact values and label grammar for driver facts and highlights."""

from dataclasses import dataclass


@dataclass(frozen=True)
class FactCandidate:
    id: str
    category: str
    text: str
    weight: int
    value: str | None = None
    label: str | None = None
    sublabel: str | None = None


def noun(total: int, singular: str, plural: str | None = None) -> str:
    """The noun form that matches the tally."""
    return singular if total == 1 else (plural or f"{singular}s")
