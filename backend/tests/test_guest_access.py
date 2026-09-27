"""Guests get one free message; after signing up their conversation moves to the account."""

import uuid

import pytest
from httpx import AsyncClient

from app.services.llm_service import LLMService


def guest_headers():
    return {"Authorization": f"Bearer guest_{uuid.uuid4()}"}


@pytest.fixture
def no_llm(monkeypatch):
    # The agent's answer is irrelevant here; we only test access rules.
    monkeypatch.setattr(LLMService, "is_configured", lambda *a, **k: False)


@pytest.mark.asyncio
async def test_guest_gets_exactly_one_message(client: AsyncClient, no_llm):
    headers = guest_headers()
    conv = (await client.post("/api/v1/conversations", headers=headers, json={})).json()

    first = await client.post(f"/api/v1/conversations/{conv['id']}/messages", headers=headers, json={"content": "hello"})
    assert first.status_code == 201

    second = await client.post(f"/api/v1/conversations/{conv['id']}/messages", headers=headers, json={"content": "again"})
    assert second.status_code == 403
    assert second.json()["detail"]["code"] == "signup_required"

    # Streaming endpoint and new conversations are gated too
    stream = await client.post(f"/api/v1/conversations/{conv['id']}/messages/stream", headers=headers, json={"content": "x"})
    assert stream.status_code == 403
    assert (await client.post("/api/v1/conversations", headers=headers, json={})).status_code == 403

    me = (await client.get("/api/v1/auth/me", headers=headers)).json()
    assert me["is_guest"] is True and me["guest_message_limit"] == 1


@pytest.mark.asyncio
async def test_signed_in_users_are_not_limited(client: AsyncClient, auth_headers_user_a, no_llm):
    conv = (await client.post("/api/v1/conversations", headers=auth_headers_user_a, json={})).json()
    for text in ("one", "two", "three"):
        r = await client.post(f"/api/v1/conversations/{conv['id']}/messages", headers=auth_headers_user_a, json={"content": text})
        assert r.status_code == 201


@pytest.mark.asyncio
async def test_malformed_guest_token_is_rejected(client: AsyncClient):
    r = await client.get("/api/v1/auth/me", headers={"Authorization": "Bearer guest_not-a-uuid"})
    assert r.status_code == 401


@pytest.mark.asyncio
async def test_claim_moves_guest_conversation_into_account(client: AsyncClient, auth_headers_user_a, no_llm):
    headers = guest_headers()
    guest_token = headers["Authorization"].split()[1]
    conv = (await client.post("/api/v1/conversations", headers=headers, json={})).json()
    await client.post(f"/api/v1/conversations/{conv['id']}/messages", headers=headers, json={"content": "my question"})

    claimed = await client.post("/api/v1/auth/claim", headers=auth_headers_user_a, json={"guest_tokens": [guest_token]})
    assert claimed.json()["moved_conversations"] == 1

    mine = (await client.get("/api/v1/conversations", headers=auth_headers_user_a)).json()
    assert conv["id"] in [c["id"] for c in mine]
    # The signed-in owner can now continue the conversation
    r = await client.post(f"/api/v1/conversations/{conv['id']}/messages", headers=auth_headers_user_a, json={"content": "follow-up"})
    assert r.status_code == 201
    # And the old guest id no longer sees it
    assert (await client.get(f"/api/v1/conversations/{conv['id']}", headers=headers)).status_code == 404


@pytest.mark.asyncio
async def test_guests_cannot_claim_and_foreign_tokens_are_ignored(client: AsyncClient, auth_headers_user_a):
    r = await client.post("/api/v1/auth/claim", headers=guest_headers(), json={"guest_tokens": []})
    assert r.status_code == 400
    r = await client.post("/api/v1/auth/claim", headers=auth_headers_user_a, json={"guest_tokens": ["dev_user_bob", "anything"]})
    assert r.json()["moved_conversations"] == 0
