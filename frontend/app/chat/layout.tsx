"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter, useParams } from "next/navigation";
import { Sidebar } from "@/components/sidebar/Sidebar";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { api } from "@/lib/api";
import { useAuthSession } from "@/lib/useAuthToken";
import { markGuestTokensClaimed, pendingGuestTokens } from "@/lib/guest";
import { ChatAuthContext } from "@/lib/chatAuth";
import { SignupGate } from "@/components/auth/SignupGate";
import { ConversationSummary } from "@/types";
import { Loader2, Menu, PanelLeftOpen } from "lucide-react";
import { CalLawWordmark } from "@/components/brand/CaliforniaLogo";

export default function ChatLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  /** Mobile sidebar open/close */
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  /** Desktop: sidebar collapsed (ChatGPT-style full-width toggle) */
  const [desktopCollapsed, setDesktopCollapsed] = useState(false);
  const router = useRouter();
  const params = useParams();
  const activeConversationId = params?.conversationId as string | undefined;

  const { getToken, isLoaded, isSignedIn } = useAuthSession();
  /** True once auth is known and any guest conversations were moved into the account */
  const [ready, setReady] = useState(false);
  const [gateOpen, setGateOpen] = useState(false);

  // After sign-in, claim conversations started as a guest before showing anything.
  useEffect(() => {
    if (!isLoaded) return;
    const tokens = isSignedIn ? pendingGuestTokens() : [];
    if (!tokens.length) {
      setReady(true);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const token = await getToken();
        await api.claimGuestConversations(tokens, token);
        markGuestTokensClaimed();
      } catch (err) {
        console.error("Could not move guest conversations:", err);
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn, getToken]);

  const loadConversations = useCallback(async () => {
    if (!ready) return;
    try {
      const token = await getToken();
      const data = await api.listConversations(token);
      setConversations(data);
    } catch (err) {
      console.error("Failed to load conversations:", err);
    }
  }, [getToken, ready]);

  useEffect(() => {
    loadConversations();
  }, [loadConversations, activeConversationId]);

  useEffect(() => {
    const refresh = () => loadConversations();
    window.addEventListener("callaw:conversations-changed", refresh);
    return () => window.removeEventListener("callaw:conversations-changed", refresh);
  }, [loadConversations]);

  /** Conversation waiting for delete confirmation */
  const [pendingDelete, setPendingDelete] = useState<ConversationSummary | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleDeleteConversation = (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDeleteError(null);
    setPendingDelete(conversations.find((c) => c.id === id) ?? null);
  };

  const closeDeleteDialog = useCallback(() => {
    setPendingDelete(null);
    setDeleteError(null);
  }, []);

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    const id = pendingDelete.id;
    setDeleting(true);
    setDeleteError(null);
    try {
      const token = await getToken();
      await api.deleteConversation(id, token);
      setConversations((prev) => prev.filter((c) => c.id !== id));
      setPendingDelete(null);
      if (activeConversationId === id) router.push("/chat");
    } catch {
      setDeleteError("Couldn't delete it. Check that the server is running and try again.");
    } finally {
      setDeleting(false);
    }
  };

  const chatAuth = useMemo(
    () => ({
      isGuest: isLoaded && !isSignedIn,
      guestUsedFreeQuestion: isLoaded && !isSignedIn && conversations.some((c) => c.message_count > 0),
      openSignupGate: () => setGateOpen(true),
    }),
    [isLoaded, isSignedIn, conversations]
  );

  return (
    <ChatAuthContext.Provider value={chatAuth}>
    <div className="flex h-screen bg-paper-100 overflow-hidden">
      {/* Sidebar */}
      <Sidebar
        conversations={conversations}
        activeConversationId={activeConversationId}
        onDeleteConversation={handleDeleteConversation}
        isOpen={mobileSidebarOpen}
        onClose={() => setMobileSidebarOpen(false)}
        onToggleDesktop={() => setDesktopCollapsed((v) => !v)}
        isDesktopCollapsed={desktopCollapsed}
        isGuest={chatAuth.isGuest}
      />

      <SignupGate open={gateOpen} onClose={() => setGateOpen(false)} />

      <ConfirmDialog
        open={!!pendingDelete}
        tone="danger"
        title="Delete this conversation?"
        description={
          <>
            <span className="font-medium text-ink-800">&ldquo;{pendingDelete?.title || "Legal question"}&rdquo;</span>{" "}
            and its answers will be permanently removed. This can&apos;t be undone.
          </>
        }
        confirmLabel={deleting ? "Deleting…" : "Delete"}
        cancelLabel="Keep it"
        busy={deleting}
        error={deleteError}
        onConfirm={confirmDelete}
        onCancel={closeDeleteDialog}
      />

      {/* Main content area */}
      <div className="flex-1 flex flex-col min-w-0 bg-paper-100 h-full overflow-hidden relative">
        {/* Mobile top bar */}
        <div className="md:hidden flex items-center gap-2 px-3 h-14 bg-paper-50 border-b border-paper-300/70 flex-shrink-0">
          <button
            onClick={() => setMobileSidebarOpen(true)}
            className="p-2 rounded-lg text-ink-600 hover:text-ink-900 hover:bg-paper-200 transition-colors"
            title="Open menu"
          >
            <Menu className="w-5 h-5" />
          </button>
          <CalLawWordmark size={26} />
          <div className="ml-auto">
            <ThemeToggle />
          </div>
        </div>

        {desktopCollapsed && (
          <button
            onClick={() => setDesktopCollapsed(false)}
            className="hidden md:flex absolute top-3 left-3 z-20 items-center gap-2 p-2 rounded-xl bg-surface border border-paper-300 shadow-card text-ink-600 hover:text-ink-900 transition-colors"
            title="Show your questions"
          >
            <PanelLeftOpen className="w-4 h-4" />
          </button>
        )}

        {/* Page content */}
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden relative">
          {ready ? (
            children
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-ink-400">
              <Loader2 className="w-6 h-6 animate-spin text-gold-400 mb-3" />
              <p className="text-sm">Getting your questions ready…</p>
            </div>
          )}
        </div>
      </div>
    </div>
    </ChatAuthContext.Provider>
  );
}
