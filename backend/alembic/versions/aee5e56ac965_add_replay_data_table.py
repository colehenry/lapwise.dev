"""Add replay_data table

Revision ID: aee5e56ac965
Revises: a1b2c3d4e5f6
Create Date: 2026-03-27 19:11:35.629168

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'aee5e56ac965'
down_revision: Union[str, None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table('replay_data',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('session_id', sa.Integer(), nullable=False),
    sa.Column('total_frames', sa.Integer(), nullable=False),
    sa.Column('total_duration_seconds', sa.Float(), nullable=False),
    sa.Column('total_laps', sa.Integer(), nullable=False),
    sa.Column('driver_count', sa.Integer(), nullable=False),
    sa.Column('compressed_size_bytes', sa.Integer(), nullable=False),
    sa.Column('data', sa.LargeBinary(), nullable=False),
    sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['session_id'], ['sessions.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('session_id')
    )
    op.create_index('idx_replay_session', 'replay_data', ['session_id'], unique=True)
    op.create_index(op.f('ix_replay_data_id'), 'replay_data', ['id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_replay_data_id'), table_name='replay_data')
    op.drop_index('idx_replay_session', table_name='replay_data')
    op.drop_table('replay_data')
