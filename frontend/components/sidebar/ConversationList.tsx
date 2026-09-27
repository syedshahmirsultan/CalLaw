"use client";

import React from "react";
import Link from "next/link";
import { ConversationSummary } from "@/types";
import { groupConversationsByDate } from "@/lib/utils";
import { Trash2 } from "lucide-react";

interface ConversationListProps {
  conversations: ConversationSummary[];
  activeConversationId?: string;
  onDeleteConversation: (id: string, e: React.MouseEvent) => void;
}

export function ConversationList({ conversations, activeConversationId, onDeleteConversation }: ConversationListProps) {
  const grouped = groupConversationsByDate(conversations);

  const renderGroup = (title: string, items: ConversationSummary[]) => {
    if (items.length === 0) return null;
    return (
      <div key={title} className="mb-5">
        <h3 className="px-3 text-[10px] font-semibold text-night-400 uppercase tracking-widest mb-1.5">{title}</h3>
        <div className="space-y-0.5">
          {items.map((conv) => {
            const isActive = conv.id === activeConversationId;
            return (
              <div
                key={conv.id}
                className={`group relative flex items-center rounded-lg text-[13px] transition-colors ${
                  isActive ? "bg-night-800 text-cream-50" : "text-night-200 hover:bg-night-800/60 hover:text-cream-50"
                }`}
              >
                {isActive && <span className="absolute left-0 top-2 bottom-2 w-[3px] rounded-full bg-gold-400" />}
                <Link href={`/chat/${conv.id}`} className="flex-1 min-w-0 truncate pl-3.5 pr-2 py-2">
                  {conv.title || "Legal question"}
                </Link>
                <button
                  onClick={(e) => onDeleteConversation(conv.id, e)}
                  title="Delete"
                  className="opacity-0 group-hover:opacity-100 focus:opacity-100 p-1.5 mr-1 rounded-md text-night-400 hover:text-rose-300 transition-opacity"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  if (conversations.length === 0) {
    return (
      <div className="mx-2 mt-2 px-3 py-6 text-center text-xs text-night-400 border border-dashed border-night-700 rounded-xl leading-relaxed">
        Your questions will appear here.
      </div>
    );
  }

  return (
    <div className="py-1">
      {renderGroup("Today", grouped.today)}
      {renderGroup("Yesterday", grouped.yesterday)}
      {renderGroup("Previous 7 days", grouped.lastWeek)}
      {renderGroup("Older", grouped.older)}
    </div>
  );
}
