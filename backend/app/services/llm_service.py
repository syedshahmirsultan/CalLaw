"""Pluggable LLM service for structured (JSON) completions.

Supports Anthropic Claude, Google Gemini, and any OpenAI-compatible endpoint
(OpenAI, Groq, OpenRouter, Together, local Ollama). Unlike the previous version,
failures are never silently replaced by canned answers: callers get an
LLMUnavailableError and decide how to degrade honestly.
"""

import asyncio
import json
import re
from dataclasses import dataclass
from typing import Any, Dict, Optional

import httpx

from app.core.config import settings
from app.core.logging import logger


class LLMUnavailableError(RuntimeError):
    """Raised when no LLM is configured or every attempt to call it failed."""


@dataclass
class LLMConfig:
    provider: str
    api_key: str
    model: str
    base_url: str


# Sensible defaults per provider so a key for one provider never gets sent with
# another provider's model name or URL.
PROVIDER_DEFAULTS: Dict[str, Dict[str, str]] = {
    "anthropic": {"model": "claude-sonnet-5", "base_url": "https://api.anthropic.com/v1"},
    "gemini": {"model": "gemini-2.5-flash", "base_url": "https://generativelanguage.googleapis.com/v1beta"},
    "groq": {"model": "openai/gpt-oss-120b", "base_url": "https://api.groq.com/openai/v1"},
    "openai": {"model": "gpt-4.1-mini", "base_url": "https://api.openai.com/v1"},
    "openrouter": {"model": "anthropic/claude-sonnet-5", "base_url": "https://openrouter.ai/api/v1"},
}


def resolve_llm_config(api_key: Optional[str] = None, provider: Optional[str] = None) -> Optional[LLMConfig]:
    """Combine per-request overrides (from the UI settings modal) with server settings."""
    server_provider = (settings.LLM_PROVIDER or "groq").lower()
    req_provider = (provider or "").lower().strip() or None

    if api_key and api_key.strip():
        prov = req_provider or server_provider
        key = api_key.strip()
    elif settings.LLM_API_KEY:
        prov = server_provider
        key = settings.LLM_API_KEY
    else:
        return None

    defaults = PROVIDER_DEFAULTS.get(prov, PROVIDER_DEFAULTS["openai"])
    # Only use the server's model/base_url when the provider matches the server's provider.
    same = prov == server_provider
    model = (settings.LLM_MODEL if same and settings.LLM_MODEL else defaults["model"])
    base_url = (settings.LLM_BASE_URL if same and settings.LLM_BASE_URL else defaults["base_url"]).rstrip("/")
    return LLMConfig(provider=prov, api_key=key, model=model, base_url=base_url)


def extract_json(raw: str) -> Dict[str, Any]:
    """Parse a JSON object out of model output that may include fences or prose."""
    text = (raw or "").strip()
    text = re.sub(r"^```(?:json)?\s*", "", text, flags=re.IGNORECASE)
    text = re.sub(r"\s*```\s*$", "", text)
    try:
        parsed = json.loads(text)
        if isinstance(parsed, dict):
            return parsed
    except json.JSONDecodeError:
        pass
    # Fall back to the outermost {...} block.
    start, end = text.find("{"), text.rfind("}")
    if start >= 0 and end > start:
        parsed = json.loads(text[start: end + 1])
        if isinstance(parsed, dict):
            return parsed
    raise ValueError("Model output did not contain a JSON object")


class LLMService:
    """Unified JSON completion across providers."""

    @classmethod
    def source_budget_chars(cls, api_key: Optional[str] = None, provider: Optional[str] = None) -> int:
        """How much statute text to send per answer. Free tiers (e.g. Groq's 8k tokens/min) need far less."""
        cfg = resolve_llm_config(api_key, provider)
        if cfg and cfg.provider == "groq":
            return settings.LLM_SOURCE_BUDGET_CHARS or 14000
        return settings.LLM_SOURCE_BUDGET_CHARS or 26000

    @classmethod
    def is_configured(cls, api_key: Optional[str] = None, provider: Optional[str] = None) -> bool:
        return resolve_llm_config(api_key, provider) is not None

    @classmethod
    async def generate_json(
        cls,
        system_instruction: str,
        user_prompt: str,
        api_key: Optional[str] = None,
        provider: Optional[str] = None,
        max_tokens: int = 3000,
        temperature: float = 0.1,
    ) -> Dict[str, Any]:
        cfg = resolve_llm_config(api_key, provider)
        if cfg is None:
            raise LLMUnavailableError(
                "No AI model is configured. Set LLM_API_KEY in backend/.env or add a key in AI Settings."
            )

        system = system_instruction + "\n\nRespond with a single valid JSON object only. No markdown fences, no prose outside the JSON."
        last_error: Optional[Exception] = None
        for attempt in range(4):
            try:
                if cfg.provider == "anthropic":
                    raw = await cls._call_anthropic(cfg, system, user_prompt, max_tokens, temperature)
                elif cfg.provider == "gemini":
                    raw = await cls._call_gemini(cfg, system, user_prompt, max_tokens, temperature)
                else:
                    raw = await cls._call_openai_compatible(cfg, system, user_prompt, max_tokens, temperature)
                return extract_json(raw)
            except _AuthError as e:
                raise LLMUnavailableError(str(e)) from e
            except Exception as e:  # network, rate limit, bad JSON: retry with backoff
                last_error = e
                logger.warning(f"LLM call attempt {attempt + 1} failed ({cfg.provider}/{cfg.model}): {str(e)[:200]}")
                # Rate limits usually say how long to wait ("try again in 11.4s"); honor it.
                wait = re.search(r"try again in (?:(\d+)m)?([\d.]+)s", str(e))
                delay = (int(wait.group(1) or 0) * 60 + float(wait.group(2)) + 0.5) if wait else 1.5 * (attempt + 1)
                if delay > 45:
                    break
                await asyncio.sleep(delay)
        raise LLMUnavailableError(f"The AI model could not be reached: {last_error}")

    # ------------------------------------------------------------------ providers

    @staticmethod
    def _check(resp: httpx.Response, name: str) -> None:
        if resp.status_code in (401, 403):
            raise _AuthError(f"{name} rejected the API key ({resp.status_code}). Check LLM_API_KEY / provider settings.")
        if resp.status_code == 404:
            raise _AuthError(f"{name} returned 404: the model name may be wrong: {resp.text[:200]}")
        if resp.status_code != 200:
            raise RuntimeError(f"{name} returned {resp.status_code}: {resp.text[:300]}")

    @classmethod
    async def _call_anthropic(cls, cfg: LLMConfig, system: str, user: str, max_tokens: int, temperature: float) -> str:
        payload = {
            "model": cfg.model,
            "max_tokens": max_tokens,
            "temperature": temperature,
            "system": system,
            "messages": [{"role": "user", "content": user}],
        }
        headers = {
            "x-api-key": cfg.api_key,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
        }
        async with httpx.AsyncClient(timeout=120.0) as client:
            resp = await client.post(f"{cfg.base_url}/messages", headers=headers, json=payload)
        cls._check(resp, "Anthropic")
        data = resp.json()
        return "".join(block.get("text", "") for block in data.get("content", []) if block.get("type") == "text")

    @classmethod
    async def _call_gemini(cls, cfg: LLMConfig, system: str, user: str, max_tokens: int, temperature: float) -> str:
        url = f"{cfg.base_url}/models/{cfg.model}:generateContent"
        payload = {
            "system_instruction": {"parts": [{"text": system}]},
            "contents": [{"role": "user", "parts": [{"text": user}]}],
            "generationConfig": {
                "temperature": temperature,
                "maxOutputTokens": max_tokens,
                "response_mime_type": "application/json",
            },
        }
        async with httpx.AsyncClient(timeout=120.0) as client:
            resp = await client.post(url, headers={"x-goog-api-key": cfg.api_key}, json=payload)
        cls._check(resp, "Gemini")
        data = resp.json()
        parts = data.get("candidates", [{}])[0].get("content", {}).get("parts", [])
        return "".join(p.get("text", "") for p in parts)

    @classmethod
    async def _call_openai_compatible(cls, cfg: LLMConfig, system: str, user: str, max_tokens: int, temperature: float) -> str:
        payload = {
            "model": cfg.model,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            "temperature": temperature,
            "max_tokens": max_tokens,
            "response_format": {"type": "json_object"},
        }
        headers = {"Authorization": f"Bearer {cfg.api_key}", "Content-Type": "application/json"}
        async with httpx.AsyncClient(timeout=120.0) as client:
            resp = await client.post(f"{cfg.base_url}/chat/completions", headers=headers, json=payload)
        cls._check(resp, cfg.provider.capitalize())
        return resp.json()["choices"][0]["message"]["content"]


class _AuthError(RuntimeError):
    """Non-retryable configuration error (bad key or model)."""
