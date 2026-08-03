"""Canonical championship classifications and historical scoring context."""

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Column,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy import text as sql_text
from sqlalchemy.sql import func

from app.database import Base


class DriverChampionshipStanding(Base):
    __tablename__ = "driver_championship_standings"

    id = Column(Integer, primary_key=True)
    year = Column(Integer, nullable=False)
    driver_id = Column(
        Integer, ForeignKey("drivers.id", ondelete="CASCADE"), nullable=False
    )
    position = Column(Integer, nullable=False)
    championship_points = Column(Numeric(10, 3), nullable=False)
    wins = Column(Integer, nullable=False, server_default="0")
    source_round = Column(Integer, nullable=False)
    is_final = Column(Boolean, nullable=False, server_default="false")
    source_url = Column(String, nullable=False)
    ingested_at = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        UniqueConstraint("year", "driver_id", name="uq_driver_championship_year"),
        UniqueConstraint("year", "position", name="uq_driver_championship_position"),
        Index("idx_driver_championship_driver", "driver_id", "year"),
    )


class ConstructorChampionshipStanding(Base):
    __tablename__ = "constructor_championship_standings"

    id = Column(Integer, primary_key=True)
    year = Column(Integer, nullable=False)
    team_id = Column(
        Integer, ForeignKey("teams.id", ondelete="CASCADE"), nullable=False
    )
    position = Column(Integer, nullable=False)
    championship_points = Column(Numeric(10, 3), nullable=False)
    wins = Column(Integer, nullable=False, server_default="0")
    source_round = Column(Integer, nullable=False)
    is_final = Column(Boolean, nullable=False, server_default="false")
    source_url = Column(String, nullable=False)
    ingested_at = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        UniqueConstraint("year", "team_id", name="uq_constructor_championship_year"),
        UniqueConstraint(
            "year", "position", name="uq_constructor_championship_position"
        ),
        Index("idx_constructor_championship_team", "team_id", "year"),
    )


class ChampionshipScoringContext(Base):
    __tablename__ = "championship_scoring_contexts"

    id = Column(Integer, primary_key=True)
    year = Column(Integer, nullable=False)
    entrant_type = Column(String(20), nullable=False)
    kind = Column(String(30), nullable=False)
    short_label = Column(String, nullable=False)
    explanation = Column(Text, nullable=False)
    comparison_mode = Column(String(20), nullable=False, server_default="comparison")

    __table_args__ = (
        UniqueConstraint("year", "entrant_type", name="uq_championship_context"),
        CheckConstraint(
            "entrant_type IN ('driver', 'constructor')",
            name="ck_championship_context_type",
        ),
    )


class ChampionshipClassificationException(Base):
    __tablename__ = "championship_classification_exceptions"

    id = Column(Integer, primary_key=True)
    year = Column(Integer, nullable=False)
    entrant_type = Column(String(20), nullable=False)
    driver_id = Column(
        Integer, ForeignKey("drivers.id", ondelete="CASCADE"), nullable=True
    )
    team_id = Column(Integer, ForeignKey("teams.id", ondelete="CASCADE"), nullable=True)
    status = Column(String(30), nullable=False)
    points_scored = Column(Numeric(10, 3), nullable=True)
    explanation = Column(Text, nullable=False)
    source_url = Column(String, nullable=False)

    __table_args__ = (
        UniqueConstraint(
            "year", "entrant_type", "driver_id", "team_id", name="uq_champ_exception"
        ),
        CheckConstraint(
            "(entrant_type = 'driver' AND driver_id IS NOT NULL AND team_id IS NULL) "
            "OR (entrant_type = 'constructor' AND team_id IS NOT NULL AND driver_id IS NULL)",
            name="ck_champ_exception_entity",
        ),
        Index("idx_champ_exception_year", "year", "entrant_type"),
        Index(
            "uq_driver_champ_exception",
            "year",
            "driver_id",
            unique=True,
            postgresql_where=sql_text("entrant_type = 'driver'"),
        ),
        Index(
            "uq_constructor_champ_exception",
            "year",
            "team_id",
            unique=True,
            postgresql_where=sql_text("entrant_type = 'constructor'"),
        ),
    )
