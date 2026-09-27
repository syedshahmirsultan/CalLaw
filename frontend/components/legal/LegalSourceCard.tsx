"use client";

import React, { useState } from "react";
import { NormalizedLegalSource } from "@/types";
import { noEmDash } from "@/lib/utils";
import { ExternalLink, ChevronDown, ChevronUp, Copy, Check, ShieldCheck } from "lucide-react";

interface LegalSourceCardProps {
  source: NormalizedLegalSource;
  index?: number;
}

export function LegalSourceCard({ source, index }: LegalSourceCardProps) {
  const [showFull, setShowFull] = useState(false);
  const [copied, setCopied] = useState(false);

  const copyCitation = async () => {
    try {
      const text = source.key_quote ? `"${source.key_quote}" (${source.citation})` : source.citation;
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  };

  const isMaybe = source.applicability === "maybe";

  return (
    <div className="bg-surface border border-paper-300 rounded-2xl overflow-hidden hover:border-gold-200 hover:shadow-card transition-all">
      {/* Header */}
      <div className="px-4 sm:px-5 pt-4 pb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {index !== undefined && (
              <span className="w-5 h-5 rounded-full bg-paper-200 text-[10px] font-bold text-ink-600 flex items-center justify-center">{index + 1}</span>
            )}
            <span className="font-display font-semibold text-[16px] text-ink-900 tracking-tight">
              {source.citation}
            </span>
            <span
              className={`text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full border ${
                isMaybe
                  ? "bg-gold-50 text-gold-700 border-gold-200"
                  : "bg-sage-50 text-sage-700 border-sage-100"
              }`}
            >
              {isMaybe ? "May apply" : "Applies"}
            </span>
          </div>
          <p className="text-xs text-ink-400 mt-1 line-clamp-2">
            {source.code_name}
            {source.title && source.title !== source.code_name ? ` · ${source.title}` : ""}
          </p>
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button
            onClick={copyCitation}
            title="Copy citation" aria-label="Copy citation"
            className="p-1.5 rounded-lg text-ink-400 hover:text-ink-700 hover:bg-paper-200 transition-colors"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-sage-500" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
          <a
            href={source.source_url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Official text of ${source.citation}`}
            className="inline-flex items-center gap-1 text-xs font-semibold btn-primary p-2 sm:px-3 sm:py-1.5 rounded-lg transition-colors whitespace-nowrap"
          >
            <span className="hidden sm:inline">Official text</span>
            <ExternalLink className="w-3.5 h-3.5 sm:w-3 sm:h-3" />
          </a>
        </div>
      </div>

      {/* How it applies */}
      {source.relevance_summary && (
        <p className="px-4 sm:px-5 pb-3.5 text-[15px] text-ink-700 leading-relaxed">{noEmDash(source.relevance_summary)}</p>
      )}

      {/* Verified quote */}
      {source.key_quote && (
        <figure className="mx-4 sm:mx-5 mb-4 rounded-xl bg-gold-50/60 dark:bg-paper-200/70 border-l-[3px] border-gold-400 px-4 py-3.5">
          <blockquote className="text-[14.5px] text-ink-800 leading-relaxed font-serif">
            &ldquo;{source.key_quote}&rdquo;
          </blockquote>
          <figcaption className="mt-2.5 flex items-center gap-1.5 text-[11px] font-medium text-ink-500">
            <ShieldCheck className="w-3.5 h-3.5 text-sage-500" />
            Quoted word-for-word from the official text of {source.citation}
          </figcaption>
        </figure>
      )}

      {/* Full official text */}
      {source.retrieved_text_snippet && (
        <div className="border-t border-paper-200">
          <button
            onClick={() => setShowFull((v) => !v)}
            className="w-full px-4 py-2 flex items-center justify-between text-[11px] font-medium text-ink-500 hover:text-ink-800 hover:bg-paper-50 transition-colors"
          >
            <span>{showFull ? "Hide" : "Read"} the full section</span>
            {showFull ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
          {showFull && (
            <div className="px-4 pb-4">
              <div className="max-h-80 overflow-y-auto text-xs text-ink-700 leading-relaxed font-serif whitespace-pre-wrap bg-paper-50 rounded-lg p-3 border border-paper-200">
                {source.retrieved_text_snippet}
              </div>
              {source.statute_history && (
                <p className="text-[10px] text-ink-400 mt-1.5">{source.statute_history}</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
