"""CalLaw agent coordinator.

One turn runs:
    UNDERSTANDING  -> LLM intake: situation, missing facts, candidate sections
    CLARIFYING     -> (if material facts are missing) ask up to 3 questions and stop
    RESEARCHING    -> fetch every candidate from leginfo.legislature.ca.gov; drop fakes
    ANALYZING      -> LLM explains the situation using only the verified text
    grounding      -> code verifies quotes and citations, repairs or removes failures
    ANSWERING | INSUFFICIENT_EVIDENCE | OUT_OF_SCOPE | SERVICE_UNAVAILABLE
"""

import asyncio
import json
import time
from typing import Any, Awaitable, Callable, Dict, List, Optional, Tuple

import httpx

from app.agent import grounding
from app.agent.prompts import (
    ANSWER_SYSTEM_PROMPT,
    EXPAND_SYSTEM_PROMPT,
    INTAKE_SYSTEM_PROMPT,
    REPAIR_SYSTEM_PROMPT,
)
from app.agent.state import AgentStatus
from app.core.logging import logger
from app.db.models import Message
from app.schemas.legal import ClarifyingQuestion, LegalAnalysis, NormalizedLegalSource
from app.services.leginfo_client import LegInfoClient, StatuteText, normalize_law_code, normalize_section
from app.services.legal_search_service import LegalSearchService
from app.services.llm_service import LLMService, LLMUnavailableError

EventCallback = Callable[[str, str, Optional[str]], Awaitable[None]]

MAX_CANDIDATES = 10
MAX_SOURCES_IN_PROMPT = 7
PER_SOURCE_BUDGET = 3800
MAX_CLARIFICATION_ROUNDS = 2
RESEARCH_SOFT_DEADLINE = 15  # seconds to wait for slow sections once one law is verified
RESEARCH_HARD_DEADLINE = 40  # seconds to wait when nothing is verified yet

HELP_RESOURCES = (
    "- **California Courts Self-Help Guide**: selfhelp.courts.ca.gov\n"
    "- **LawHelpCA** (free and low-cost legal aid): lawhelpca.org\n"
    "- **State Bar of California lawyer referral**: calbar.ca.gov"
)


async def _noop(stage: str, label: str, detail: Optional[str] = None) -> None:
    return None


class LegalAgentCoordinator:
    """Runs the propose -> verify -> ground workflow for one conversation turn."""

    @classmethod
    async def process_turn(
        cls,
        conversation_id: str,
        messages_history: List[Message],
        latest_user_message: str,
        api_key: Optional[str] = None,
        provider: Optional[str] = None,
        on_event: Optional[EventCallback] = None,
    ) -> LegalAnalysis:
        analysis = await cls._run_turn(
            conversation_id, messages_history, latest_user_message, api_key, provider, on_event
        )
        return cls._polish(analysis)

    @staticmethod
    def _polish(analysis: LegalAnalysis) -> LegalAnalysis:
        """House style: no em dashes in anything written for the user.

        Official statute text and verified quotes are left untouched; they must stay verbatim.
        """
        clean = grounding.remove_em_dashes

        def deep(value: Any) -> Any:
            if isinstance(value, str):
                return clean(value)
            if isinstance(value, list):
                return [deep(v) for v in value]
            if isinstance(value, dict):
                return {k: (v if k == "checked_citations" else deep(v)) for k, v in value.items()}
            return value

        analysis.answer = clean(analysis.answer)
        analysis.uncertainties = deep(analysis.uncertainties)
        analysis.clarifying_questions = deep(analysis.clarifying_questions)
        analysis.details = deep(analysis.details)
        for src in analysis.legal_sources:
            if src.relevance_summary:
                src.relevance_summary = clean(src.relevance_summary)
        return analysis

    @classmethod
    async def _run_turn(
        cls,
        conversation_id: str,
        messages_history: List[Message],
        latest_user_message: str,
        api_key: Optional[str],
        provider: Optional[str],
        on_event: Optional[EventCallback],
    ) -> LegalAnalysis:
        emit = on_event or _noop
        logger.info(f"Agent turn for conversation {conversation_id}")

        if not LLMService.is_configured(api_key, provider):
            return cls._service_unavailable(
                "CalLaw's AI engine isn't configured yet, so I can't analyze your situation right now. "
                "The site administrator needs to set `LLM_API_KEY` in `backend/.env` (or you can add your "
                "own key under **AI Settings**)."
            )

        # ---------------------------------------------------------- 1. understand
        await emit("understanding", "Understanding your situation", None)
        transcript = cls._format_transcript(messages_history, latest_user_message)
        rounds = cls._clarification_rounds(messages_history)
        try:
            intake = await LLMService.generate_json(
                INTAKE_SYSTEM_PROMPT,
                f"clarification_rounds_so_far: {rounds}\n\nCONVERSATION:\n{transcript}",
                api_key=api_key, provider=provider, max_tokens=2000,
            )
        except LLMUnavailableError as e:
            logger.error(f"Intake failed: {e}")
            return cls._service_unavailable(
                f"I couldn't reach the AI engine to analyze your situation ({e}). Please try again in a moment."
            )

        scope = (intake.get("scope") or "california_legal").lower()
        summary = (intake.get("situation_summary") or "").strip()
        topics = [t for t in intake.get("legal_topics") or [] if isinstance(t, str)]
        assumptions = [a for a in intake.get("assumptions") or [] if isinstance(a, str)]
        base_details: Dict[str, Any] = {
            "situation_summary": summary,
            "legal_topics": topics,
            "known_facts": [f for f in intake.get("known_facts") or [] if isinstance(f, str)],
            "assumptions": assumptions,
            "emergency": scope == "emergency",
            "scope": scope,
        }

        if scope == "not_legal":
            reply = (intake.get("reply_if_not_legal") or "").strip() or (
                "Hi! I'm CalLaw. Tell me what's going on, for example a problem with a landlord, "
                "an employer, a ticket, a purchase, or a family matter, and I'll explain which "
                "California laws apply and what they say."
            )
            return LegalAnalysis(answer=reply, agent_state=AgentStatus.OUT_OF_SCOPE.value, details=base_details)

        if scope == "outside_california":
            return LegalAnalysis(
                answer=(
                    f"{summary}\n\nCalLaw only covers **California state law**, and this situation appears to be "
                    "governed by the law of another state or country. I don't want to give you California rules "
                    "that may not apply. If part of this happened in California, tell me which part and I'll look "
                    f"into the California law on it.\n\n**Where to get help:**\n{HELP_RESOURCES}"
                ).strip(),
                agent_state=AgentStatus.OUT_OF_SCOPE.value,
                details=base_details,
            )

        # ---------------------------------------------------------- 2. clarify
        questions = cls._parse_questions(intake.get("questions"))
        if intake.get("clarification_needed") and questions and rounds < MAX_CLARIFICATION_ROUNDS and scope != "federal_only":
            await emit("clarifying", "Preparing a few quick questions", None)
            intro = (
                f"{summary}\n\n" if summary else ""
            ) + (
                "I can help you find the California law on this. A few quick questions first, "
                "since your answers change which rules apply to you:"
            )
            details = {**base_details, "questions": [q.model_dump() for q in questions]}
            return LegalAnalysis(
                answer=intro,
                agent_state=AgentStatus.CLARIFYING.value,
                clarifying_questions=[q.question for q in questions],
                uncertainties=[],
                details=details,
            )

        # ---------------------------------------------------------- 3. research & verify
        candidates = cls._parse_candidates(intake.get("candidate_sections"))
        candidates = cls._merge_local_hints(candidates, f"{summary} {latest_user_message}")
        await emit(
            "researching",
            f"Checking {len(candidates)} possible laws on the official California Legislature website",
            ", ".join(cls._label(c) for c in candidates),
        )
        verified, rejected, network_failures = await cls._verify_candidates(candidates, emit)

        if len(verified) < 2:
            tried = [cls._label(c) for c in candidates]
            try:
                more = await LLMService.generate_json(
                    EXPAND_SYSTEM_PROMPT,
                    f"SITUATION: {summary}\nTOPICS: {topics}\nALREADY TRIED: {tried}\n\nCONVERSATION:\n{transcript}",
                    api_key=api_key, provider=provider, max_tokens=800,
                )
                extra = [c for c in cls._parse_candidates(more.get("candidate_sections"))
                         if cls._key(c) not in {cls._key(x) for x in candidates}]
                if extra:
                    await emit("researching", f"Searching {len(extra)} more sections", ", ".join(cls._label(c) for c in extra))
                    v2, r2, n2 = await cls._verify_candidates(extra, emit)
                    verified += v2
                    rejected += r2
                    network_failures += n2
                    candidates += extra
            except LLMUnavailableError as e:
                logger.warning(f"Expansion step skipped: {e}")

        checked = {
            "verified": [s.citation for s in verified],
            "not_found": rejected,
        }
        base_details["checked_citations"] = checked

        if not verified:
            if network_failures and not rejected:
                return cls._service_unavailable(
                    "I couldn't reach the official California Legislative Information website "
                    "(leginfo.legislature.ca.gov) to verify the law, and I won't answer from memory. "
                    "Please try again in a minute."
                )
            return cls._insufficient(summary, topics, checked, base_details)

        await emit(
            "verified",
            f"Verified {len(verified)} official section{'s' if len(verified) != 1 else ''}",
            ", ".join(s.citation for s in verified),
        )

        # ---------------------------------------------------------- 4. analyze & answer
        await emit("writing", "Reading the official text and writing your explanation", None)
        budget = LLMService.source_budget_chars(api_key, provider)
        verified = verified[: MAX_SOURCES_IN_PROMPT if budget >= 20000 else 6]
        sources = {f"S{i}": st for i, st in enumerate(verified, 1)}
        terms = grounding.query_terms([summary, latest_user_message, *base_details["known_facts"], *topics])
        per_source = min(PER_SOURCE_BUDGET, max(900, budget // max(1, len(sources))))
        sources_block = "\n\n".join(
            f"=== {sid}: {st.citation} ({st.code_name}{', ' + grounding.location_title(st) if st.hierarchy else ''}) ===\n"
            f"{grounding.excerpt_for_prompt(st.text, terms, per_source)}"
            for sid, st in sources.items()
        )
        user_prompt = (
            f"CONVERSATION:\n{transcript}\n\n"
            f"SITUATION SUMMARY: {summary}\n"
            f"KNOWN FACTS: {json.dumps(base_details['known_facts'])}\n"
            f"ASSUMPTIONS: {json.dumps(assumptions)}\n\n"
            f"VERIFIED SOURCES (official text from leginfo.legislature.ca.gov):\n\n{sources_block}"
        )
        try:
            ans = await LLMService.generate_json(
                ANSWER_SYSTEM_PROMPT, user_prompt, api_key=api_key, provider=provider, max_tokens=5000
            )
        except LLMUnavailableError as e:
            logger.error(f"Answer generation failed: {e}")
            return cls._service_unavailable(
                "I verified the relevant California laws but couldn't reach the AI engine to explain them. "
                "Please try again in a moment.",
                sources=[cls._to_source(st) for st in verified],
            )

        await emit("checking", "Double-checking every quote against the official text", None)
        return await cls._ground_answer(ans, sources, summary, topics, checked, base_details, api_key, provider)

    # ================================================================== helpers

    @classmethod
    async def _ground_answer(
        cls,
        ans: Dict[str, Any],
        sources: Dict[str, StatuteText],
        summary: str,
        topics: List[str],
        checked: Dict[str, Any],
        details: Dict[str, Any],
        api_key: Optional[str],
        provider: Optional[str],
    ) -> LegalAnalysis:
        norm = grounding.normalize_source_tags
        headline = norm((ans.get("headline") or "").strip())
        markdown = norm((ans.get("answer_markdown") or "").strip())
        verified_sections = {st.section for st in sources.values()}

        # Citations the model wrote itself that we never verified -> repair once, then strip.
        bad = grounding.unverified_section_refs(f"{headline}\n{markdown}", verified_sections)
        # A repair round-trip is only worth it when the provider has token headroom.
        if bad and LLMService.source_budget_chars(api_key, provider) >= 20000:
            logger.warning(f"Answer referenced unverified sections {bad}; repairing.")
            try:
                fixed = await LLMService.generate_json(
                    REPAIR_SYSTEM_PROMPT,
                    f"VERIFIED SOURCES: {json.dumps({k: v.citation for k, v in sources.items()})}\n"
                    f"UNVERIFIED REFERENCES: {bad}\n\nHEADLINE: {headline}\n\nDRAFT:\n{markdown}",
                    api_key=api_key, provider=provider, max_tokens=3000,
                )
                markdown = (fixed.get("answer_markdown") or markdown).strip()
                headline = (fixed.get("headline") or headline).strip()
            except LLMUnavailableError:
                pass
        if bad:
            markdown = grounding.strip_unverified_refs(markdown, verified_sections)
            headline = grounding.strip_unverified_refs(headline, verified_sections)

        def clean_list(key: str) -> List[str]:
            items = [norm(x) for x in ans.get(key) or [] if isinstance(x, str) and x.strip()]
            return [grounding.link_source_tags(grounding.strip_unverified_refs(x, verified_sections), sources) for x in items]

        # Keep only laws the model judged applicable, with quotes verified verbatim.
        used: List[NormalizedLegalSource] = []
        seen = set()
        for law in ans.get("applicable_laws") or []:
            if not isinstance(law, dict):
                continue
            sid = str(law.get("source_id", "")).strip()
            applies = str(law.get("applies", "")).lower()
            if sid not in sources or sid in seen or applies not in ("yes", "maybe"):
                continue
            seen.add(sid)
            st = sources[sid]
            src = cls._to_source(st)
            src.relevance_summary = (law.get("how_it_applies") or "").strip() or None
            src.key_quote = grounding.verify_quote(law.get("key_quote"), st.text)
            src.applicability = applies
            used.append(src)

        # Sources cited inline but omitted from applicable_laws still belong in the list.
        cited = grounding.cited_source_ids(f"{headline}\n{markdown}")
        for sid, st in sources.items():
            if sid in cited and sid not in seen:
                seen.add(sid)
                src = cls._to_source(st)
                src.applicability = "maybe"
                used.append(src)

        status = (ans.get("status") or "answered").lower()
        if status == "insufficient_evidence" or not used:
            explanation = grounding.link_source_tags(markdown, sources) if markdown else ""
            return cls._insufficient(summary, topics, checked, details, explanation)

        markdown = grounding.link_source_tags(markdown, sources)
        headline = grounding.link_source_tags(headline, sources)
        answer = f"**{headline}**\n\n{markdown}" if headline else markdown

        uncertainties = clean_list("uncertainties")
        return LegalAnalysis(
            answer=answer,
            agent_state=AgentStatus.ANSWERING.value,
            legal_sources=used,
            uncertainties=uncertainties,
            details={
                **details,
                "headline": headline,
                "next_steps": clean_list("next_steps"),
                "follow_up_questions": [q for q in ans.get("follow_up_questions") or [] if isinstance(q, str)][:3],
            },
        )

    @classmethod
    async def _verify_candidates(
        cls, candidates: List[Dict[str, Any]], emit: Optional[EventCallback] = None
    ) -> Tuple[List[StatuteText], List[str], int]:
        """Fetch candidates concurrently, reporting each as it resolves.

        leginfo is sometimes slow (20-30s for a single section). Once at least one
        law is verified, stop waiting after RESEARCH_SOFT_DEADLINE; stragglers keep
        running in the background so the cache is warm next time.
        """
        emit = emit or _noop

        async def one(c):
            try:
                return c, await LegInfoClient.fetch_section(c["code"], c["section"], c.get("article")), False
            except (httpx.HTTPError, asyncio.TimeoutError) as e:
                logger.warning(f"leginfo unreachable for {cls._label(c)}: {e}")
                return c, None, True

        tasks = {asyncio.create_task(one(c)): i for i, c in enumerate(candidates)}
        results: List[Optional[Tuple[Dict[str, Any], Optional[StatuteText], bool]]] = [None] * len(candidates)
        pending = set(tasks)
        start = time.monotonic()
        while pending:
            have_one = any(r and r[1] for r in results)
            remaining = (RESEARCH_SOFT_DEADLINE if have_one else RESEARCH_HARD_DEADLINE) - (time.monotonic() - start)
            if remaining <= 0:
                break
            done, pending = await asyncio.wait(pending, timeout=remaining, return_when=asyncio.FIRST_COMPLETED)
            for t in done:
                c, st, failed = t.result()
                results[tasks[t]] = (c, st, failed)
                if st:
                    await emit("verifying", f"Verified {st.citation}", None)
        if pending:
            logger.warning(f"Continuing without {len(pending)} slow leginfo fetches")

        verified, rejected, failures, seen = [], [], len(pending), set()
        for r in results:
            if r is None:
                continue
            c, st, failed = r
            if failed:
                failures += 1
            elif st is None:
                rejected.append(cls._label(c))
            elif st.citation not in seen:
                seen.add(st.citation)
                verified.append(st)
        return verified, rejected, failures

    @staticmethod
    def _key(c: Dict[str, Any]) -> Tuple[str, str, str]:
        return (c["code"], (c.get("article") or "").upper(), c["section"])

    @staticmethod
    def _label(c: Dict[str, Any]) -> str:
        if c["code"] == "CONS":
            return f"Cal. Const. art. {c.get('article') or '?'} § {c['section']}"
        return f"{c['code']} § {c['section']}"

    @classmethod
    def _parse_candidates(cls, raw: Any) -> List[Dict[str, Any]]:
        out, seen = [], set()
        for item in raw or []:
            if not isinstance(item, dict):
                continue
            code = normalize_law_code(str(item.get("code") or ""))
            section = normalize_section(str(item.get("section") or ""))
            if not code or not section:
                continue
            c = {"code": code, "section": section, "article": item.get("article") or None, "why": item.get("why") or ""}
            if cls._key(c) in seen:
                continue
            seen.add(cls._key(c))
            out.append(c)
        return out[:MAX_CANDIDATES]

    @classmethod
    def _merge_local_hints(cls, candidates: List[Dict[str, Any]], text: str) -> List[Dict[str, Any]]:
        """Add up to two sections from the curated local index as extra candidates."""
        keys = {cls._key(c) for c in candidates}
        for hint in LegalSearchService.suggest_sections(text, limit=2):
            c = {"code": hint[0], "section": hint[1], "article": None, "why": "curated index match"}
            if cls._key(c) not in keys and len(candidates) < MAX_CANDIDATES:
                candidates.append(c)
                keys.add(cls._key(c))
        return candidates

    @staticmethod
    def _parse_questions(raw: Any) -> List[ClarifyingQuestion]:
        out = []
        for q in raw or []:
            if isinstance(q, str) and q.strip():
                out.append(ClarifyingQuestion(question=q.strip()))
            elif isinstance(q, dict) and str(q.get("question") or "").strip():
                opts = [str(o).strip() for o in q.get("options") or [] if str(o).strip()][:5]
                out.append(ClarifyingQuestion(question=str(q["question"]).strip(), why=q.get("why"), options=opts))
        return out[:3]

    @staticmethod
    def _clarification_rounds(history: List[Message]) -> int:
        rounds = 0
        for m in reversed(history):
            if m.role != "assistant":
                continue
            if m.agent_state == AgentStatus.CLARIFYING.value:
                rounds += 1
            else:
                break
        return rounds

    @staticmethod
    def _format_transcript(history: List[Message], latest: str) -> str:
        lines = []
        for m in history[-14:]:
            if m.role == "user":
                lines.append(f"USER: {m.content}")
            elif m.role == "assistant":
                details = getattr(m, "details", None) or {}
                if m.agent_state == AgentStatus.CLARIFYING.value and details.get("questions"):
                    qs = "; ".join(q.get("question", "") for q in details["questions"])
                    lines.append(f"ASSISTANT (asked clarifying questions): {qs}")
                else:
                    content = m.content if len(m.content) < 1500 else m.content[:1500] + " …"
                    lines.append(f"ASSISTANT: {content}")
        # The latest message is usually already the last history item; avoid duplicating it.
        if not history or history[-1].role != "user" or history[-1].content.strip() != latest.strip():
            lines.append(f"USER: {latest}")
        return "\n".join(lines)

    @staticmethod
    def _to_source(st: StatuteText) -> NormalizedLegalSource:
        return NormalizedLegalSource(
            source_type="constitution" if st.law_code == "CONS" else "statute",
            jurisdiction="California",
            code_name=st.code_name,
            section=st.section,
            title=grounding.location_title(st),
            citation=st.citation,
            source_url=st.source_url,
            retrieved_text_snippet=st.text[:20000],
            statute_history=st.history or None,
        )

    @staticmethod
    def _insufficient(
        summary: str, topics: List[str], checked: Dict[str, Any], details: Dict[str, Any], explanation: str = ""
    ) -> LegalAnalysis:
        if details.get("scope") == "federal_only":
            # e.g. visas, immigration status, federal taxes: say plainly that this is federal law.
            answer = (
                "**This is governed by federal law, not California law.**\n\n"
                + (f"{summary.rstrip('.')}.\n\n" if summary else "")
                + "Matters like visas, immigration status, federal taxes, and bankruptcy are set by the U.S. "
                "government, so no California statute decides them. CalLaw only covers California state law, "
                "and I won't guess at federal rules.\n\n"
                "**Where to get reliable help:**\n"
                "- **U.S. Citizenship and Immigration Services (USCIS)**: uscis.gov (official forms, case status, and rules)\n"
                "- **Free and low-cost immigration legal help**: immigrationadvocates.org/legaldirectory\n"
                "- **LawHelpCA** (legal aid in California): lawhelpca.org\n\n"
                "Be careful with \"notarios\" or consultants who promise immigration results; only licensed "
                "attorneys and accredited representatives can give immigration legal advice.\n\n"
                "If part of your situation involves California law (for example your job, housing, or a "
                "consultant who took your money), tell me about that part and I'll look up the California rules."
            )
            return LegalAnalysis(
                answer=answer,
                agent_state=AgentStatus.OUT_OF_SCOPE.value,
                legal_sources=[],
                uncertainties=[],
                details={**details, "checked_citations": checked},
            )

        body = explanation.strip() or (
            "I searched the official California codes for a statute that directly addresses your situation, "
            "but I couldn't find one I can verify. Rather than guess, I'd rather tell you that honestly."
        )
        answer = (
            "**I couldn't find a California statute that clearly covers this.**\n\n"
            f"{body}\n\n"
            "This doesn't necessarily mean there's no rule. It may be governed by a **city or county ordinance**, "
            "**federal law**, **court decisions**, or the **terms of a contract**, which CalLaw can't verify.\n\n"
            f"**Where to get reliable help:**\n{HELP_RESOURCES}\n\n"
            "If you can share more details (what happened, where, and when), I'll search again."
        )
        return LegalAnalysis(
            answer=answer,
            agent_state=AgentStatus.INSUFFICIENT_EVIDENCE.value,
            legal_sources=[],
            uncertainties=["No verified California statute matched the facts described."],
            details={**details, "checked_citations": checked},
        )

    @staticmethod
    def _service_unavailable(message: str, sources: Optional[List[NormalizedLegalSource]] = None) -> LegalAnalysis:
        return LegalAnalysis(
            answer=message,
            agent_state=AgentStatus.SERVICE_UNAVAILABLE.value,
            legal_sources=sources or [],
            uncertainties=[],
        )
