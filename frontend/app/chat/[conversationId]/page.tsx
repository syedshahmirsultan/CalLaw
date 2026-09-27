"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2 } from "lucide-react";
import { MessageBubble } from "@/components/chat/MessageBubble";
import { ChatInput } from "@/components/chat/ChatInput";
import { ResearchProgress } from "@/components/chat/ResearchProgress";
import { api, isSignupRequired } from "@/lib/api";
import { useSafeAuthToken } from "@/lib/useAuthToken";
import { Message, ConversationDetail, ProgressEvent } from "@/types";
import { PENDING_MESSAGE_KEY } from "@/lib/utils";
import { useChatAuth } from "@/lib/chatAuth";

export default function ConversationPage() {
  const params = useParams();
  const router = useRouter();
  const conversationId = params?.conversationId as string;

  const [conversation, setConversation] = useState<ConversationDetail | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [progress, setProgress] = useState<ProgressEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  /** Id of the answer that just streamed in (animated on arrival) */
  const [freshId, setFreshId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string | undefined>(undefined);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pendingHandled = useRef(false);
  /** Guards against a second (e.g. React strict-mode) load overwriting a message sent meanwhile */
  const loadedFor = useRef<string | null>(null);
  const getToken = useSafeAuthToken();
  const { guestUsedFreeQuestion, openSignupGate } = useChatAuth();

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });

  const handleSendMessage = useCallback(
    async (content: string) => {
      const text = content.trim();
      if (!text || isLoading) return;

      const tempUserMsg: Message = {
        id: `temp-${Date.now()}`,
        conversation_id: conversationId,
        role: "user",
        content: text,
        created_at: new Date().toISOString(),
        legal_sources: [],
      };
      setMessages((prev) => [...prev.filter((m) => !m.failed), tempUserMsg]);
      setIsLoading(true);
      setProgress([]);
      setError(null);

      try {
        const token = await getToken();
        const response = await api.sendMessageStream(conversationId, text, token, (event) =>
          setProgress((prev) => [...prev, event])
        );
        setMessages((prev) => [
          ...prev.filter((m) => m.id !== tempUserMsg.id),
          response.user_message,
          response.assistant_message,
        ]);
        setFreshId(response.assistant_message.id);
        window.dispatchEvent(new Event("callaw:conversations-changed"));
      } catch (err) {
        if (isSignupRequired(err)) {
          // Guest used their free question: keep what they typed and invite them to sign up.
          setMessages((prev) => prev.filter((m) => m.id !== tempUserMsg.id));
          setEditValue(text);
          openSignupGate();
          return;
        }
        const msg = err instanceof Error ? err.message : "Something went wrong.";
        setMessages((prev) => prev.map((m) => (m.id === tempUserMsg.id ? { ...m, failed: true } : m)));
        setError(msg);
      } finally {
        setIsLoading(false);
        setProgress([]);
      }
    },
    [conversationId, getToken, isLoading, openSignupGate]
  );

  const loadConversation = useCallback(async () => {
    if (!conversationId || loadedFor.current === conversationId) return;
    loadedFor.current = conversationId;
    try {
      setIsInitialLoading(true);
      const token = await getToken();
      const data = await api.getConversation(conversationId, token);
      setConversation(data);
      setMessages(data.messages || []);
    } catch (err) {
      console.error("Failed to load conversation:", err);
      router.push("/chat");
    } finally {
      setIsInitialLoading(false);
    }
  }, [conversationId, getToken, router]);

  useEffect(() => {
    loadConversation();
  }, [loadConversation]);

  // First message typed on the "new inquiry" screen is handed over via sessionStorage.
  useEffect(() => {
    if (isInitialLoading || pendingHandled.current || !conversationId) return;
    pendingHandled.current = true;
    let pending: string | null = null;
    try {
      pending = sessionStorage.getItem(PENDING_MESSAGE_KEY(conversationId));
      sessionStorage.removeItem(PENDING_MESSAGE_KEY(conversationId));
    } catch {
      /* storage unavailable */
    }
    if (pending && messages.length === 0) handleSendMessage(pending);
  }, [isInitialLoading, conversationId, messages.length, handleSendMessage]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, progress.length, isLoading]);

  const handleRetry = (content: string) => {
    setMessages((prev) => prev.filter((m) => !(m.failed && m.content === content)));
    handleSendMessage(content);
  };

  if (isInitialLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-ink-400">
        <Loader2 className="w-6 h-6 animate-spin text-gold-400 mb-3" />
        <p className="text-sm">Opening your conversation…</p>
      </div>
    );
  }

  const lastAssistantId = [...messages].reverse().find((m) => m.role === "assistant")?.id;
  const last = messages[messages.length - 1];
  const awaitingAnswers = last?.role === "assistant" && last.agent_state === "clarifying";
  const title =
    conversation?.title && conversation.title !== "New Legal Inquiry"
      ? conversation.title
      : messages.find((m) => m.role === "user")?.content.slice(0, 60) || "New question";

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      {/* Thread header */}
      <div className="px-4 sm:px-6 h-14 bg-paper-50/90 backdrop-blur-sm border-b border-paper-300/70 flex items-center gap-3 flex-shrink-0 md:pl-16 lg:pl-6">
        <Link href="/chat" className="md:hidden p-1.5 -ml-1 text-ink-500 hover:text-ink-900 rounded-lg hover:bg-paper-200" title="New question">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <h2 className="font-display text-[17px] font-semibold text-ink-900 truncate">{title}</h2>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-4 sm:px-6 pt-6 pb-4 max-w-3xl w-full mx-auto">
          {messages.map((message) => (
            <MessageBubble
              key={message.id}
              message={message}
              isLatest={message.id === lastAssistantId && message === last}
              justArrived={message.id === freshId}
              busy={isLoading}
              onSend={handleSendMessage}
              onEditMessage={message.role === "user" ? setEditValue : undefined}
              onRetryMessage={message.role === "user" ? handleRetry : undefined}
            />
          ))}

          {isLoading && <ResearchProgress events={progress} />}

          {error && !isLoading && (
            <div className="mb-6 rounded-2xl border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/40 px-4 py-3 text-sm text-rose-900 dark:text-rose-200">
              {error}
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      <div className="px-3 sm:px-6 pt-2 pb-4 bg-gradient-to-t from-paper-100 via-paper-100 to-paper-100/0">
        <div className="max-w-3xl w-full mx-auto">
          {guestUsedFreeQuestion && !isLoading ? (
            <div className="rounded-2xl border border-gold-200 bg-gold-50 px-4 py-3.5 flex flex-col sm:flex-row sm:items-center gap-3 fade-up">
              <p className="flex-1 text-sm text-ink-700">
                <span className="font-semibold text-ink-900">Want to keep going?</span> Create a free account to reply
                and save this conversation.
              </p>
              <div className="flex gap-2">
                <button onClick={openSignupGate} className="btn-primary px-4 py-2 rounded-xl text-sm font-semibold">
                  Sign up free
                </button>
                <Link
                  href={`/sign-in?redirect_url=/chat/${conversationId}`}
                  className="px-4 py-2 rounded-xl text-sm font-semibold text-ink-700 bg-surface border border-paper-300 hover:bg-paper-100"
                >
                  Sign in
                </Link>
              </div>
            </div>
          ) : (
          <ChatInput
            onSendMessage={handleSendMessage}
            isLoading={isLoading}
            placeholder={
              awaitingAnswers
                ? "Or type your answer here…"
                : "Ask a follow-up or add more details…"
            }
            initialValue={editValue}
            onInitialValueConsumed={() => setEditValue(undefined)}
          />
          )}
          <p className="text-center text-[11px] text-ink-400 mt-2">
            Legal information, not legal advice · Laws verified on leginfo.legislature.ca.gov
          </p>
        </div>
      </div>
    </div>
  );
}
