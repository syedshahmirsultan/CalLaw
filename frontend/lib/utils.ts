import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { ConversationSummary } from "@/types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export interface GroupedConversations {
  today: ConversationSummary[];
  yesterday: ConversationSummary[];
  lastWeek: ConversationSummary[];
  older: ConversationSummary[];
}

export function groupConversationsByDate(conversations: ConversationSummary[]): GroupedConversations {
  const groups: GroupedConversations = {
    today: [],
    yesterday: [],
    lastWeek: [],
    older: [],
  };

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfYesterday = startOfToday - 86400000;
  const startOfLastWeek = startOfToday - 7 * 86400000;

  for (const conv of conversations) {
    const convTime = new Date(conv.updated_at || conv.created_at).getTime();

    if (convTime >= startOfToday) {
      groups.today.push(conv);
    } else if (convTime >= startOfYesterday) {
      groups.yesterday.push(conv);
    } else if (convTime >= startOfLastWeek) {
      groups.lastWeek.push(conv);
    } else {
      groups.older.push(conv);
    }
  }

  return groups;
}

/** sessionStorage key used to hand the first message from /chat to the new conversation page */
export const PENDING_MESSAGE_KEY = (conversationId: string) => `callaw_pending_${conversationId}`;

/**
 * House style: no em dashes in text written for the user (older saved answers may have them).
 * Never apply to statute text or verified quotes, which must stay verbatim.
 */
export function noEmDash(text: string | null | undefined): string {
  if (!text) return text ?? "";
  if (!text.includes("\u2014") && !text.includes(" \u2013 ")) return text;
  return text
    .replace(/\*\*[ \t]*\u2014[ \t]*/g, "**: ") // "**Label** - text" -> "**Label**: text"
    .replace(/[ \t]*\u2014[ \t]*/g, ", ") // em dash
    .replace(/[ \t]+\u2013[ \t]+/g, ", ") // spaced en dash used as a dash
    .replace(/,\s*([.,;:!?)])/g, "$1")
    .replace(/(^|\n)(\s*(?:[-*]\s+)?), /g, "$1$2");
}
