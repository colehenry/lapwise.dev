"""add logo_url to teams

Revision ID: d7634a4183a2
Revises: 1d740d5ce40e
Create Date: 2026-02-25 22:11:45.579725

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd7634a4183a2'
down_revision: Union[str, None] = '1d740d5ce40e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('teams', sa.Column('logo_url', sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column('teams', 'logo_url')
