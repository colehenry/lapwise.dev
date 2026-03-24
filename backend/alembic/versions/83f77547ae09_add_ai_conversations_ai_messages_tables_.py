"""add ai_conversations ai_messages tables and user rate limiting

Revision ID: 83f77547ae09
Revises: 3471c434babe
Create Date: 2026-03-23 21:59:28.633595

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '83f77547ae09'
down_revision: Union[str, None] = '3471c434babe'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # AI conversations table
    op.create_table('ai_conversations',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('user_id', sa.Integer(), nullable=False),
    sa.Column('title', sa.String(length=200), nullable=True),
    sa.Column('model_used', sa.String(length=50), nullable=True),
    sa.Column('message_count', sa.Integer(), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_ai_conversations_user_id'), 'ai_conversations', ['user_id'], unique=False)

    # AI messages table
    op.create_table('ai_messages',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('conversation_id', sa.UUID(), nullable=False),
    sa.Column('role', sa.String(length=20), nullable=False),
    sa.Column('content', sa.Text(), nullable=False),
    sa.Column('tool_calls', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    sa.Column('tool_results', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    sa.Column('tokens_used', sa.Integer(), nullable=True),
    sa.Column('model', sa.String(length=50), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
    sa.ForeignKeyConstraint(['conversation_id'], ['ai_conversations.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index('idx_ai_messages_conversation', 'ai_messages', ['conversation_id', 'created_at'], unique=False)

    # Rate limiting columns on users
    op.add_column('users', sa.Column('ai_queries_today', sa.Integer(), server_default='0', nullable=False))
    op.add_column('users', sa.Column('ai_queries_reset_at', sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column('users', 'ai_queries_reset_at')
    op.drop_column('users', 'ai_queries_today')
    op.drop_index('idx_ai_messages_conversation', table_name='ai_messages')
    op.drop_table('ai_messages')
    op.drop_index(op.f('ix_ai_conversations_user_id'), table_name='ai_conversations')
    op.drop_table('ai_conversations')
