from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import declarative_base

from app.config import settings

# Create the database engine
engine = create_async_engine(
    settings.database_url,
    echo=settings.debug,
    future=True,
    pool_pre_ping=True,
    pool_size=5,
    max_overflow=10,
    pool_timeout=30,
    pool_recycle=300,
)

# Create a session factory (creates new db sessions)
AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)

# Base class for all SQLAlchemy models -> all db tables will inherit from this
Base = declarative_base()


# Dependency for FastAPI routes -> this gives each API request its own database session
async def get_db():
    """
    Dependency that provides a database session to FastAPI routes.

    Usage in a route:
        @app.get("/races")
        async def get_races(db: AsyncSession = Depends(get_db)):
            # Use db here to query the database

    The session is automatically closed after the request finishes.
    """
    async with AsyncSessionLocal() as session:
        # async 'with' is ensures that the sessions closes after the route finishes (without with, we would need to close manually)
        yield session
