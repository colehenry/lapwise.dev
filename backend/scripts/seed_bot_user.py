"""
Seed the lapwise-bot admin user for automated discussion posts.

Usage:
    cd backend
    PYTHONPATH=$PWD python scripts/seed_bot_user.py
"""

from sqlalchemy import select
from passlib.context import CryptContext

from scripts.ingest.utils import get_db_session
from app.models import User, UserRole

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

BOT_USERNAME = "lapwise-bot"
BOT_EMAIL = "bot@lapwise.dev"


def main():
    db = get_db_session()

    existing = db.execute(
        select(User).where(User.username == BOT_USERNAME)
    ).scalar_one_or_none()

    if existing:
        print(f"Bot user already exists (id={existing.id})")
        db.close()
        return existing.id

    bot = User(
        email=BOT_EMAIL,
        username=BOT_USERNAME,
        hashed_password=pwd_context.hash("bot-no-login-disabled"),
        role=UserRole.admin,
        email_verified=True,
        is_active=True,
        bio="Automated race reports and session summaries.",
    )
    db.add(bot)
    db.commit()
    db.refresh(bot)
    print(f"Created bot user: {BOT_USERNAME} (id={bot.id})")
    db.close()
    return bot.id


if __name__ == "__main__":
    main()
