"""Small, frequently refreshed discovery response for the homepage."""

from pydantic import BaseModel

from app.schemas.result import RoundSummary


class ConsoleReplayReference(BaseModel):
    season: int
    round: int
    revision: str


class ConsoleAvailabilityResponse(BaseModel):
    season: int | None
    latest: RoundSummary | None
    replay: ConsoleReplayReference | None
