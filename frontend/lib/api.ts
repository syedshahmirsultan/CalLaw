import {
  ConversationSummary,
  ConversationDetail,
  MessageProcessResponse,
  Message,
  ProgressEvent,
} from "@/types";

import { getGuestToken } from "@/lib/guest";

const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_API_URL || "http://localhost:8000/api/v1";

/** Error from the CalLaw API, with the HTTP status and an optional machine-readable code. */
export class ApiError extends Error {
  constructor(message: string, public status: number, public code?: string) {
    super(message);
    this.name = "ApiError";
  }
}

export function isSignupRequired(err: unknown): boolean {
  return err instanceof ApiError && err.code === "signup_required";
}

async function toApiError(response: Response): Promise<ApiError> {
  const body = await response.text();
  try {
    const detail = JSON.parse(body).detail;
    if (detail && typeof detail === "object") {
      return new ApiError(detail.message || "Request failed", response.status, detail.code);
    }
    return new ApiError(detail || `Request failed (${response.status})`, response.status);
  } catch {
    return new ApiError(body || `Request failed (${response.status})`, response.status);
  }
}

function buildHeaders(token?: string | null, extra?: HeadersInit): Headers {
  const headers = new Headers(extra || {});
  headers.set("Content-Type", "application/json");
  // Signed-in users send their Clerk session token; visitors send their guest id.
  headers.set("Authorization", `Bearer ${token || getGuestToken()}`);
  return headers;
}

function apiUrl(endpoint: string): string {
  return `${API_BASE_URL.replace(/\/$/, "")}/${endpoint.replace(/^\//, "")}`;
}

export async function fetchWithAuth<T>(
  endpoint: string,
  options: RequestInit = {},
  token?: string | null
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(apiUrl(endpoint), { ...options, headers: buildHeaders(token, options.headers) });
  } catch {
    throw new ApiError("Can't reach the CalLaw server. Make sure the backend is running on port 8000.", 0);
  }
  if (!response.ok) throw await toApiError(response);
  if (response.status === 204) return {} as T;
  return response.json();
}

export const api = {
  // Conversation endpoints
  async listConversations(token?: string | null): Promise<ConversationSummary[]> {
    return fetchWithAuth<ConversationSummary[]>("conversations", { method: "GET" }, token);
  },

  async createConversation(
    data: { title?: string; initial_message?: string },
    token?: string | null
  ): Promise<ConversationSummary> {
    return fetchWithAuth<ConversationSummary>(
      "conversations",
      {
        method: "POST",
        body: JSON.stringify(data),
      },
      token
    );
  },

  async getConversation(
    conversationId: string,
    token?: string | null
  ): Promise<ConversationDetail> {
    return fetchWithAuth<ConversationDetail>(
      `conversations/${conversationId}`,
      { method: "GET" },
      token
    );
  },

  async updateConversationTitle(
    conversationId: string,
    title: string,
    token?: string | null
  ): Promise<ConversationSummary> {
    return fetchWithAuth<ConversationSummary>(
      `conversations/${conversationId}`,
      {
        method: "PATCH",
        body: JSON.stringify({ title }),
      },
      token
    );
  },

  async deleteConversation(
    conversationId: string,
    token?: string | null
  ): Promise<void> {
    return fetchWithAuth<void>(
      `conversations/${conversationId}`,
      { method: "DELETE" },
      token
    );
  },

  // Message & Legal Agent endpoints
  async sendMessage(
    conversationId: string,
    content: string,
    token?: string | null
  ): Promise<MessageProcessResponse> {
    return fetchWithAuth<MessageProcessResponse>(
      `conversations/${conversationId}/messages`,
      {
        method: "POST",
        body: JSON.stringify({ content }),
      },
      token
    );
  },

  /**
   * Send a message and receive live progress via Server-Sent Events.
   * Resolves with the final result; calls onProgress for each research stage.
   */
  async sendMessageStream(
    conversationId: string,
    content: string,
    token: string | null | undefined,
    onProgress: (event: ProgressEvent) => void
  ): Promise<MessageProcessResponse> {
    let response: Response;
    try {
      response = await fetch(apiUrl(`conversations/${conversationId}/messages/stream`), {
        method: "POST",
        headers: buildHeaders(token),
        body: JSON.stringify({ content }),
      });
    } catch {
      throw new ApiError("Can't reach the CalLaw server. Make sure the backend is running on port 8000.", 0);
    }
    if (!response.ok || !response.body) {
      throw await toApiError(response);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let idx: number;
      buffer = buffer.replace(/\r\n/g, "\n");
      while ((idx = buffer.indexOf("\n\n")) >= 0) {
        const chunk = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 2);
        const dataLine = chunk.split("\n").find((l) => l.startsWith("data: "));
        if (!dataLine) continue;
        const event = JSON.parse(dataLine.slice(6));
        if (event.type === "progress") onProgress(event as ProgressEvent);
        else if (event.type === "final") return event.data as MessageProcessResponse;
        else if (event.type === "error") throw new Error(event.detail || "Something went wrong.");
      }
    }
    throw new Error("The connection closed before the answer was ready. Please try again.");
  },

  async claimGuestConversations(guestTokens: string[], token: string): Promise<{ moved_conversations: number }> {
    return fetchWithAuth("auth/claim", { method: "POST", body: JSON.stringify({ guest_tokens: guestTokens }) }, token);
  },

  async getMessages(
    conversationId: string,
    token?: string | null
  ): Promise<Message[]> {
    return fetchWithAuth<Message[]>(
      `conversations/${conversationId}/messages`,
      { method: "GET" },
      token
    );
  },
};
