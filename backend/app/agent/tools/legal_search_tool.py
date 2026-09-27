"""Agent tool wrapper for California legal retrieval."""

from typing import List, Optional
from app.services.legal_search_service import LegalSearchService
from app.schemas.legal import NormalizedLegalSource
from app.core.logging import logger


async def execute_legal_search(
    query: str,
    issue_category: Optional[str] = None
) -> List[NormalizedLegalSource]:
    """Execute search across California primary statutory authority."""
    logger.info(f"Agent tool executing California legal search for: '{query}'")
    results = await LegalSearchService.search_california_law(query, issue_category=issue_category)
    return results
