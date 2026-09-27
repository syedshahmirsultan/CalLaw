"use client";

import { createContext, useContext } from "react";

export interface ChatAuthState {
  /** Not signed in: using the free guest question */
  isGuest: boolean;
  /** Guest has already asked their one free question */
  guestUsedFreeQuestion: boolean;
  openSignupGate: () => void;
}

export const ChatAuthContext = createContext<ChatAuthState>({
  isGuest: false,
  guestUsedFreeQuestion: false,
  openSignupGate: () => {},
});

export const useChatAuth = () => useContext(ChatAuthContext);
