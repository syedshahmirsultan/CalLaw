"""Unit tests for the deterministic grounding checks and leginfo parsing."""

from app.agent import grounding
from app.services.leginfo_client import (
    StatuteText,
    build_citation,
    normalize_law_code,
    normalize_section,
    parse_section_page,
)
from app.services.llm_service import extract_json, resolve_llm_config

TEXT = (
    "(a) A landlord shall return the security deposit within 21 days after the tenant has vacated the premises.\n"
    "(b) The landlord may deduct amounts reasonably necessary to repair damages, exclusive of ordinary wear and tear."
)


def test_exact_quote_is_kept():
    q = "A landlord shall return the security deposit within 21 days"
    assert grounding.verify_quote(q, TEXT) == q


def test_whitespace_and_curly_quote_differences_are_tolerated():
    assert grounding.verify_quote("A landlord  shall return the\nsecurity deposit", TEXT)


def test_paraphrased_quote_is_replaced_with_official_text():
    q = "(a) A landlord must return the security deposit within 21 days after the tenant has vacated the premises."
    result = grounding.verify_quote(q, TEXT)
    assert result is not None and result in TEXT


def test_invented_quote_is_rejected():
    assert grounding.verify_quote("Landlords must pay tenants triple damages for any late deposit.", TEXT) is None


def test_unverified_section_refs_detected_and_stripped():
    md = "Under § 1950.5 you get your deposit. Section 1942.5 bars retaliation."
    assert grounding.unverified_section_refs(md, {"1950.5"}) == ["1942.5"]
    assert "1942.5" not in grounding.strip_unverified_refs(md, {"1950.5"})
    assert "§ 1950.5" in grounding.strip_unverified_refs(md, {"1950.5"})


def test_source_tags_become_official_links():
    st = StatuteText(law_code="CIV", section="1950.5", code_name="Civil Code", citation="Cal. Civ. Code § 1950.5",
                     source_url="https://leginfo.legislature.ca.gov/x", text=TEXT)
    out = grounding.link_source_tags("You get it back [S1]. Also [S1, S9].", {"S1": st})
    assert out == ("You get it back ([Civ. Code § 1950.5](https://leginfo.legislature.ca.gov/x)). "
                   "Also ([Civ. Code § 1950.5](https://leginfo.legislature.ca.gov/x)).")


def test_excerpt_keeps_relevant_subdivisions():
    paras = [f"({i}) filler text about unrelated procedure number {i}." * 5 for i in range(40)]
    paras[25] = "(z) The notice for a rent increase greater than 10 percent must be 90 days."
    text = "\n".join(paras)
    ex = grounding.excerpt_for_prompt(text, {"rent", "increase", "notice"}, budget=1200)
    assert "90 days" in ex and paras[0] in ex and "[…]" in ex


def test_law_code_and_section_normalization():
    assert normalize_law_code("Civil Code") == "CIV"
    assert normalize_law_code("Cal. Lab. Code") == "LAB"
    assert normalize_law_code("Health and Safety Code") == "HSC"
    assert normalize_law_code("Code of Civil Procedure") == "CCP"
    assert normalize_law_code("constitution") == "CONS"
    assert normalize_law_code("Martian Code") is None
    assert normalize_section("§ 1950.5(g)") == "1950.5"
    assert normalize_section("SEC. 2.") == "2"
    assert build_citation("CONS", "1", "I") == "Cal. Const., art. I, § 1"


def test_parse_section_page():
    page = (
        '<div id="codeLawSectionNoHead"><h4><b>Civil Code - CIV</b></h4>'
        '<h4 style="display:inline;"><b>DIVISION 2. PROPERTY [654 - 1422]</b></h4>'
        '<h6 style="float:left;"><b>827.&nbsp;&nbsp;</b></h6>'
        '<p>(a)&nbsp;First rule applies here.</p><p>(b)&nbsp;Second rule.</p>'
        '<i>(Amended by Stats. 2024, Ch. 1015, Sec. 1.)</i></div>'
        '<input name="javax.faces.ViewState">'
    )
    st = parse_section_page(page, "CIV", "827", "https://x")
    assert st.text == "(a) First rule applies here.\n(b) Second rule."
    assert st.hierarchy == ["DIVISION 2. PROPERTY [654 - 1422]"]
    assert st.history.startswith("Amended by Stats. 2024")
    assert parse_section_page("<html>no section</html>", "CIV", "1", "https://x") is None


def test_extract_json_handles_fences_and_prose():
    assert extract_json('```json\n{"a": 1}\n```') == {"a": 1}
    assert extract_json('Here you go: {"a": {"b": 2}} thanks') == {"a": {"b": 2}}


def test_provider_override_uses_that_providers_defaults(monkeypatch):
    from app.core.config import settings
    monkeypatch.setattr(settings, "LLM_PROVIDER", "groq")
    monkeypatch.setattr(settings, "LLM_MODEL", "llama-3.3-70b-versatile")
    monkeypatch.setattr(settings, "LLM_BASE_URL", "https://api.groq.com/openai/v1")
    cfg = resolve_llm_config(api_key="user-key", provider="gemini")
    assert cfg.provider == "gemini" and "llama" not in cfg.model and "groq" not in cfg.base_url


def test_adjacent_source_tags_merge_into_one_citation_group():
    st1 = StatuteText(law_code="CIV", section="827", code_name="Civil Code", citation="Cal. Civ. Code § 827",
                      source_url="https://a", text=TEXT)
    st2 = StatuteText(law_code="CIV", section="1947.12", code_name="Civil Code", citation="Cal. Civ. Code § 1947.12",
                      source_url="https://b", text=TEXT)
    out = grounding.link_source_tags("Rule [S1][S2] and [S1] [S1].", {"S1": st1, "S2": st2})
    assert out == "Rule ([Civ. Code § 827](https://a); [Civ. Code § 1947.12](https://b)) and ([Civ. Code § 827](https://a))."


def test_mid_sentence_line_breaks_are_rejoined():
    from app.services.leginfo_client import _html_to_text
    html = "<p>(3) (A) If the proposed rent increase<br/>for that tenant is greater than 10 percent.</p><p>(B) Next.</p>"
    assert _html_to_text(html) == "(3) (A) If the proposed rent increase for that tenant is greater than 10 percent.\n(B) Next."


def test_fullwidth_and_paren_tags_are_normalized():
    assert grounding.normalize_source_tags("rule【S1】 and (S2, S3).") == "rule[S1] and [S2, S3]."


def test_excerpt_prefers_distinctive_subdivisions():
    paras = [
        "(a) The landlord may change the rent upon notice to the tenant in the manner described " * 6,
        "(b) Commercial landlords shall give rent increase notice to commercial tenants.",
        "(c) If the proposed rent increase is greater than 10 percent, the notice shall be delivered at least 90 days before.",
        "(d) Definitions of commercial real property for rent notice purposes.",
    ]
    ex = grounding.excerpt_for_prompt("\n".join(paras), grounding.query_terms(["rent increase of 30% notice"]), budget=700)
    assert "90 days" in ex


def test_em_dashes_are_removed_but_number_ranges_kept():
    em, en = "—", "–"
    assert grounding.remove_em_dashes(f"In most cases {em} unless exempt {em} you pay.") == "In most cases, unless exempt, you pay."
    assert grounding.remove_em_dashes(f"**Deadline** {em} 21 days.") == "**Deadline**: 21 days."
    assert grounding.remove_em_dashes(f"Between 10{en}20% is fine") == f"Between 10{en}20% is fine"


def test_bold_words_followed_by_commas_are_not_turned_into_colons():
    em = "\u2014"
    text = f"It may be a **city ordinance**, **federal law**, or a contract {em} which CalLaw can't verify."
    assert grounding.remove_em_dashes(text) == "It may be a **city ordinance**, **federal law**, or a contract, which CalLaw can't verify."
