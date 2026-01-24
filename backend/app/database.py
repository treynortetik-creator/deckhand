"""Database configuration and session management."""

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.config import get_settings

settings = get_settings()

# Normalize DATABASE_URL to use asyncpg driver
# Railway may URL-encode the + as %2B, or user may provide postgresql:// without driver
database_url = settings.database_url
if database_url.startswith("postgresql://"):
    database_url = database_url.replace("postgresql://", "postgresql+asyncpg://", 1)
elif database_url.startswith("postgresql%2Basyncpg://"):
    database_url = database_url.replace("postgresql%2Basyncpg://", "postgresql+asyncpg://", 1)

# Configure SSL for Supabase/Railway connections
# Use ssl="require" for asyncpg compatibility with Supabase pooler
connect_args = {}
if "supabase" in database_url or "railway" in database_url:
    connect_args["ssl"] = "require"

engine = create_async_engine(
    database_url,
    echo=settings.debug,
    connect_args=connect_args,
)

async_session = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


class Base(DeclarativeBase):
    """Base class for all SQLAlchemy models."""

    pass


async def get_db():
    """Dependency that yields a database session."""
    async with async_session() as session:
        try:
            yield session
        finally:
            await session.close()
