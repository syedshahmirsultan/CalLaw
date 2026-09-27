"""Agent workflow states."""

from enum import Enum


class AgentStatus(str, Enum):
    """Workflow states for the California Legal Agent."""

    UNDERSTANDING = "understanding"
    CLARIFYING = "clarifying"
    RESEARCHING = "researching"
    ANALYZING = "analyzing"
    ANSWERING = "answered"
    INSUFFICIENT_EVIDENCE = "insufficient_evidence"
    OUT_OF_SCOPE = "out_of_scope"
    SERVICE_UNAVAILABLE = "service_unavailable"
