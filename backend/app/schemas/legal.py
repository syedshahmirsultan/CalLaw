"""Legal source and analysis schemas."""

from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, ConfigDict, Field


class NormalizedLegalSource(BaseModel):
    """A California statute verified against leginfo.legislature.ca.gov."""

    id: Optional[str] = None
    source_type: str = "statute"  # statute | constitution
    jurisdiction: str = "California"
    code_name: str = Field(..., description="e.g. Civil Code")
    section: str = Field(..., description="e.g. 1950.5")
    title: str = Field(..., description="Where the section sits in the code, e.g. 'CHAPTER 2. Hiring of Real Property'")
    citation: str = Field(..., description="e.g. Cal. Civ. Code § 1950.5")
    source_url: str = Field(..., description="Official leginfo.legislature.ca.gov URL")
    relevance_summary: Optional[str] = Field(None, description="Plain-English explanation of how this law applies to the user")
    retrieved_text_snippet: Optional[str] = Field(None, description="Official section text as fetched from leginfo")
    key_quote: Optional[str] = Field(None, description="Passage verified to appear verbatim in the official text")
    applicability: Optional[str] = Field(None, description="yes | maybe")
    statute_history: Optional[str] = Field(None, description="Enactment/amendment note from leginfo")
    created_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class ClarifyingQuestion(BaseModel):
    question: str
    why: Optional[str] = None
    options: List[str] = Field(default_factory=list)


class LegalAnalysis(BaseModel):
    """Structured result of one agent turn."""

    answer: str
    # clarifying | answered | insufficient_evidence | out_of_scope | service_unavailable
    agent_state: str = "answered"
    legal_sources: List[NormalizedLegalSource] = Field(default_factory=list)
    uncertainties: List[str] = Field(default_factory=list)
    clarifying_questions: List[str] = Field(default_factory=list)
    details: Dict[str, Any] = Field(
        default_factory=dict,
        description="UI payload: headline, questions, next_steps, follow_up_questions, assumptions, situation_summary, checked_citations",
    )
