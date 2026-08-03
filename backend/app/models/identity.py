"""Canonical identities and source mappings for ingested F1 entities."""

from sqlalchemy import (
    Column,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy import text as sql_text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database import Base


class DriverExternalId(Base):
    __tablename__ = "driver_external_ids"

    id = Column(Integer, primary_key=True)
    driver_id = Column(
        Integer, ForeignKey("drivers.id", ondelete="CASCADE"), nullable=False
    )
    source = Column(String(30), nullable=False)
    external_id = Column(String, nullable=False)

    driver = relationship("Driver", back_populates="external_ids")

    __table_args__ = (
        UniqueConstraint("source", "external_id", name="uq_driver_external_id"),
        Index("idx_driver_external_owner", "driver_id", "source"),
    )


class DriverSeason(Base):
    __tablename__ = "driver_seasons"

    id = Column(Integer, primary_key=True)
    driver_id = Column(
        Integer, ForeignKey("drivers.id", ondelete="CASCADE"), nullable=False
    )
    year = Column(Integer, nullable=False)
    driver_code = Column(String(3), nullable=True)
    driver_number = Column(Integer, nullable=True)
    display_name = Column(String, nullable=False)

    driver = relationship("Driver", back_populates="seasons")

    __table_args__ = (
        UniqueConstraint("year", "driver_id", name="uq_driver_season"),
        Index("idx_driver_season_year_code", "year", "driver_code"),
        Index(
            "uq_driver_season_code",
            "year",
            "driver_code",
            unique=True,
            postgresql_where=sql_text("driver_code IS NOT NULL"),
        ),
    )


class Constructor(Base):
    __tablename__ = "constructors"

    id = Column(Integer, primary_key=True)
    slug = Column(String, nullable=False, unique=True, index=True)
    canonical_name = Column(String, nullable=False)
    lineage_id = Column(
        Integer, ForeignKey("constructors.id", ondelete="SET NULL"), nullable=True
    )

    teams = relationship("Team", back_populates="constructor")
    external_ids = relationship(
        "ConstructorExternalId",
        back_populates="constructor",
        cascade="all, delete-orphan",
    )


class ConstructorExternalId(Base):
    __tablename__ = "constructor_external_ids"

    id = Column(Integer, primary_key=True)
    constructor_id = Column(
        Integer, ForeignKey("constructors.id", ondelete="CASCADE"), nullable=False
    )
    source = Column(String(30), nullable=False)
    external_id = Column(String, nullable=False)

    constructor = relationship("Constructor", back_populates="external_ids")

    __table_args__ = (
        UniqueConstraint("source", "external_id", name="uq_constructor_external_id"),
        Index("idx_constructor_external_owner", "constructor_id", "source"),
    )


class CircuitVenue(Base):
    __tablename__ = "circuit_venues"

    id = Column(Integer, primary_key=True)
    slug = Column(String, nullable=False, unique=True, index=True)
    canonical_name = Column(String, nullable=False)
    location = Column(String, nullable=False)
    country = Column(String, nullable=False)

    layouts = relationship("Circuit", back_populates="venue")
    external_ids = relationship(
        "CircuitVenueExternalId",
        back_populates="venue",
        cascade="all, delete-orphan",
    )


class CircuitVenueExternalId(Base):
    __tablename__ = "circuit_venue_external_ids"

    id = Column(Integer, primary_key=True)
    venue_id = Column(
        Integer, ForeignKey("circuit_venues.id", ondelete="CASCADE"), nullable=False
    )
    source = Column(String(30), nullable=False)
    external_id = Column(String, nullable=False)

    venue = relationship("CircuitVenue", back_populates="external_ids")

    __table_args__ = (
        UniqueConstraint("source", "external_id", name="uq_circuit_external_id"),
        Index("idx_circuit_external_owner", "venue_id", "source"),
    )


class IngestIdentityIssue(Base):
    __tablename__ = "ingest_identity_issues"

    id = Column(Integer, primary_key=True)
    entity_type = Column(String(20), nullable=False)
    source = Column(String(30), nullable=False)
    source_id = Column(String, nullable=True)
    raw_name = Column(String, nullable=True)
    year = Column(Integer, nullable=True)
    round = Column(Integer, nullable=True)
    status = Column(String(20), nullable=False, server_default="open")
    details = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    resolved_at = Column(DateTime(timezone=True), nullable=True)

    __table_args__ = (Index("idx_identity_issue_status", "status", "entity_type"),)
