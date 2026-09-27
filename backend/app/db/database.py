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

# Configure engine arguments
engine_args = {
    "echo": False,
    "future": True,
}

# Add SQLite specific arguments if SQLite is used
if settings.DATABASE_URL.startswith("sqlite"):
    engine_args["connect_args"] = {"check_same_thread": False}

engine = create_async_engine(settings.DATABASE_URL, **engine_args)

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
