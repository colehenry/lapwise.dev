"""Results services — split by domain from the former results_service.py."""

from app.services.results.common import _make_slug
from app.services.results.laps import LapsService
from app.services.results.practice import PracticeService
from app.services.results.progression import ProgressionService
from app.services.results.qualifying_sessions import QualifyingSessionsService
from app.services.results.qualifying_standings import QualifyingStandingsService
from app.services.results.session_data import SessionDataService
from app.services.results.standings import StandingsService

__all__ = [
    "LapsService",
    "PracticeService",
    "ProgressionService",
    "QualifyingSessionsService",
    "QualifyingStandingsService",
    "SessionDataService",
    "StandingsService",
    "_make_slug",
]
