"""replace discussion posts with per-race comment threads

Revision ID: a4c1f0b8d2e7
Revises: c17f9a4be230
Create Date: 2026-08-02

Discussions are removed. Comments now hang off a race_threads row keyed on
(year, round) instead of a post. Posts, tags and post votes are dropped along
with all of their data, and the lapwise-bot user that only existed to author
automated posts.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "a4c1f0b8d2e7"
down_revision: Union[str, None] = "c17f9a4be230"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

BOT_USERNAME = "lapwise-bot"


def upgrade() -> None:
    op.create_table(
        "race_threads",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("year", sa.Integer(), nullable=False),
        sa.Column("round", sa.Integer(), nullable=False),
        sa.Column(
            "is_locked", sa.Boolean(), nullable=False, server_default=sa.text("false")
        ),
        sa.Column(
            "comment_count", sa.Integer(), nullable=False, server_default=sa.text("0")
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=True,
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("year", "round", name="uq_race_thread_round"),
    )
    op.create_index("ix_race_threads_id", "race_threads", ["id"])

    # Every existing comment belongs to a post that is about to stop existing.
    op.execute("DELETE FROM votes")
    op.execute("DELETE FROM comments")

    op.drop_column("comments", "post_id")
    op.add_column("comments", sa.Column("thread_id", sa.Integer(), nullable=False))
    op.create_foreign_key(
        "fk_comments_thread_id",
        "comments",
        "race_threads",
        ["thread_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.create_index("ix_comments_thread_id", "comments", ["thread_id"])

    op.execute("ALTER TABLE votes DROP CONSTRAINT IF EXISTS ck_vote_target")
    op.execute("ALTER TABLE votes DROP CONSTRAINT IF EXISTS uq_vote_user_post")
    op.drop_column("votes", "post_id")
    op.alter_column("votes", "comment_id", nullable=False)

    op.drop_column("session_summaries", "post_id")

    op.drop_table("post_tags")
    op.drop_table("posts")
    op.drop_table("tags")
    op.execute("DROP TYPE IF EXISTS posttype")

    # The bot only ever authored automated posts.
    op.execute(
        f"""
        DELETE FROM login_history WHERE user_id IN (
            SELECT id FROM users WHERE username = '{BOT_USERNAME}'
        )
        """
    )
    for table in (
        "refresh_tokens",
        "email_verification_tokens",
        "password_reset_tokens",
    ):
        op.execute(
            f"""
            DELETE FROM {table} WHERE user_id IN (
                SELECT id FROM users WHERE username = '{BOT_USERNAME}'
            )
            """
        )
    op.execute(f"DELETE FROM users WHERE username = '{BOT_USERNAME}'")


def downgrade() -> None:
    op.create_table(
        "tags",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=50), nullable=False),
        sa.Column("slug", sa.String(length=50), nullable=False),
        sa.Column("color", sa.String(length=7), nullable=True),
        sa.Column("category", sa.String(length=20), nullable=True),
        sa.Column("created_by", sa.Integer(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=True,
        ),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name"),
        sa.UniqueConstraint("slug"),
    )
    op.create_table(
        "posts",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("author_id", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(length=300), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column(
            "post_type",
            sa.Enum(
                "discussion",
                "analysis",
                "news",
                "weekly_recap",
                name="posttype",
            ),
            nullable=False,
        ),
        sa.Column(
            "is_pinned", sa.Boolean(), nullable=False, server_default=sa.text("false")
        ),
        sa.Column(
            "is_locked", sa.Boolean(), nullable=False, server_default=sa.text("false")
        ),
        sa.Column(
            "vote_count", sa.Integer(), nullable=False, server_default=sa.text("0")
        ),
        sa.Column(
            "comment_count", sa.Integer(), nullable=False, server_default=sa.text("0")
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=True,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=True,
        ),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["author_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_posts_id", "posts", ["id"])
    op.create_index("ix_posts_author_id", "posts", ["author_id"])
    op.create_index("ix_posts_created_at", "posts", ["created_at"])
    op.create_table(
        "post_tags",
        sa.Column("post_id", sa.Integer(), nullable=False),
        sa.Column("tag_id", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["post_id"], ["posts.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["tag_id"], ["tags.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("post_id", "tag_id"),
    )

    op.add_column(
        "session_summaries", sa.Column("post_id", sa.Integer(), nullable=True)
    )
    op.create_foreign_key(
        "fk_session_summaries_post_id",
        "session_summaries",
        "posts",
        ["post_id"],
        ["id"],
        ondelete="SET NULL",
    )

    op.execute("DELETE FROM votes")
    op.execute("DELETE FROM comments")

    op.alter_column("votes", "comment_id", nullable=True)
    op.add_column("votes", sa.Column("post_id", sa.Integer(), nullable=True))
    op.create_foreign_key(
        "fk_votes_post_id", "votes", "posts", ["post_id"], ["id"], ondelete="CASCADE"
    )
    op.create_unique_constraint("uq_vote_user_post", "votes", ["user_id", "post_id"])
    op.create_check_constraint(
        "ck_vote_target",
        "votes",
        "(post_id IS NOT NULL AND comment_id IS NULL) OR "
        "(post_id IS NULL AND comment_id IS NOT NULL)",
    )

    op.drop_index("ix_comments_thread_id", table_name="comments")
    op.drop_constraint("fk_comments_thread_id", "comments", type_="foreignkey")
    op.drop_column("comments", "thread_id")
    op.add_column("comments", sa.Column("post_id", sa.Integer(), nullable=False))
    op.create_foreign_key(
        "fk_comments_post_id",
        "comments",
        "posts",
        ["post_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.create_index("ix_comments_post_id", "comments", ["post_id"])

    op.drop_index("ix_race_threads_id", table_name="race_threads")
    op.drop_table("race_threads")
