"""Deterministic anti-hallucination checks applied to every LLM answer.

Nothing here trusts the model: quotes are matched against the official text,
citations are matched against the set of verified sections, and anything that
fails is repaired or removed before the user sees it.
"""

import math
import re
from difflib import SequenceMatcher
from typing import Dict, Iterable, List, Optional, Set

from app.services.leginfo_client import LAW_CODES, StatuteText

_QUOTE_CHARS = str.maketrans({"“": '"', "”": '"', "‘": "'", "’": "'", "—": "-", "–": "-"})
_STOP = {
    "the", "and", "for", "that", "with", "this", "from", "have", "has", "was", "were", "are", "you",
    "your", "they", "their", "them", "not", "but", "any", "all", "can", "will", "shall", "may", "which",
    "what", "when", "who", "been", "into", "other", "such", "than", "then", "there", "these", "those",
    "under", "about", "after", "before", "does", "did", "had", "his", "her", "its", "our", "out", "per",
    "section", "subdivision", "paragraph", "california", "law", "code",
}


def _norm(s: str) -> str:
    return re.sub(r"\s+", " ", (s or "").translate(_QUOTE_CHARS)).strip().lower()


def verify_quote(quote: Optional[str], text: str) -> Optional[str]:
    """Return a passage guaranteed to appear in `text`, or None.

    Exact matches (ignoring whitespace and curly quotes) are kept as written.
    Near-misses (the model paraphrased slightly) are replaced by the closest
    real passage from the official text, never by the model's wording.
    """
    q = (quote or "").strip().strip('"').strip()
    if len(q) < 12:
        return None
    if _norm(q) in _norm(text):
        return q

    # Compare against official passages (subdivisions / sentences).
    passages: List[str] = []
    for line in text.split("\n"):
        line = line.strip()
        if not line:
            continue
        passages.append(line)
        passages.extend(p.strip() for p in re.split(r"(?<=[.;:])\s+", line) if len(p.strip()) > 20)
    best, best_ratio = None, 0.0
    nq = _norm(q)
    for p in passages:
        ratio = SequenceMatcher(None, nq, _norm(p)).ratio()
        if ratio > best_ratio:
            best, best_ratio = p, ratio
    if best and best_ratio >= 0.8:
        return best if len(best) <= 700 else best[:700].rsplit(" ", 1)[0] + " …"
    return None


def short_citation(st: StatuteText) -> str:
    """Readable inline citation, e.g. 'Civ. Code § 827' or 'Cal. Const., art. I, § 1'."""
    if st.law_code == "CONS":
        return st.citation
    return f"{LAW_CODES[st.law_code][1]} § {st.section}"


_TAG_GROUP = re.compile(r"\[\s*(S\d+(?:\s*[,;]\s*S\d+)*)\s*\]")


def remove_em_dashes(text: str) -> str:
    """Replace em dashes (and spaced en dashes used as dashes) with commas.

    Number ranges like "10\u201320%" keep their en dash. Used only on text written
    for the user, never on statute text or verified quotes.
    """
    if not text or ("\u2014" not in text and " \u2013 " not in text):
        return text
    t = re.sub(r"\*\*[ \t]*\u2014[ \t]*", "**: ", text)  # "**Label** - text" -> "**Label**: text"
    t = re.sub(r"[ \t]*\u2014[ \t]*", ", ", t)
    t = re.sub(r"[ \t]+\u2013[ \t]+", ", ", t)
    t = re.sub(r",\s*([.,;:!?)])", r"\1", t)  # ", ." -> "."
    t = re.sub(r"(^|\n)(\s*(?:[-*]\s+)?), ", r"\1\2", t)  # a dash that started a line
    return t


def normalize_source_tags(text: str) -> str:
    """Some models write 【S1】 or (S1) instead of [S1]; normalize so tags get linked."""
    t = re.sub(r"[【〖]\s*(S\d+(?:\s*[,;]\s*S\d+)*)\s*[】〗]", r"[\1]", text or "")
    t = re.sub(r"\(\s*(S\d+(?:\s*[,;]\s*S\d+)*)\s*\)", r"[\1]", t)
    return t


def cited_source_ids(markdown: str) -> Set[str]:
    ids: Set[str] = set()
    for m in _TAG_GROUP.finditer(markdown or ""):
        ids.update(i.strip() for i in re.split(r"[,;]", m.group(1)))
    return ids


def link_source_tags(markdown: str, sources: Dict[str, StatuteText]) -> str:
    """Replace [S1] / [S1, S2] tags with linked official citations; drop unknown tags."""

    def repl(m: re.Match) -> str:
        ids = list(dict.fromkeys(i.strip() for i in re.split(r"[,;]", m.group(1))))
        links = [f"[{short_citation(sources[i])}]({sources[i].source_url})" for i in ids if i in sources]
        return f"({'; '.join(links)})" if links else ""

    # Merge adjacent tags: "[S1][S2]" / "[S1] [S2]" -> "[S1, S2]"
    merged = markdown or ""
    while True:
        new = re.sub(r"(\[\s*S\d+(?:\s*[,;]\s*S\d+)*)\s*\]\s*\[\s*(S\d+)", r"\1, \2", merged)
        if new == merged:
            break
        merged = new
    out = _TAG_GROUP.sub(repl, merged)
    return re.sub(r"[ \t]+([.,;:])", r"\1", out)


_SECTION_REF = re.compile(r"(?:§+|\bsections?\b|\bsec\.)\s*(\d+(?:\.\d+)*[a-z]?)", re.IGNORECASE)


def unverified_section_refs(markdown: str, verified_sections: Set[str]) -> List[str]:
    """Section numbers the model wrote itself that are not among verified sources."""
    found = []
    for m in _SECTION_REF.finditer(markdown or ""):
        num = m.group(1).rstrip(".")
        if num not in verified_sections:
            found.append(num)
    return found


def strip_unverified_refs(markdown: str, verified_sections: Set[str]) -> str:
    def repl(m: re.Match) -> str:
        num = m.group(1).rstrip(".")
        return m.group(0) if num in verified_sections else "a related provision"

    return _SECTION_REF.sub(repl, markdown or "")


def query_terms(texts: Iterable[str]) -> Set[str]:
    terms: Set[str] = set()
    for t in texts:
        t = re.sub(r"(\d)\s*%", r"\1 percent", t or "")
        for w in re.findall(r"[a-zA-Z][a-zA-Z\-]{2,}", t.lower()):
            if w not in _STOP:
                terms.add(w)
                if w.endswith("s") and len(w) > 4:
                    terms.add(w[:-1])
    return terms


def excerpt_for_prompt(text: str, terms: Set[str], budget: int = 4000) -> str:
    """Keep the parts of a long statute most relevant to the user's situation.

    Always keeps the opening subdivision (usually the main rule), then adds the
    highest-scoring subdivisions, preserving their original order with […] gaps.
    """
    if len(text) <= budget:
        return text
    paras = [p for p in text.split("\n") if p.strip()]
    para_words = [set(re.findall(r"[a-z][a-z\-]{2,}", p.lower())) for p in paras]
    # Inverse document frequency within this statute: words found in nearly every
    # subdivision ("rent", "notice") say little; distinctive ones ("percent") say a lot.
    n = len(paras)
    idf = {t: math.log((n + 1) / (1 + sum(1 for w in para_words if t in w))) for t in terms}
    scored = []
    for i, words in enumerate(para_words):
        relevance = sum(idf[t] for t in words & terms)
        # Favor short, targeted subdivisions over long ones that match by sheer size.
        score = relevance / math.sqrt(max(len(paras[i]), 80) / 80) + (2.0 if i == 0 else 0.0)
        scored.append((score, i))
    chosen, used = set(), 0
    for score, i in sorted(scored, key=lambda x: (-x[0], x[1])):
        if used + len(paras[i]) > budget:
            continue
        chosen.add(i)
        used += len(paras[i])
    out, last = [], -1
    for i in sorted(chosen):
        if last >= 0 and i != last + 1:
            out.append("[…]")
        out.append(paras[i])
        last = i
    if last != len(paras) - 1:
        out.append("[…]")
    return "\n".join(out)


def location_title(st: StatuteText) -> str:
    """Most specific heading of where the section sits, without the [x - y] range."""
    if not st.hierarchy:
        return st.code_name
    return re.sub(r"\s*\[[^\]]*\]\s*$", "", st.hierarchy[-1]).strip() or st.code_name
