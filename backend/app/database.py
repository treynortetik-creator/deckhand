"""Database configuration and session management."""

import ssl

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.config import get_settings

settings = get_settings()

# Configure SSL for Supabase/Railway connections
connect_args = {}
if "supabase" in settings.database_url or "railway" in settings.database_url:
    ssl_context = ssl.create_default_context()
    ssl_context.check_hostname = False
    ssl_context.verify_mode = ssl.CERT_NONE
    connect_args["ssl"] = ssl_context

engine = create_async_engine(
    settings.database_url,
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
