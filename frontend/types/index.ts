export interface NormalizedLegalSource {
  id?: string;
  source_type: string;
  jurisdiction: string;
  code_name: string;
  section: string;
  title: string;
  citation: string;
  source_url: string;
  relevance_summary?: string;
  retrieved_text_snippet?: string;
  /** Passage verified by the backend to appear verbatim in the official text */
  key_quote?: string | null;
  applicability?: "yes" | "maybe" | string | null;
  statute_history?: string | null;
  created_at?: string;
}

export interface ClarifyingQuestion {
  question: string;
  why?: string | null;
  options: string[];
}

export interface MessageDetails {
  headline?: string;
  situation_summary?: string;
  legal_topics?: string[];
  known_facts?: string[];
  assumptions?: string[];
  questions?: ClarifyingQuestion[];
  next_steps?: string[];
  uncertainties?: string[];
  follow_up_questions?: string[];
  emergency?: boolean;
  checked_citations?: { verified: string[]; not_found: string[] };
}

export type AgentState =
  | "clarifying"
  | "answered"
  | "insufficient_evidence"
  | "out_of_scope"
  | "service_unavailable"
  | "user_input";

export interface ProgressEvent {
  stage: string;
  label: string;
  detail?: string | null;
}

export interface Message {
  id: string;
  conversation_id: string;
  role: "user" | "assistant" | "system";
  content: string;
  agent_state?: AgentState | string;
  created_at: string;
  legal_sources: NormalizedLegalSource[];
  details?: MessageDetails | null;
  /** Client-only: message failed to send */
  failed?: boolean;
}

export interface ConversationSummary {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  message_count: number;
}

export interface ConversationDetail {
  id: string;
  user_id: string;
  title: string;
  created_at: string;
  updated_at: string;
  messages: Message[];
}

export interface MessageProcessResponse {
  user_message: Message;
  assistant_message: Message;
  agent_state: AgentState | string;
  clarifying_questions: string[];
  legal_sources: NormalizedLegalSource[];
  uncertainties: string[];
  details: MessageDetails;
}
