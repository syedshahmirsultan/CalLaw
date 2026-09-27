"""Conversation ownership and lifecycle tests."""

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_create_and_list_conversations(client: AsyncClient, auth_headers_user_a):
    """User should be able to create and list their conversations."""
    create_resp = await client.post(
        "/api/v1/conversations",
        headers=auth_headers_user_a,
        json={"title": "Rent Increase Inquiry"}
    )
    assert create_resp.status_code == 201
    conv = create_resp.json()
    assert conv["title"] == "Rent Increase Inquiry"
    conv_id = conv["id"]

    list_resp = await client.get("/api/v1/conversations", headers=auth_headers_user_a)
    assert list_resp.status_code == 200
    items = list_resp.json()
    assert len(items) == 1
    assert items[0]["id"] == conv_id


@pytest.mark.asyncio
async def test_conversation_ownership_isolation(
    client: AsyncClient, auth_headers_user_a, auth_headers_user_b
):
    """
    Scenario 5: User attempts to access another user's conversation.
    Expected: Access denied (404 Not Found), preventing cross-tenant leakage.
    """
    # 1. User A creates a conversation
    create_resp = await client.post(
        "/api/v1/conversations",
        headers=auth_headers_user_a,
        json={"title": "User A Private Legal Matter"}
    )
    assert create_resp.status_code == 201
    conv_id = create_resp.json()["id"]

    # 2. User B attempts to GET User A's conversation
    get_resp = await client.get(f"/api/v1/conversations/{conv_id}", headers=auth_headers_user_b)
    assert get_resp.status_code == 404
    assert get_resp.json()["detail"] == "Conversation not found"

    # 3. User B attempts to PATCH User A's conversation
    patch_resp = await client.patch(
        f"/api/v1/conversations/{conv_id}",
        headers=auth_headers_user_b,
        json={"title": "Hacked Title"}
    )
    assert patch_resp.status_code == 404

    # 4. User B attempts to DELETE User A's conversation
    del_resp = await client.delete(f"/api/v1/conversations/{conv_id}", headers=auth_headers_user_b)
    assert del_resp.status_code == 404

    # 5. User A can still retrieve their own conversation
    user_a_get = await client.get(f"/api/v1/conversations/{conv_id}", headers=auth_headers_user_a)
    assert user_a_get.status_code == 200
    assert user_a_get.json()["title"] == "User A Private Legal Matter"
