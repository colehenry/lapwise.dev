"""Contract for the archive entry tiles."""

from pydantic import BaseModel


class ArchiveCountsResponse(BaseModel):
    """Response for GET /api/archive/counts.

    Four integers and a year. The tiles previously needed every driver, every
    constructor and every circuit row to render them.
    """

    drivers: int
    constructors: int
    circuits: int
    races: int
    first_season: int | None
