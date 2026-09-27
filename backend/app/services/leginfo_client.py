"""Live client for the official California Legislative Information site.

Every statute CalLaw shows a user is fetched from leginfo.legislature.ca.gov, the
Legislature's official publication of the California codes and Constitution. A
citation that does not resolve to a real section there is treated as nonexistent,
which is what lets the agent discard hallucinated section numbers.
"""

import asyncio
import html
import json
import os
import re
import time
from dataclasses import asdict, dataclass, field
from typing import Dict, List, Optional
from urllib.parse import quote

import httpx

from app.core.logging import logger

LEGINFO_BASE = "https://leginfo.legislature.ca.gov/faces"

# law_code -> (official name, citation abbreviation)
LAW_CODES: Dict[str, tuple] = {
    "BPC": ("Business and Professions Code", "Bus. & Prof. Code"),
    "CCP": ("Code of Civil Procedure", "Code Civ. Proc."),
    "CIV": ("Civil Code", "Civ. Code"),
    "COM": ("Commercial Code", "Com. Code"),
    "CONS": ("California Constitution", "Cal. Const."),
    "CORP": ("Corporations Code", "Corp. Code"),
    "EDC": ("Education Code", "Educ. Code"),
    "ELEC": ("Elections Code", "Elec. Code"),
    "EVID": ("Evidence Code", "Evid. Code"),
    "FAM": ("Family Code", "Fam. Code"),
    "FIN": ("Financial Code", "Fin. Code"),
    "FGC": ("Fish and Game Code", "Fish & G. Code"),
    "FAC": ("Food and Agricultural Code", "Food & Agric. Code"),
    "GOV": ("Government Code", "Gov. Code"),
    "HNC": ("Harbors and Navigation Code", "Harb. & Nav. Code"),
    "HSC": ("Health and Safety Code", "Health & Saf. Code"),
    "INS": ("Insurance Code", "Ins. Code"),
    "LAB": ("Labor Code", "Lab. Code"),
    "MVC": ("Military and Veterans Code", "Mil. & Vet. Code"),
    "PEN": ("Penal Code", "Pen. Code"),
    "PROB": ("Probate Code", "Prob. Code"),
    "PCC": ("Public Contract Code", "Pub. Contract Code"),
    "PRC": ("Public Resources Code", "Pub. Resources Code"),
    "PUC": ("Public Utilities Code", "Pub. Util. Code"),
    "RTC": ("Revenue and Taxation Code", "Rev. & Tax. Code"),
    "SHC": ("Streets and Highways Code", "Sts. & Hy. Code"),
    "UIC": ("Unemployment Insurance Code", "Unemp. Ins. Code"),
    "VEH": ("Vehicle Code", "Veh. Code"),
    "WAT": ("Water Code", "Wat. Code"),
    "WIC": ("Welfare and Institutions Code", "Welf. & Inst. Code"),
}

# Loose names an LLM or user might use for a code -> law_code
_CODE_ALIASES: Dict[str, str] = {}
for _code, (_name, _abbr) in LAW_CODES.items():
    for _alias in (_code, _name, _abbr, _name.replace(" and ", " & ")):
        _CODE_ALIASES[re.sub(r"[^a-z&]", "", _alias.lower())] = _code
_CODE_ALIASES.update({
    "constitution": "CONS", "californiaconstitution": "CONS", "calconst": "CONS",
    "civilprocedure": "CCP", "codeofcivilprocedure": "CCP", "civproc": "CCP",
    "healthandsafety": "HSC", "healthsafetycode": "HSC", "h&s": "HSC",
    "businessprofessionscode": "BPC", "b&p": "BPC", "vehicle": "VEH",
    "labor": "LAB", "penal": "PEN", "family": "FAM", "government": "GOV",
    "welfareinstitutionscode": "WIC", "revenuetaxationcode": "RTC",
    "foodagriculturalcode": "FAC", "foodandagriculture": "FAC",
})

_ROMAN = re.compile(r"^[IVXLC]+[A-Z]?$")

CACHE_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "leginfo_cache")
CACHE_TTL_SECONDS = 7 * 24 * 3600
NOT_FOUND_TTL_SECONDS = 24 * 3600
_HEADERS = {"User-Agent": "Mozilla/5.0 (CalLaw legal information assistant)"}


@dataclass
class StatuteText:
    """One verified section of California law, as published on leginfo."""

    law_code: str
    section: str
    code_name: str
    citation: str
    source_url: str
    text: str
    hierarchy: List[str] = field(default_factory=list)
    history: str = ""
    article: Optional[str] = None


def normalize_law_code(raw: str) -> Optional[str]:
    """Map 'Civil Code', 'Cal. Civ. Code', 'civ' etc. to leginfo's law code (CIV)."""
    if not raw:
        return None
    key = re.sub(r"[^a-z&]", "", raw.lower().replace("california", "").replace("cal.", ""))
    if key in _CODE_ALIASES:
        return _CODE_ALIASES[key]
    upper = raw.strip().upper()
    return upper if upper in LAW_CODES else None


def normalize_section(raw: str) -> str:
    """Clean a section number: '§ 1947.12.' -> '1947.12', 'SEC. 7' -> '7'."""
    s = (raw or "").strip()
    s = re.sub(r"^(section|sec\.?|§+)\s*", "", s, flags=re.IGNORECASE)
    s = s.strip().rstrip(".").strip()
    s = re.sub(r"\(.*$", "", s).strip()  # drop subdivision like 1950.5(g)
    return s


def build_citation(law_code: str, section: str, article: Optional[str] = None) -> str:
    if law_code == "CONS":
        return f"Cal. Const., art. {article}, § {section}" if article else f"Cal. Const. § {section}"
    return f"Cal. {LAW_CODES[law_code][1]} § {section}"


def section_url(law_code: str, section: str, article: Optional[str] = None) -> str:
    if law_code == "CONS":
        return f"{LEGINFO_BASE}/codes_displayText.xhtml?lawCode=CONS&article={quote(article or '')}"
    return f"{LEGINFO_BASE}/codes_displaySection.xhtml?lawCode={law_code}&sectionNum={quote(section)}"


# ---------------------------------------------------------------------------
# HTML parsing
# ---------------------------------------------------------------------------

def _html_to_text(fragment: str) -> str:
    """Convert a leginfo HTML fragment to readable text, one subdivision per line."""
    t = re.sub(r"(?i)<br\s*/?>", "\n", fragment)
    t = re.sub(r"(?i)</p>|</h[1-6]>|</div>", "\n", t)
    t = re.sub(r"<[^>]+>", "", t)
    t = re.sub(r"[\xa0 -​  　]", " ", html.unescape(t))
    t = re.sub(r"[ \t]+", " ", t)
    lines: List[str] = []
    for ln in (raw.strip() for raw in t.split("\n")):
        if not ln:
            continue
        # leginfo sometimes hard-wraps mid-sentence; rejoin lines that continue a sentence.
        if lines and not re.match(r"^\(\w{1,5}\)", ln) and not re.search(r"[.;:!?)\]]$", lines[-1]):
            lines[-1] = f"{lines[-1]} {ln}"
        else:
            lines.append(ln)
    return "\n".join(lines)


def _extract_div(page: str, div_id: str) -> Optional[str]:
    start = page.find(f'id="{div_id}"')
    if start < 0:
        return None
    # The section body ends at the JSF view-state input that follows the display div.
    end = page.find('name="javax.faces.ViewState"', start)
    return page[start: end if end > 0 else start + 200_000]


def parse_section_page(page: str, law_code: str, section: str, url: str) -> Optional[StatuteText]:
    body = _extract_div(page, "codeLawSectionNoHead")
    if not body:
        return None

    hierarchy = []
    for m in re.finditer(r"<h[45][^>]*>\s*<b>(.*?)</b>", body, flags=re.S):
        heading = _html_to_text(m.group(1))
        if heading and not heading.lower().endswith(f"- {law_code.lower()}"):
            hierarchy.append(heading)

    h6 = re.search(r"<h6[^>]*>.*?</h6>", body, flags=re.S)
    content = body[h6.end():] if h6 else body
    history = ""
    hist = list(re.finditer(r"<i>\s*\(([^<]*?(?:Stats\.|enacted|Added|Amended|Repealed)[^<]*?)\)\s*</i>", content))
    if hist:
        history = _html_to_text(hist[-1].group(1))
        content = content[: hist[-1].start()]
    text = _html_to_text(content)
    if len(text) < 15:
        return None

    return StatuteText(
        law_code=law_code,
        section=section,
        code_name=LAW_CODES[law_code][0],
        citation=build_citation(law_code, section),
        source_url=url,
        text=text,
        hierarchy=hierarchy,
        history=re.sub(r"\s+", " ", history),
    )


def parse_constitution_article(page: str, article: str, section: str, url: str) -> Optional[StatuteText]:
    body = _extract_div(page, "manylawsections")
    if not body:
        return None
    # Sections are introduced by <h6>...SEC. 7.</h6> (or "SECTION 1.")
    parts = re.split(r"<h6[^>]*>(.*?)</h6>", body, flags=re.S)
    wanted = normalize_section(section).upper()
    for i in range(1, len(parts) - 1, 2):
        label = _html_to_text(parts[i]).upper()
        num = re.sub(r"^(SECTION|SEC\.)\s*", "", label).rstrip(".").strip()
        if num != wanted:
            continue
        chunk = parts[i + 1]
        history = ""
        hist = list(re.finditer(r"<i>\s*\((.*?)\)\s*</i>", chunk, flags=re.S))
        if hist:
            history = _html_to_text(hist[-1].group(1))
            chunk = chunk[: hist[-1].start()]
        text = _html_to_text(chunk)
        if len(text) < 15:
            return None
        return StatuteText(
            law_code="CONS",
            section=wanted,
            code_name=LAW_CODES["CONS"][0],
            citation=build_citation("CONS", wanted, article),
            source_url=url,
            text=text,
            hierarchy=[f"ARTICLE {article}"],
            history=history,
            article=article,
        )
    return None


# ---------------------------------------------------------------------------
# Fetching with cache
# ---------------------------------------------------------------------------

class LegInfoClient:
    """Fetches and caches official California statute text."""

    _memory: Dict[str, dict] = {}
    _locks: Dict[str, asyncio.Lock] = {}
    _semaphore = asyncio.Semaphore(6)

    @staticmethod
    def _cache_key(law_code: str, section: str, article: Optional[str]) -> str:
        return f"{law_code}_{article or ''}_{section}".replace("/", "_")

    @classmethod
    def _read_cache(cls, key: str) -> Optional[dict]:
        entry = cls._memory.get(key)
        if entry is None:
            path = os.path.join(CACHE_DIR, f"{key}.json")
            if os.path.exists(path):
                try:
                    with open(path, "r", encoding="utf-8") as f:
                        entry = json.load(f)
                    cls._memory[key] = entry
                except Exception:
                    entry = None
        if not entry:
            return None
        ttl = CACHE_TTL_SECONDS if entry.get("found") else NOT_FOUND_TTL_SECONDS
        if time.time() - entry.get("fetched_at", 0) > ttl:
            return None
        return entry

    @classmethod
    def _write_cache(cls, key: str, statute: Optional[StatuteText]) -> None:
        entry = {"fetched_at": time.time(), "found": statute is not None,
                 "statute": asdict(statute) if statute else None}
        cls._memory[key] = entry
        try:
            os.makedirs(CACHE_DIR, exist_ok=True)
            with open(os.path.join(CACHE_DIR, f"{key}.json"), "w", encoding="utf-8") as f:
                json.dump(entry, f)
        except Exception as e:
            logger.debug(f"Could not persist leginfo cache entry {key}: {e}")

    @classmethod
    async def fetch_section(
        cls, law_code: str, section: str, article: Optional[str] = None
    ) -> Optional[StatuteText]:
        """Return the official text of a section, or None if it does not exist.

        Raises httpx.HTTPError only when leginfo itself is unreachable, so callers
        can tell "this citation is fake" apart from "the site is down".
        """
        code = normalize_law_code(law_code)
        sec = normalize_section(section)
        if not code or not sec or not re.match(r"^[0-9A-Za-z.\-]+$", sec):
            return None
        if code == "CONS":
            article = (article or "").strip().upper().replace("ARTICLE", "").strip()
            if not _ROMAN.match(article):
                return None

        key = cls._cache_key(code, sec, article)
        cached = cls._read_cache(key)
        if cached is not None:
            return StatuteText(**cached["statute"]) if cached["found"] else None

        lock = cls._locks.setdefault(key, asyncio.Lock())
        async with lock:
            cached = cls._read_cache(key)
            if cached is not None:
                return StatuteText(**cached["statute"]) if cached["found"] else None

            url = section_url(code, sec, article)
            async with cls._semaphore:
                async with httpx.AsyncClient(timeout=20.0, headers=_HEADERS, follow_redirects=True) as client:
                    resp = await client.get(url)
                    resp.raise_for_status()
                    page = resp.text
                    if code == "CONS":
                        statute = parse_constitution_article(page, article, sec, url)
                    else:
                        statute = parse_section_page(page, code, sec, url)
                        if statute is None:
                            # Sections with several operative versions render a chooser page.
                            alt = re.search(r'href="([^"]*codes_displaySection\.xhtml[^"]*op_statues[^"]*)"', page)
                            if alt:
                                alt_url = html.unescape(alt.group(1))
                                if alt_url.startswith("/"):
                                    alt_url = "https://leginfo.legislature.ca.gov" + alt_url
                                alt_resp = await client.get(alt_url)
                                statute = parse_section_page(alt_resp.text, code, sec, url)

            cls._write_cache(key, statute)
            logger.info(f"leginfo {code} {article or ''} {sec}: {'verified' if statute else 'NOT FOUND'}")
            return statute
