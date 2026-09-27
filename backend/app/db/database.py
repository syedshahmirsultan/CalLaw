"""Database engine and session configuration using SQLAlchemy AsyncIO."""

from typing import AsyncGenerator
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import declarative_base

from app.core.config import settings
from app.core.logging import logger

def normalize_database_url(url: str) -> tuple[str, dict]:
    """Adapt hosted Postgres URLs (Railway, Heroku, Render: `postgres(ql)://...`) for asyncpg.

    Returns the SQLAlchemy URL and extra connect_args.
    """
    if url.startswith("sqlite"):
        return url, {"check_same_thread": False}
    if url.startswith("postgres://"):
        url = "postgresql+asyncpg://" + url[len("postgres://"):]
    elif url.startswith("postgresql://"):
        url = "postgresql+asyncpg://" + url[len("postgresql://"):]
    connect_args: dict = {}
    # asyncpg does not understand libpq's sslmode parameter; translate it.
    if "sslmode=" in url:
        base, _, query = url.partition("?")
        params = [p for p in query.split("&") if p and not p.startswith("sslmode=")]
        url = base + ("?" + "&".join(params) if params else "")
        connect_args["ssl"] = "require"
    elif "amazonaws.com" in url:
        # AWS-hosted Postgres (e.g. Heroku) requires SSL even when the URL does not say so.
        connect_args["ssl"] = "require"
    return url, connect_args


DATABASE_URL, _connect_args = normalize_database_url(settings.DATABASE_URL)

engine_args = {"echo": False, "future": True, "pool_pre_ping": True}
if _connect_args:
    engine_args["connect_args"] = _connect_args

engine = create_async_engine(DATABASE_URL, **engine_args)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)

Base = declarative_base()


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Dependency that yields an async database session."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


def _add_missing_columns(sync_conn) -> None:
    """Minimal forward-only migration: add new nullable columns to existing tables."""
    from sqlalchemy import inspect

    inspector = inspect(sync_conn)
    for table in Base.metadata.sorted_tables:
        if not inspector.has_table(table.name):
            continue
        existing = {c["name"] for c in inspector.get_columns(table.name)}
        for column in table.columns:
            if column.name not in existing and column.nullable:
                col_type = column.type.compile(dialect=sync_conn.dialect)
                sync_conn.exec_driver_sql(f'ALTER TABLE {table.name} ADD COLUMN {column.name} {col_type}')
                logger.info(f"Added column {table.name}.{column.name}")


async def init_db() -> None:
    """Initialize database tables."""
    try:
        async with engine.begin() as conn:
            # Import models to register tables on Base metadata
            import app.db.models  # noqa: F401
            await conn.run_sync(Base.metadata.create_all)
            await conn.run_sync(_add_missing_columns)
        logger.info("Database tables initialized successfully.")
    except Exception as e:
        logger.error(f"Error initializing database: {e}")
        raise e
