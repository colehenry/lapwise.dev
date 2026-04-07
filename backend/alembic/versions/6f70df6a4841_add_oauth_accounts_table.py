"""add oauth_accounts table

Revision ID: 6f70df6a4841
Revises: aee5e56ac965
Create Date: 2026-04-06 22:02:52.763930

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '6f70df6a4841'
down_revision: Union[str, None] = 'aee5e56ac965'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'oauth_accounts',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('provider', sa.String(length=32), nullable=False),
        sa.Column('provider_account_id', sa.String(length=255), nullable=False),
        sa.Column('email', sa.String(), nullable=True),
        sa.Column(
            'created_at',
            sa.DateTime(timezone=True),
            server_default=sa.text('now()'),
            nullable=True,
        ),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint(
            'provider',
            'provider_account_id',
            name='uq_oauth_provider_account',
        ),
    )
    op.create_index(
        op.f('ix_oauth_accounts_id'), 'oauth_accounts', ['id'], unique=False
    )
    op.create_index(
        op.f('ix_oauth_accounts_user_id'),
        'oauth_accounts',
        ['user_id'],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f('ix_oauth_accounts_user_id'), table_name='oauth_accounts')
    op.drop_index(op.f('ix_oauth_accounts_id'), table_name='oauth_accounts')
    op.drop_table('oauth_accounts')
