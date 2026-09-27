/**
 * Guest identity: a random id kept in this browser so visitors can try one
 * question before signing up. After sign-up the conversation is claimed into
 * the real account (see ClaimGuestConversations).
 */
const GUEST_KEY = "callaw_guest_token";
const LEGACY_CLAIMED_KEY = "callaw_legacy_claimed";
/** Shared demo id used by earlier local builds; its history is claimed once on first sign-in. */
export const LEGACY_DEV_TOKEN = "dev_user_california_citizen";

function uuid4(): string {
  const c: Crypto = globalThis.crypto;
  if (typeof c.randomUUID === "function") return c.randomUUID();
  // Older browsers: build a v4 UUID from random bytes.
  const b = c.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

export function getGuestToken(): string {
  try {
    let t = localStorage.getItem(GUEST_KEY);
    if (!t) {
      t = `guest_${uuid4()}`;
      localStorage.setItem(GUEST_KEY, t);
    }
    return t;
  } catch {
    return `guest_${uuid4()}`;
  }
}

/** Tokens whose conversations should move into the account that just signed in. */
export function pendingGuestTokens(): string[] {
  const tokens: string[] = [];
  try {
    const t = localStorage.getItem(GUEST_KEY);
    if (t) tokens.push(t);
    if (!localStorage.getItem(LEGACY_CLAIMED_KEY)) tokens.push(LEGACY_DEV_TOKEN);
  } catch {
    /* storage unavailable */
  }
  return tokens;
}

export function markGuestTokensClaimed() {
  try {
    localStorage.removeItem(GUEST_KEY);
    localStorage.setItem(LEGACY_CLAIMED_KEY, "1");
  } catch {
    /* storage unavailable */
  }
}
