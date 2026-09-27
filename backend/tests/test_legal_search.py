"""Legal search and normalization tests."""

import pytest
from app.services.legal_search_service import LegalSearchService


@pytest.mark.asyncio
async def test_search_rent_increase_statute():
    """Legal search should retrieve Cal. Civ. Code § 1947.12 for rent increase queries."""
    results = await LegalSearchService.search_california_law("rent increase 40% in apartment")
    assert len(results) > 0

    primary = results[0]
    assert primary.jurisdiction == "California"
    assert primary.code_name == "California Civil Code"
    assert primary.section in ["1947.12", "827"]
    assert "leginfo.legislature.ca.gov" in primary.source_url
    assert "Cal. Civ. Code" in primary.citation
    assert len(primary.retrieved_text_snippet) > 50


@pytest.mark.asyncio
async def test_search_security_deposit():
    """Legal search should retrieve Cal. Civ. Code § 1950.5 for security deposits."""
    results = await LegalSearchService.search_california_law("landlord withheld my security deposit after 21 days")
    assert len(results) > 0

    has_1950_5 = any(r.section == "1950.5" for r in results)
    assert has_1950_5
    for r in results:
        assert r.source_url.startswith("https://leginfo.legislature.ca.gov")


@pytest.mark.asyncio
async def test_search_unrelated_query():
    """Non-legal query with no matching keywords returns empty list without error."""
    results = await LegalSearchService.search_california_law("quantum particle entanglement physics experiment")
    assert results == []
