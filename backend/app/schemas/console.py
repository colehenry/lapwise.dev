"""Contracts for the homepage console replay.

One request carries everything the console draws: the session clock, the
per-lap car traces, the track-status windows and the event feed.
"""

from pydantic import BaseModel, ConfigDict, Field


class ConsoleFastestLap(BaseModel):
    """The quickest lap of the race and who set it."""

    driver_code: str | None
    seconds: float
    lap: int | None


class ConsoleStatusWindow(BaseModel):
    """A non-green stretch of the session, on the replay clock."""

    model_config = ConfigDict(populate_by_name=True)

    from_seconds: float = Field(alias="from")
    to_seconds: float = Field(alias="to")
    code: str
    label: str | None = None


class ConsoleLap(BaseModel):
    """One lap, keyed short because the payload carries a thousand of them.

    Only the four ingested speed traps appear; throttle, brake, gear and ERS
    are not ingested and are deliberately absent rather than zero-filled.
    """

    t: float | None
    c: str
    age: int | None
    s: list[float | None]
    v: list[int | None]
    pos: int | None
    pit: int
    pb: int


class ConsoleCar(BaseModel):
    """One car's whole race: identity, its lap clock, and its laps."""

    driver_code: str | None
    full_name: str
    team_name: str | None
    team_color: str | None
    headshot_url: str | None
    final_position: int | None
    start: list[float]
    end: float
    laps: list[ConsoleLap]


class ConsoleFeedEvent(BaseModel):
    """A thing that happened, placed on the session clock."""

    t: float
    lap: int
    kind: str
    text: str
    driver_code: str | None = None


class ConsoleReplayResponse(BaseModel):
    """Response for GET /api/replay/console/{season}/{round}."""

    event_name: str
    circuit_id: int
    circuit_name: str
    date: str
    total_laps: int
    t0: float
    t_end: float
    lead_changes: int
    fastest_lap: ConsoleFastestLap | None
    skips: list[list[float]]
    status: list[ConsoleStatusWindow]
    cars: list[ConsoleCar]
    feed: list[ConsoleFeedEvent]
