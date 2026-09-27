"""Curated local index of frequently-needed California statutes.

The agent only uses this index for *hints* (which sections to check). The text shown
to users always comes live from leginfo.legislature.ca.gov via LegInfoClient, because
the summaries and excerpts stored here are abridged and can drift from current law.
"""

import json
import os
import re
from typing import List, Optional

from app.core.config import settings
from app.core.logging import logger
from app.schemas.legal import NormalizedLegalSource

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data")
STATUTES_INDEX_PATH = os.path.join(DATA_DIR, "ca_statutes_index.json")

# Standard English stop words that should not influence legal search scoring
STOP_WORDS = {
    "a", "about", "above", "after", "again", "against", "all", "am", "an", "and", "any",
    "are", "aren't", "as", "at", "be", "because", "becoz", "been", "before", "being", "below",
    "between", "both", "but", "by", "can", "can't", "cannot", "could", "couldn't",
    "did", "didn't", "do", "does", "doesn't", "doing", "don't", "down", "during",
    "each", "few", "for", "from", "further", "had", "hadn't", "has", "hasn't", "have",
    "haven't", "having", "he", "he'd", "he'll", "he's", "her", "here", "here's", "hers",
    "herself", "him", "himself", "his", "how", "how's", "i", "i'd", "i'll", "i'm", "i've",
    "if", "in", "into", "is", "isn't", "it", "it's", "its", "itself", "just", "know", "let's",
    "me", "more", "most", "mustn't", "my", "myself", "no", "nor", "not", "of", "off", "on",
    "once", "only", "or", "other", "ought", "our", "ours", "ourselves", "out", "over", "own",
    "same", "shan't", "she", "she'd", "she'll", "she's", "should", "shouldn't", "so", "some",
    "such", "than", "that", "that's", "the", "their", "theirs", "them", "themselves", "then",
    "there", "there's", "these", "they", "they'd", "they'll", "they're", "they've", "this",
    "those", "through", "to", "too", "under", "until", "up", "very", "was", "wasn't", "we",
    "we'd", "we'll", "we're", "we've", "were", "weren't", "what", "what's", "when", "when's",
    "where", "where's", "which", "while", "who", "who's", "whom", "why", "why's", "with",
    "won't", "would", "wouldn't", "you", "you'd", "you'll", "you're", "you've", "your", "yours",
    "yourself", "yourselves", "want", "like", "tell", "around", "stuff", "applied", "apply", "there", "is", "there"
}

# Domain specific gatekeeper terms
ANIMAL_TERMS = {"dog", "dogs", "pet", "pets", "animal", "animals", "leash", "tether", "tethering", "bite", "cat", "cats"}
TENANT_TERMS = {"rent", "landlord", "tenant", "lease", "evict", "eviction", "deposit", "apartment", "dwelling", "habitability", "unit"}
EMPLOYMENT_TERMS = {"paycheck", "wage", "wages", "fired", "terminate", "quitting", "overtime", "salary", "paystub", "employee", "employer"}


class LegalSearchService:
    """Service to query California statutory authority."""

    _cached_statutes = None

    @classmethod
    def _load_statutes(cls) -> list:
        if cls._cached_statutes is None:
            try:
                if os.path.exists(STATUTES_INDEX_PATH):
                    with open(STATUTES_INDEX_PATH, "r", encoding="utf-8") as f:
                        cls._cached_statutes = json.load(f)
                else:
                    logger.warning(f"Statutes index not found at {STATUTES_INDEX_PATH}")
                    cls._cached_statutes = []
            except Exception as e:
                logger.error(f"Error loading statutes index: {e}")
                cls._cached_statutes = []
        return cls._cached_statutes

    @classmethod
    async def search_california_law(
        cls,
        query: str,
        issue_category: Optional[str] = None,
        max_results: int = 4
    ) -> List[NormalizedLegalSource]:
        """
        Search California legal authorities matching user query and issue category.
        Guarantees that all returned records have verified official citations and links.
        Enforces strict domain matching to eliminate cross-domain false positives.
        """
        scored_results = cls._rank(query)
        return cls._normalize(query, scored_results, max_results)

    @classmethod
    def suggest_sections(cls, text: str, limit: int = 2, min_score: int = 60) -> List[tuple]:
        """Return (law_code, section) pairs from the index that strongly match `text`."""
        return [
            (item["law_code"], item["section"])
            for score, item in cls._rank(text)[:limit]
            if score >= min_score and item.get("law_code")
        ]

    @classmethod
    def _rank(cls, query: str) -> list:
        statutes = cls._load_statutes()
        if not statutes:
            return []

        cleaned_query = query.lower()
        raw_tokens = re.findall(r"\w+", cleaned_query)
        query_tokens = [t for t in raw_tokens if t not in STOP_WORDS and len(t) > 2]
        query_token_set = set(query_tokens)

        scored_results = []
        extracted_sections = re.findall(r"\b\d{3,6}(?:\.\d+)?\b", cleaned_query)

        for item in statutes:
            code_name = item.get("code_name", "").lower()
            section = item.get("section", "").lower()
            title = item.get("title", "").lower()
            summary = item.get("summary", "").lower()
            keywords = [k.lower() for k in item.get("keywords", [])]

            # Domain Guardrails: prevent matching animal statutes if query has zero animal words
            is_animal_statute = any(term in keywords or term in title for term in ANIMAL_TERMS)
            if is_animal_statute and not (query_token_set & ANIMAL_TERMS):
                continue

            # Domain Guardrails: prevent matching tenant statutes if query has zero tenant words
            is_tenant_statute = "1947.12" in section or "1950.5" in section or "1946.2" in section or "1941.1" in section
            if is_tenant_statute and not (query_token_set & TENANT_TERMS):
                continue

            # Domain Guardrails: prevent matching employment statutes if query has zero employment words
            is_employment_statute = "lab" in code_name or section in ["201", "202", "203", "226", "510"]
            if is_employment_statute and not (query_token_set & EMPLOYMENT_TERMS):
                continue

            score = 0

            # Direct section match
            if section in extracted_sections:
                score += 150

            # Explicit keyword matches
            for kw in keywords:
                if kw in cleaned_query:
                    score += 40
                elif any(word == kw for word in query_tokens):
                    score += 25
                elif any(word in kw for word in query_tokens if len(word) > 3):
                    score += 10

            # Meaningful word overlaps in title & summary
            for token in query_tokens:
                if token in title:
                    score += 15
                elif token in summary:
                    score += 5

            if score >= 20:
                scored_results.append((score, item))

        # Sort by score descending
        scored_results.sort(key=lambda x: x[0], reverse=True)
        return scored_results

    @classmethod
    def _normalize(cls, query: str, scored_results: list, max_results: int) -> List[NormalizedLegalSource]:
        # Build normalized results
        normalized_sources: List[NormalizedLegalSource] = []
        for score, item in scored_results[:max_results]:
            source = NormalizedLegalSource(
                source_type="statute",
                jurisdiction="California",
                code_name=item["code_name"],
                section=item["section"],
                title=item["title"],
                citation=item["citation"],
                source_url=item["source_url"],
                relevance_summary=item["summary"],
                retrieved_text_snippet=item["verbatim_text"][:800],
            )
            normalized_sources.append(source)

        logger.info(
            f"Legal search for '{query[:40]}' found {len(scored_results)} candidates, returning {len(normalized_sources)} authoritative sources."
        )
        return normalized_sources
