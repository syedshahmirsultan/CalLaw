"""Security and authentication utilities, including Clerk JWT verification."""

import re
import time
from typing import Any, Dict, Optional
import httpx
import jwt
from jwt.algorithms import RSAAlgorithm

from app.core.config import settings
from app.core.logging import logger

# In-memory cache for Clerk JWKS keys: {kid: public_key}
_JWKS_CACHE: Dict[str, Any] = {}
_JWKS_CACHE_EXPIRY: float = 0.0
JWKS_CACHE_TTL = 3600  # 1 hour

# "guest_" + a UUID4 generated in the visitor's browser; unguessable, so it works as a bearer id.
GUEST_TOKEN_RE = re.compile(r"^guest_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$")


async def get_clerk_jwks() -> Dict[str, Any]:
    """Fetch Clerk JWKS public keys with caching."""
    global _JWKS_CACHE, _JWKS_CACHE_EXPIRY
    current_time = time.time()

    if _JWKS_CACHE and current_time < _JWKS_CACHE_EXPIRY:
        return _JWKS_CACHE

    if not settings.clerk_issuer:
        return {}

    jwks_url = f"{settings.clerk_issuer}/.well-known/jwks.json"
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(jwks_url)
            if resp.status_code == 200:
                jwks_data = resp.json()
                keys = {}
                for key_dict in jwks_data.get("keys", []):
                    kid = key_dict.get("kid")
                    if kid:
                        keys[kid] = RSAAlgorithm.from_jwk(key_dict)
                _JWKS_CACHE = keys
                _JWKS_CACHE_EXPIRY = current_time + JWKS_CACHE_TTL
                logger.info(f"Loaded {len(keys)} keys from Clerk JWKS.")
                return _JWKS_CACHE
    except Exception as e:
        logger.error(f"Failed to fetch Clerk JWKS from {jwks_url}: {e}")

    return _JWKS_CACHE


async def verify_clerk_token(token: str) -> Optional[Dict[str, Any]]:
    """
    Verify and decode Clerk JWT.
    
    Returns decoded claims dict with at least:
    - 'sub': Clerk User ID
    - 'email': User Email (if present)
    """
    if not token:
        return None

    # Guest visitors: a random per-browser id. Guests are limited to
    # GUEST_MESSAGE_LIMIT messages before they must sign up (see api/guards.py).
    if GUEST_TOKEN_RE.match(token):
        return {"sub": token, "email": None, "guest": True}

    # Development fallback for mock/test tokens (never honored outside development)
    is_dev = settings.ENVIRONMENT.lower() in ("development", "dev", "local", "test")
    if is_dev and token.startswith(("dev_", "test_", "mock_")):
        user_id = token
        return {
            "sub": user_id,
            "email": f"{user_id}@example.com",
            "first_name": "Dev",
            "last_name": "User",
        }

    # If offline PEM public key is provided
    if settings.CLERK_PEM_PUBLIC_KEY:
        try:
            decoded = jwt.decode(
                token,
                settings.CLERK_PEM_PUBLIC_KEY,
                algorithms=["RS256"],
                options={"verify_exp": True, "verify_aud": False}
            )
            return decoded
        except Exception as e:
            logger.warning(f"PEM token verification failed: {e}")

    # Verify against Clerk JWKS if issuer is configured
    if settings.clerk_issuer:
        try:
            # First extract kid from header without full verification
            unverified_header = jwt.get_unverified_header(token)
            kid = unverified_header.get("kid")

            jwks = await get_clerk_jwks()
            public_key = jwks.get(kid) if kid else None

            if public_key:
                decoded = jwt.decode(
                    token,
                    public_key,
                    algorithms=["RS256"],
                    issuer=settings.clerk_issuer,
                    options={"verify_exp": True, "verify_aud": False}
                )
                return decoded
        except Exception as e:
            logger.warning(f"JWKS token verification failed: {e}")

    # Fallback in development mode: If no Clerk keys set up yet, allow decoding payload
    if is_dev and not settings.CLERK_SECRET_KEY and not settings.clerk_issuer:
        try:
            decoded = jwt.decode(token, options={"verify_signature": False, "verify_exp": False})
            if "sub" in decoded:
                return decoded
        except Exception as e:
            logger.warning(f"Development unverified decoding failed: {e}")

    return None
