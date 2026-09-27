"""Authentication unit tests."""

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_auth_me_without_header(client: AsyncClient):
    """Accessing protected endpoint without Authorization header must return 401."""
    response = await client.get("/api/v1/auth/me")
    assert response.status_code == 401
    assert "Authorization header missing" in response.json()["detail"]


@pytest.mark.asyncio
async def test_auth_me_with_malformed_header(client: AsyncClient):
    """Malformed Authorization header must return 401."""
    response = await client.get("/api/v1/auth/me", headers={"Authorization": "InvalidFormatToken"})
    assert response.status_code == 401
    assert "Invalid authorization format" in response.json()["detail"]


@pytest.mark.asyncio
async def test_auth_me_with_valid_token(client: AsyncClient, auth_headers_user_a):
    """Valid token should return authenticated user profile."""
    response = await client.get("/api/v1/auth/me", headers=auth_headers_user_a)
    assert response.status_code == 200
    data = response.json()
    assert data["clerk_user_id"] == "dev_user_alice"
    assert "id" in data
