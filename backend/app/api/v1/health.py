"""Health and system diagnostics endpoint."""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text

from app.db.database import get_db
from app.core.config import settings

router = APIRouter()


@router.get("/health", tags=["System"])
async def health_check(db: AsyncSession = Depends(get_db)):
    """Healthcheck verifying database connectivity and configuration."""
    db_status = "healthy"
    try:
        await db.execute(text("SELECT 1"))
    except Exception as e:
        db_status = f"unhealthy: {str(e)}"

    return {
        "status": "online",
        "project": settings.PROJECT_NAME,
        "environment": settings.ENVIRONMENT,
        "database": db_status,
        "jurisdiction": "California Only",
    }
