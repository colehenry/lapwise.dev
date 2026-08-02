"""merge duplicate circuit rows

Revision ID: c17f9a4be230
Revises: a94e2d1f7c85
Create Date: 2026-08-01

Historical ingestion (Jolpica) and modern ingestion (FastF1) name the same
venue differently, so several tracks hold two or three circuit rows split by
era: "Montreal"/"Montréal", "Abu Dhabi"/"Yas Marina"/"Yas Island". Track maps
are static PNGs keyed by circuit id, so sessions attached to the historical row
render no map at all.

Each pair below was checked as the same physical venue. Same-named grands prix
that genuinely moved (Reims -> Paul Ricard, Adelaide -> Melbourne, Estoril ->
Portimão) are deliberately left alone, as is Nürburg/Nürburgring: that row
covers both the Nordschleife and the modern GP-Strecke, so merging it would
show the wrong layout for pre-1977 races.

The surviving id is the row current ingestion writes to, so new sessions keep
landing on it.
"""

from typing import Sequence, Union

from sqlalchemy import text

from alembic import op

revision: str = "c17f9a4be230"
down_revision: Union[str, None] = "a94e2d1f7c85"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# duplicate id -> surviving id
CIRCUIT_MERGES = {
    36: 10,  # Montreal -> Montréal (Circuit Gilles Villeneuve)
    39: 24,  # Abu Dhabi -> Yas Island (Yas Marina)
    35: 24,  # Yas Marina -> Yas Island (same venue, split at 2018/2019)
    34: 18,  # Singapore -> Marina Bay
    25: 6,  # Miami -> Miami Gardens (Miami International Autodrome)
    84: 13,  # Spa -> Spa-Francorchamps (orphan row, no sessions)
}


def upgrade() -> None:
    conn = op.get_bind()
    for duplicate_id, survivor_id in CIRCUIT_MERGES.items():
        conn.execute(
            text("UPDATE sessions SET circuit_id = :survivor WHERE circuit_id = :dup"),
            {"survivor": survivor_id, "dup": duplicate_id},
        )
        conn.execute(
            text(
                "UPDATE users SET favorite_circuit_id = :survivor "
                "WHERE favorite_circuit_id = :dup"
            ),
            {"survivor": survivor_id, "dup": duplicate_id},
        )
        conn.execute(
            text("DELETE FROM circuits WHERE id = :dup"), {"dup": duplicate_id}
        )


def downgrade() -> None:
    # The duplicate rows carried no data beyond a name, and the original
    # session-to-circuit split cannot be reconstructed once merged.
    pass
