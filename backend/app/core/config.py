"""Application configuration using Pydantic Settings."""

from functools import lru_cache
from typing import List
import base64
from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Central configuration for CalLaw Backend."""

    PROJECT_NAME: str = "CalLaw Legal Assistant"
    ENVIRONMENT: str = "development"
    DEBUG: bool = True
    PORT: int = 8000
    ALLOWED_ORIGINS: str = "http://localhost:3000,http://127.0.0.1:3000"

    # Database
    DATABASE_URL: str = "sqlite+aiosqlite:///./callaw.db"

    # Clerk Authentication
    CLERK_SECRET_KEY: str = ""
    CLERK_ISSUER: str = ""
    CLERK_PEM_PUBLIC_KEY: str = ""
    CLERK_PUBLISHABLE_KEY: str = Field(
        default="", validation_alias=AliasChoices("CLERK_PUBLISHABLE_KEY", "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY")
    )

    # LLM Settings
    LLM_PROVIDER: str = "groq"  # "anthropic" | "gemini" | "openai" | "openrouter" | "groq"
    LLM_API_KEY: str = ""
    LLM_MODEL: str = ""     # empty -> provider default (see llm_service.PROVIDER_DEFAULTS)
    LLM_BASE_URL: str = ""  # empty -> provider default
    LLM_SOURCE_BUDGET_CHARS: int = 0  # statute text per answer; 0 -> automatic (smaller for Groq free tier)

    # Legal Search Configuration
    # Messages a visitor may send before signing up
    GUEST_MESSAGE_LIMIT: int = 1

    LEGAL_SEARCH_MODE: str = "hybrid"  # "hybrid" | "official" | "local"
    COURTLISTENER_API_KEY: str = ""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

    @property
    def clerk_issuer(self) -> str:
        """Explicit CLERK_ISSUER, or the Frontend API domain encoded in the publishable key."""
        if self.CLERK_ISSUER:
            return self.CLERK_ISSUER.rstrip("/")
        key = self.CLERK_PUBLISHABLE_KEY.strip()
        if key.startswith(("pk_test_", "pk_live_")):
            try:
                encoded = key.split("_", 2)[2]
                domain = base64.b64decode(encoded + "=" * (-len(encoded) % 4)).decode().rstrip("$")
                if domain:
                    return f"https://{domain}"
            except Exception:
                pass
        return ""

    @property
    def cors_origins(self) -> List[str]:
        """Parse ALLOWED_ORIGINS comma-separated string into a list."""
        if not self.ALLOWED_ORIGINS:
            return ["*"]
        return [origin.strip() for origin in self.ALLOWED_ORIGINS.split(",") if origin.strip()]


@lru_cache()
def get_settings() -> Settings:
    """Return cached settings instance."""
    return Settings()


settings = get_settings()
