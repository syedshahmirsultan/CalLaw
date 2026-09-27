"use client";

import React from "react";
import Link from "next/link";
import { ConversationSummary } from "@/types";
import { ConversationList } from "./ConversationList";
import { Plus, X, PanelLeftClose, ShieldCheck } from "lucide-react";
import { CalLawWordmark } from "@/components/brand/CaliforniaLogo";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { AccountMenu } from "@/components/auth/AccountMenu";

const ClerkPublishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

interface SidebarProps {
  conversations: ConversationSummary[];
  activeConversationId?: string;
  onDeleteConversation: (id: string, e: React.MouseEvent) => void;
  isOpen: boolean;
  onClose: () => void;
  onToggleDesktop?: () => void;
  isDesktopCollapsed?: boolean;
  isGuest?: boolean;
}

export function Sidebar({
  conversations,
  activeConversationId,
  onDeleteConversation,
  isOpen,
  onClose,
  onToggleDesktop,
  isDesktopCollapsed = false,
  isGuest = false,
}: SidebarProps) {

  return (
    <>
      {isOpen && (
        <div onClick={onClose} className="fixed inset-0 z-40 bg-night-950/50 backdrop-blur-sm md:hidden" />
      )}

      <aside
        className={`
          fixed md:static inset-y-0 left-0 z-50 flex flex-col bg-night-900 text-cream-100
          transition-all duration-200 ease-in-out
          ${isOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
          ${isDesktopCollapsed ? "md:w-0 md:overflow-hidden" : "w-72"}
        `}
      >
        <div className="px-4 h-16 flex items-center justify-between flex-shrink-0">
          <Link href="/" className="min-w-0" onClick={onClose}>
            <CalLawWordmark size={32} tone="light" />
          </Link>
          <div className="flex items-center gap-1">
            {onToggleDesktop && (
              <button
                onClick={onToggleDesktop}
                title="Hide sidebar"
                className="hidden md:flex p-2 rounded-lg text-night-300 hover:text-cream-50 hover:bg-night-800 transition-colors"
              >
                <PanelLeftClose className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={onClose}
              title="Close"
              className="md:hidden p-2 rounded-lg text-night-300 hover:text-cream-50 hover:bg-night-800 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="px-3 pb-3 flex-shrink-0">
          <Link
            href="/chat"
            onClick={onClose}
            className="flex items-center justify-center gap-2 w-full py-2.5 px-3 rounded-xl bg-gold-400 hover:bg-gold-300 text-night-950 text-sm font-semibold shadow-sm transition-colors"
          >
            <Plus className="w-4 h-4" />
            New question
          </Link>
        </div>

        <div className="flex-1 overflow-y-auto px-2 [&::-webkit-scrollbar-thumb]:bg-night-700">
          <ConversationList
            conversations={conversations}
            activeConversationId={activeConversationId}
            onDeleteConversation={onDeleteConversation}
          />
        </div>

        <div className="mx-3 mb-3 rounded-xl bg-night-800/80 border border-night-700 px-3 py-2.5 flex items-start gap-2 text-[11px] text-night-300 leading-relaxed">
          <ShieldCheck className="w-3.5 h-3.5 text-gold-300 flex-shrink-0 mt-0.5" />
          Answers are checked against the official California codes.
        </div>

        <div className="mx-3 mb-3 flex items-center justify-between">
          <span className="text-[11px] text-night-400">Appearance</span>
          <ThemeToggle tone="night" />
        </div>

        <div className="px-3 py-3 border-t border-night-800 flex-shrink-0">
          {isGuest ? (
            <div className="space-y-2">
              <p className="text-[11px] text-night-300 leading-relaxed">
                You&apos;re a guest. Sign up free to ask more questions and save your history.
              </p>
              <div className="flex gap-2">
                <Link
                  href="/sign-up?redirect_url=/chat"
                  onClick={onClose}
                  className="flex-1 text-center py-2 rounded-xl bg-gold-400 hover:bg-gold-300 text-night-950 text-xs font-semibold transition-colors"
                >
                  Sign up free
                </Link>
                <Link
                  href="/sign-in?redirect_url=/chat"
                  onClick={onClose}
                  className="flex-1 text-center py-2 rounded-xl border border-night-600 text-cream-100 hover:bg-night-800 text-xs font-semibold transition-colors"
                >
                  Sign in
                </Link>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-2">
              {ClerkPublishableKey ? (
                <AccountMenu tone="night" placement="up" />
              ) : (
                <span className="text-xs text-night-300">Your questions</span>
              )}
              <span className="text-[11px] text-night-400">Saved privately</span>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
