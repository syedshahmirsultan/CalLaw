"""End-to-end agent workflow tests.

The LLM and leginfo.legislature.ca.gov are replaced with deterministic fakes so the
tests exercise CalLaw's own logic: clarification, citation verification, quote
verification, citation repair, and honest failure modes.
"""

import json
from typing import Any, Dict, List, Optional

import pytest
from httpx import AsyncClient

from app.agent import prompts
from app.services.leginfo_client import LegInfoClient, StatuteText
from app.services.llm_service import LLMService, LLMUnavailableError

CIV_827 = StatuteText(
    law_code="CIV", section="827", code_name="Civil Code", citation="Cal. Civ. Code § 827",
    source_url="https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=CIV&sectionNum=827",
    text=(
        "(a) (1) Except as provided in subdivision (b), in all leases of lands or tenements from month to month, "
        "the landlord may, upon giving notice in writing to the tenant, change the terms of the lease to take effect "
        "at the expiration of not less than 30 days.\n"
        "(b) (1) If the proposed rent increase for that tenant is greater than 10 percent of the rental amount charged "
        "to that tenant at any time during the 12 months prior to the effective date of the increase, the notice "
        "shall be delivered at least 90 days before the effective date of the increase."
    ),
    hierarchy=["DIVISION 2. PROPERTY [654 - 1422]", "ARTICLE 1. Incidents of Ownership [818 - 827]"],
    history="Amended by Stats. 2024, Ch. 1015, Sec. 1. (SB 1103) Effective January 1, 2025.",
)
CIV_1947_12 = StatuteText(
    law_code="CIV", section="1947.12", code_name="Civil Code", citation="Cal. Civ. Code § 1947.12",
    source_url="https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=CIV&sectionNum=1947.12",
    text=(
        "(a) (1) Subject to subdivision (b), an owner of residential real property shall not, over the course of any "
        "12-month period, increase the gross rental rate for a dwelling or a unit more than 5 percent plus the "
        "percentage change in the cost of living, or 10 percent, whichever is lower."
    ),
    hierarchy=["CHAPTER 2. Hiring of Real Property [1940 - 1954.071]"],
)
OFFICIAL = {("CIV", "827"): CIV_827, ("CIV", "1947.12"): CIV_1947_12}


class FakeLLM:
    """Scripted LLM keyed on which system prompt is being used."""

    def __init__(self, intake: List[Dict[str, Any]], answer: Optional[Dict[str, Any]] = None,
                 expand: Optional[Dict[str, Any]] = None, repair: Optional[Dict[str, Any]] = None):
        self.intake = list(intake)
        self.answer = answer
        self.expand = expand or {"candidate_sections": []}
        self.repair = repair
        self.calls: List[str] = []

    async def __call__(self, system_instruction: str, user_prompt: str, **kwargs) -> Dict[str, Any]:
        if system_instruction == prompts.INTAKE_SYSTEM_PROMPT:
            self.calls.append("intake")
            return self.intake.pop(0) if len(self.intake) > 1 else self.intake[0]
        if system_instruction == prompts.ANSWER_SYSTEM_PROMPT:
            self.calls.append("answer")
            assert "VERIFIED SOURCES" in user_prompt
            return self.answer
        if system_instruction == prompts.EXPAND_SYSTEM_PROMPT:
            self.calls.append("expand")
            return self.expand
        if system_instruction == prompts.REPAIR_SYSTEM_PROMPT:
            self.calls.append("repair")
            if self.repair is None:
                raise LLMUnavailableError("no repair scripted")
            return self.repair
        raise AssertionError("unexpected prompt")


@pytest.fixture
def fake_leginfo(monkeypatch):
    fetched = []

    async def fetch(code, section, article=None):
        fetched.append((code, section))
        return OFFICIAL.get((code, section))

    monkeypatch.setattr(LegInfoClient, "fetch_section", fetch)
    return fetched


def use_llm(monkeypatch, fake: FakeLLM, budget: int = 26000) -> FakeLLM:
    monkeypatch.setattr(LLMService, "generate_json", fake)
    monkeypatch.setattr(LLMService, "is_configured", lambda *a, **k: True)
    monkeypatch.setattr(LLMService, "source_budget_chars", lambda *a, **k: budget)
    return fake


VAGUE_INTAKE = {
    "scope": "california_legal",
    "situation_summary": "Your landlord is raising your rent.",
    "legal_topics": ["Landlord-tenant: rent increases"],
    "known_facts": ["You rent your home"],
    "clarification_needed": True,
    "questions": [
        {"question": "Are you on a month-to-month agreement or a fixed-term lease?", "why": "Notice rules differ.",
         "options": ["Month-to-month", "Fixed-term lease", "Not sure"]},
        {"question": "By how much is the rent going up?", "why": "Bigger increases need more notice.",
         "options": ["10% or less", "More than 10%"]},
    ],
    "assumptions": [],
    "candidate_sections": [{"code": "CIV", "section": "827", "why": "notice"}],
}

READY_INTAKE = {
    "scope": "california_legal",
    "situation_summary": "You rent an apartment month-to-month and your landlord raised the rent 40% with no written notice.",
    "legal_topics": ["Landlord-tenant: rent increases"],
    "known_facts": ["Month-to-month apartment", "40% increase", "No written notice"],
    "clarification_needed": False,
    "questions": [],
    "assumptions": ["The apartment is not exempt from statewide rent caps"],
    "candidate_sections": [
        {"code": "Civil Code", "section": "§ 827", "why": "notice"},
        {"code": "CIV", "section": "1947.12", "why": "rent cap"},
        {"code": "CIV", "section": "99999.9", "why": "hallucinated"},
    ],
}

GOOD_ANSWER = {
    "status": "answered",
    "headline": "Your landlord generally needs to give written notice before raising rent [S1].",
    "answer_markdown": (
        "### What the law says about your situation\n"
        "Because the increase is over 10%, the notice must come at least 90 days ahead [S1]. "
        "Statewide caps also limit increases to 5% plus inflation, max 10% [S2]. "
        "Also see Section 1942.5 about retaliation.\n"
        "### What this means for you\nAsk for the notice in writing [S1, S2]."
    ),
    "applicable_laws": [
        {"source_id": "S1", "applies": "yes", "how_it_applies": "Requires 90 days' notice for >10% increases.",
         "key_quote": "the notice shall be delivered at least 90 days before the effective date of the increase"},
        {"source_id": "S2", "applies": "yes", "how_it_applies": "Caps the increase.",
         # Slight paraphrase: must be replaced by the real official sentence
         "key_quote": "an owner of residential real property shall not, over any 12-month period, increase the gross "
                      "rental rate for a dwelling or a unit more than 5 percent plus the percentage change in the cost of living, or 10 percent, whichever is lower."},
    ],
    "next_steps": ["Ask for the increase in writing [S1]"],
    "uncertainties": ["Local rent control may give more protection."],
    "follow_up_questions": ["What if my landlord retaliates?"],
}


async def new_conversation(client: AsyncClient, headers) -> str:
    resp = await client.post("/api/v1/conversations", headers=headers, json={"title": "New Legal Inquiry"})
    return resp.json()["id"]


@pytest.mark.asyncio
async def test_vague_question_asks_structured_clarifying_questions(client, auth_headers_user_a, monkeypatch, fake_leginfo):
    use_llm(monkeypatch, FakeLLM([VAGUE_INTAKE]))
    conv_id = await new_conversation(client, auth_headers_user_a)

    resp = await client.post(f"/api/v1/conversations/{conv_id}/messages", headers=auth_headers_user_a,
                             json={"content": "My landlord raised my rent"})
    assert resp.status_code == 201
    data = resp.json()
    assert data["agent_state"] == "clarifying"
    assert len(data["clarifying_questions"]) == 2
    questions = data["details"]["questions"]
    assert questions[0]["options"] == ["Month-to-month", "Fixed-term lease", "Not sure"]
    assert data["legal_sources"] == []
    assert fake_leginfo == []  # no research before the facts are in

    # Questions survive a page reload
    conv = (await client.get(f"/api/v1/conversations/{conv_id}", headers=auth_headers_user_a)).json()
    assert conv["messages"][-1]["details"]["questions"][1]["question"].startswith("By how much")
    assert conv["title"] == "My landlord raised my rent"


@pytest.mark.asyncio
async def test_answer_is_grounded_in_verified_official_text(client, auth_headers_user_a, monkeypatch, fake_leginfo):
    fake = use_llm(monkeypatch, FakeLLM([READY_INTAKE], answer=GOOD_ANSWER))
    conv_id = await new_conversation(client, auth_headers_user_a)

    resp = await client.post(f"/api/v1/conversations/{conv_id}/messages", headers=auth_headers_user_a,
                             json={"content": "Month-to-month apartment, landlord raised rent 40% with no notice"})
    data = resp.json()
    assert data["agent_state"] == "answered"

    # Hallucinated citation was checked and rejected; never shown as a source
    assert ("CIV", "99999.9") in fake_leginfo
    citations = [s["citation"] for s in data["legal_sources"]]
    assert citations == ["Cal. Civ. Code § 827", "Cal. Civ. Code § 1947.12"]
    assert "CIV § 99999.9" in data["details"]["checked_citations"]["not_found"]
    for s in data["legal_sources"]:
        assert s["source_url"].startswith("https://leginfo.legislature.ca.gov/")

    # Quotes are verbatim from the official text; the paraphrase was replaced with the real sentence
    s1, s2 = data["legal_sources"]
    assert s1["key_quote"] in CIV_827.text
    assert s2["key_quote"] is not None and s2["key_quote"] in CIV_1947_12.text

    content = data["assistant_message"]["content"]
    # [S#] tags become linked official citations
    assert "[Civ. Code § 827](https://leginfo.legislature.ca.gov/" in content
    assert "[S1" not in content
    # The unverified "Section 1942.5" was repaired away (repair not scripted -> stripped)
    assert "1942.5" not in content
    assert "repair" in fake.calls

    assert data["details"]["follow_up_questions"] == ["What if my landlord retaliates?"]
    assert data["uncertainties"] == ["Local rent control may give more protection."]


@pytest.mark.asyncio
async def test_no_verified_law_returns_insufficient_evidence(client, auth_headers_user_a, monkeypatch, fake_leginfo):
    intake = {**READY_INTAKE, "situation_summary": "You want to import an extraterrestrial mineral.",
              "candidate_sections": [{"code": "PRC", "section": "99999", "why": "made up"}]}
    fake = use_llm(monkeypatch, FakeLLM([intake], expand={"candidate_sections": [{"code": "PRC", "section": "88888"}]}))
    conv_id = await new_conversation(client, auth_headers_user_a)

    resp = await client.post(f"/api/v1/conversations/{conv_id}/messages", headers=auth_headers_user_a,
                             json={"content": "Can I import a Martian mineral into Sacramento under mining code 99999?"})
    data = resp.json()
    assert data["agent_state"] == "insufficient_evidence"
    assert data["legal_sources"] == []
    assert "couldn't find a california statute" in data["assistant_message"]["content"].lower()
    assert "answer" not in fake.calls  # never asks the model to answer without verified law
    assert "expand" in fake.calls      # but does try a second search first


@pytest.mark.asyncio
async def test_model_rejecting_all_sources_is_insufficient(client, auth_headers_user_a, monkeypatch, fake_leginfo):
    answer = {**GOOD_ANSWER, "applicable_laws": [{"source_id": "S1", "applies": "no"}, {"source_id": "S2", "applies": "no"}],
              "answer_markdown": "None of these statutes address pet ownership.", "headline": ""}
    use_llm(monkeypatch, FakeLLM([READY_INTAKE], answer=answer))
    conv_id = await new_conversation(client, auth_headers_user_a)
    data = (await client.post(f"/api/v1/conversations/{conv_id}/messages", headers=auth_headers_user_a,
                              json={"content": "question"})).json()
    assert data["agent_state"] == "insufficient_evidence"
    assert data["legal_sources"] == []


@pytest.mark.asyncio
async def test_clarification_is_capped_at_two_rounds(client, auth_headers_user_a, monkeypatch, fake_leginfo):
    fake = use_llm(monkeypatch, FakeLLM([VAGUE_INTAKE], answer=GOOD_ANSWER))
    conv_id = await new_conversation(client, auth_headers_user_a)
    url = f"/api/v1/conversations/{conv_id}/messages"

    states = []
    for text in ["My landlord raised my rent", "not sure", "still not sure"]:
        states.append((await client.post(url, headers=auth_headers_user_a, json={"content": text})).json()["agent_state"])
    assert states == ["clarifying", "clarifying", "answered"]


@pytest.mark.asyncio
async def test_greeting_is_handled_without_research(client, auth_headers_user_a, monkeypatch, fake_leginfo):
    use_llm(monkeypatch, FakeLLM([{"scope": "not_legal", "reply_if_not_legal": "Hi! Tell me what happened."}]))
    conv_id = await new_conversation(client, auth_headers_user_a)
    data = (await client.post(f"/api/v1/conversations/{conv_id}/messages", headers=auth_headers_user_a,
                              json={"content": "hello"})).json()
    assert data["agent_state"] == "out_of_scope"
    assert data["assistant_message"]["content"] == "Hi! Tell me what happened."
    assert fake_leginfo == []


@pytest.mark.asyncio
async def test_missing_llm_is_reported_honestly(client, auth_headers_user_a, monkeypatch, fake_leginfo):
    monkeypatch.setattr(LLMService, "is_configured", lambda *a, **k: False)
    conv_id = await new_conversation(client, auth_headers_user_a)
    data = (await client.post(f"/api/v1/conversations/{conv_id}/messages", headers=auth_headers_user_a,
                              json={"content": "My landlord raised my rent"})).json()
    assert data["agent_state"] == "service_unavailable"
    assert data["legal_sources"] == []
    assert "LLM_API_KEY" in data["assistant_message"]["content"]


@pytest.mark.asyncio
async def test_streaming_endpoint_emits_progress_then_final(client, auth_headers_user_a, monkeypatch, fake_leginfo):
    use_llm(monkeypatch, FakeLLM([READY_INTAKE], answer=GOOD_ANSWER))
    conv_id = await new_conversation(client, auth_headers_user_a)

    events = []
    async with client.stream("POST", f"/api/v1/conversations/{conv_id}/messages/stream",
                             headers=auth_headers_user_a, json={"content": "rent went up 40%"}) as resp:
        assert resp.status_code == 200
        async for line in resp.aiter_lines():
            if line.startswith("data: "):
                events.append(json.loads(line[6:]))

    stages = [e.get("stage") for e in events if e["type"] == "progress"]
    assert stages[:2] == ["received", "understanding"]
    assert "researching" in stages and "verified" in stages and "writing" in stages
    final = events[-1]
    assert final["type"] == "final"
    assert final["data"]["agent_state"] == "answered"

    # Persisted with verified sources and details
    conv = (await client.get(f"/api/v1/conversations/{conv_id}", headers=auth_headers_user_a)).json()
    saved = conv["messages"][-1]
    assert saved["legal_sources"][0]["key_quote"] in CIV_827.text
    assert saved["details"]["headline"]


@pytest.mark.asyncio
async def test_rate_limited_provider_strips_unverified_refs_without_extra_call(client, auth_headers_user_a, monkeypatch, fake_leginfo):
    answer = {**GOOD_ANSWER, "next_steps": ["Serve notice per Section 1162 of the CCP 【S1】"]}
    fake = use_llm(monkeypatch, FakeLLM([READY_INTAKE], answer=answer), budget=14000)
    conv_id = await new_conversation(client, auth_headers_user_a)
    data = (await client.post(f"/api/v1/conversations/{conv_id}/messages", headers=auth_headers_user_a,
                              json={"content": "rent up 40%"})).json()
    assert "repair" not in fake.calls
    content = data["assistant_message"]["content"]
    assert "1942.5" not in content
    step = data["details"]["next_steps"][0]
    assert "1162" not in step and "[Civ. Code § 827](" in step


@pytest.mark.asyncio
async def test_slow_official_site_does_not_block_the_answer(client, auth_headers_user_a, monkeypatch):
    import asyncio
    import time
    from app.agent import coordinator

    async def fetch(code, section, article=None):
        if section == "1947.12":
            await asyncio.sleep(30)  # leginfo sometimes takes this long
        return OFFICIAL.get((code, section))

    monkeypatch.setattr(LegInfoClient, "fetch_section", fetch)
    monkeypatch.setattr(coordinator, "RESEARCH_SOFT_DEADLINE", 0.3)
    use_llm(monkeypatch, FakeLLM([READY_INTAKE], answer=GOOD_ANSWER))
    conv_id = await new_conversation(client, auth_headers_user_a)

    start = time.monotonic()
    data = (await client.post(f"/api/v1/conversations/{conv_id}/messages", headers=auth_headers_user_a,
                              json={"content": "rent up 40%"})).json()
    assert time.monotonic() - start < 5
    assert data["agent_state"] == "answered"
    assert [s["citation"] for s in data["legal_sources"]] == ["Cal. Civ. Code § 827"]


@pytest.mark.asyncio
async def test_answers_never_contain_em_dashes_but_quotes_stay_verbatim(client, auth_headers_user_a, monkeypatch, fake_leginfo):
    em = "—"
    answer = {**GOOD_ANSWER,
              "headline": f"Your landlord needs written notice {em} usually 90 days [S1].",
              "next_steps": [f"Ask in writing {em} keep a copy [S1]"],
              "uncertainties": [f"Local rules {em} may differ"]}
    use_llm(monkeypatch, FakeLLM([READY_INTAKE], answer=answer))
    conv_id = await new_conversation(client, auth_headers_user_a)
    data = (await client.post(f"/api/v1/conversations/{conv_id}/messages", headers=auth_headers_user_a,
                              json={"content": "rent up 40%"})).json()
    blob = json.dumps({k: data[k] for k in ("details", "uncertainties")}) + data["assistant_message"]["content"]
    assert em not in blob and "\u2014" not in blob
    assert data["legal_sources"][0]["key_quote"] in CIV_827.text


@pytest.mark.asyncio
async def test_federal_only_question_says_federal_law_governs(client, auth_headers_user_a, monkeypatch, fake_leginfo):
    intake = {**READY_INTAKE, "scope": "federal_only", "situation_summary": "Your visa has expired.",
              "candidate_sections": [{"code": "GOV", "section": "99999"}]}
    use_llm(monkeypatch, FakeLLM([intake]))
    conv_id = await new_conversation(client, auth_headers_user_a)
    data = (await client.post(f"/api/v1/conversations/{conv_id}/messages", headers=auth_headers_user_a,
                              json={"content": "My visa is expired, what now?"})).json()
    assert data["agent_state"] == "out_of_scope"
    content = data["assistant_message"]["content"]
    assert "federal law" in content and "uscis.gov" in content
    assert data["legal_sources"] == []
