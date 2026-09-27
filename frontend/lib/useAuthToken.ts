"use client";

import { useCallback } from "react";
import { useAuth } from "@clerk/nextjs";
import { getGuestToken } from "@/lib/guest";

export const CLERK_ENABLED = !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

export interface AuthSession {
  /** Clerk session token when signed in, otherwise this browser's guest id */
  getToken: () => Promise<string>;
  isLoaded: boolean;
  isSignedIn: boolean;
}

/**
 * Single source of auth for the app. CLERK_ENABLED is fixed at build time, so the
 * hook call order below never changes between renders.
 */
export function useAuthSession(): AuthSession {
  let clerk: { getToken: () => Promise<string | null>; isLoaded: boolean; isSignedIn: boolean | undefined } | null =
    null;
  if (CLERK_ENABLED) {
    // Static ESM import: a require() here would load a second copy of Clerk with its own context.
    // eslint-disable-next-line react-hooks/rules-of-hooks
    clerk = useAuth();
  }

  const clerkGetToken = clerk?.getToken;
  const signedIn = !!clerk?.isSignedIn;
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const getToken = useCallback(async () => {
    if (signedIn && clerkGetToken) {
      const t = await clerkGetToken();
      if (t) return t;
    }
    return getGuestToken();
  }, [signedIn, clerkGetToken]);

  return { getToken, isLoaded: clerk ? clerk.isLoaded : true, isSignedIn: signedIn };
}

/** Back-compat helper for components that only need a token getter. */
export function useSafeAuthToken(): () => Promise<string> {
  return useAuthSession().getToken;
}
