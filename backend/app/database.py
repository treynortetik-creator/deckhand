"""Database configuration and session management."""

import ssl

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy.pool import NullPool

from app.config import get_settings

settings = get_settings()

# Normalize DATABASE_URL to use asyncpg driver
# Railway may URL-encode the + as %2B, or user may provide postgresql:// without driver
database_url = settings.database_url
if database_url.startswith("postgresql://"):
    database_url = database_url.replace("postgresql://", "postgresql+asyncpg://", 1)
elif database_url.startswith("postgresql%2Basyncpg://"):
    database_url = database_url.replace("postgresql%2Basyncpg://", "postgresql+asyncpg://", 1)

# Configure SSL and connection args for Supabase/Railway connections
connect_args = {}
use_external_pooler = "supabase" in database_url or "railway" in database_url

if use_external_pooler:
    # Create SSL context that doesn't verify certificates (needed for Supabase pooler)
    ssl_ctx = ssl.create_default_context()
    ssl_ctx.check_hostname = False
    ssl_ctx.verify_mode = ssl.CERT_NONE
    connect_args["ssl"] = ssl_ctx
    # Disable prepared statement caching - required for connection poolers
    connect_args["prepared_statement_cache_size"] = 0
    # Also disable statement cache at statement level
    connect_args["statement_cache_size"] = 0

# Use NullPool for external poolers to avoid prepared statement conflicts
# When Supabase/Railway pooler manages connections, SQLAlchemy shouldn't also pool
engine = create_async_engine(
    database_url,
    echo=settings.debug,
    connect_args=connect_args,
    poolclass=NullPool if use_external_pooler else None,
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
