"use client";

import React, { useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { Message } from "@/types";
import { LegalSourceCard } from "@/components/legal/LegalSourceCard";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Copy,
  CornerDownRight,
  HelpCircle,
  ListChecks,
  Pencil,
  Printer,
  RotateCcw,
  Scale,
  SearchX,
  ShieldCheck,
  WifiOff,
} from "lucide-react";
import { CaliforniaLogo } from "@/components/brand/CaliforniaLogo";
import { ClarificationPrompt } from "./ClarificationPrompt";
import { noEmDash } from "@/lib/utils";
import { printAnswer } from "@/lib/print";

interface MessageBubbleProps {
  message: Message;
  /** True for the most recent assistant message: enables questions and follow-up chips */
  isLatest?: boolean;
  busy?: boolean;
  onSend?: (content: string) => void;
  onEditMessage?: (content: string) => void;
  onRetryMessage?: (content: string) => void;
  /** Answer just streamed in: reveal its sections one after another */
  justArrived?: boolean;
}

const markdownComponents = {
  a: (props: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a {...props} target="_blank" rel="noopener noreferrer" />
  ),
};

/** Split the "**headline**" the backend puts first so it can be shown as a big bottom line. */
function splitHeadline(content: string, headline?: string): { head: string | null; body: string } {
  if (headline && content.startsWith(`**${headline}**`)) {
    return { head: headline, body: content.slice(headline.length + 4).trimStart() };
  }
  return { head: null, body: content };
}

export function MessageBubble({
  message,
  isLatest,
  busy,
  onSend,
  onEditMessage,
  onRetryMessage,
  justArrived = false,
}: MessageBubbleProps) {
  /** Staggered entrance for a fresh answer; nothing for answers loaded from history. */
  const stagger = (ms: number) =>
    justArrived ? { className: "fade-up", style: { animationDelay: `${ms}ms` } as React.CSSProperties } : { className: "", style: undefined };
  const [copied, setCopied] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard not available */
    }
  };

  // ── User message ──
  if (message.role === "user") {
    return (
      <div className="flex justify-end mb-6 group fade-up">
        <div className="flex flex-col items-end gap-1 max-w-[88%] sm:max-w-[78%]">
          <div
            className={`px-4 py-3 rounded-3xl rounded-br-lg text-[15px] leading-relaxed ${
              message.failed ? "bg-rose-50 dark:bg-rose-950/40 text-rose-900 dark:text-rose-200 border border-rose-200 dark:border-rose-900/60" : "bubble-user shadow-card"
            }`}
          >
            <p className="whitespace-pre-wrap">{message.content}</p>
          </div>
          {message.failed && <p className="text-xs text-rose-700 dark:text-rose-300 mt-0.5">Not sent. Tap Retry.</p>}
          <div
            className={`flex items-center gap-0.5 transition-opacity duration-150 ${
              message.failed ? "opacity-100" : "opacity-0 group-hover:opacity-100 focus-within:opacity-100"
            }`}
          >
            <ActionButton
              icon={copied ? <Check className="w-3.5 h-3.5 text-sage-500" /> : <Copy className="w-3.5 h-3.5" />}
              label={copied ? "Copied" : "Copy"}
              onClick={() => handleCopy(message.content)}
            />
            {onEditMessage && (
              <ActionButton icon={<Pencil className="w-3.5 h-3.5" />} label="Edit" onClick={() => onEditMessage(message.content)} />
            )}
            {onRetryMessage && (
              <ActionButton icon={<RotateCcw className="w-3.5 h-3.5" />} label="Retry" onClick={() => onRetryMessage(message.content)} />
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── Assistant message ──
  const state = message.agent_state;
  const details = message.details || {};
  const sources = message.legal_sources || [];
  const isClarifying = state === "clarifying";
  const isAnswered = state === "answered" && sources.length > 0;
  const uncertainties = (details.uncertainties || []).map(noEmDash);
  const nextSteps = (details.next_steps || []).map(noEmDash);
  const followUps = (details.follow_up_questions || []).map(noEmDash);
  const checked = details.checked_citations;
  const split = splitHeadline(message.content, details.headline);
  const head = split.head ? noEmDash(split.head) : null;
  const body = noEmDash(split.body);

  return (
    <div className="flex gap-3 mb-8 group fade-up">
      <div className="flex-shrink-0 pt-0.5 hidden sm:block">
        <CaliforniaLogo size={32} />
      </div>

      <div className="flex-1 min-w-0">
        <div ref={cardRef} className="bg-surface border border-paper-300/80 rounded-3xl rounded-tl-lg shadow-card overflow-hidden">
          <div className="px-4 sm:px-6 pt-4 sm:pt-5 pb-5 sm:pb-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-3 gap-2">
              <StateBadge state={state} hasSources={sources.length > 0} />
              <div className="flex items-center gap-0.5 sm:opacity-0 sm:group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                <button
                  onClick={() => handleCopy(message.content)}
                  className="flex items-center gap-1 px-2 py-1 text-[11px] text-ink-400 hover:text-ink-800 hover:bg-paper-100 rounded-lg transition-colors"
                  title="Copy answer"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-sage-500" /> : <Copy className="w-3.5 h-3.5" />}
                  <span className="hidden sm:inline">{copied ? "Copied" : "Copy"}</span>
                </button>
                {isAnswered && (
                  <button
                    onClick={() => cardRef.current && printAnswer(cardRef.current, head || "California law summary")}
                    className="flex items-center gap-1 px-2 py-1 text-[11px] text-ink-400 hover:text-ink-800 hover:bg-paper-100 rounded-lg transition-colors"
                    title="Print or save as PDF"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Print / PDF</span>
                  </button>
                )}
              </div>
            </div>

            {details.emergency && (
              <div className="mb-4 flex items-start gap-2.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 px-4 py-3 text-sm text-rose-900 dark:text-rose-200">
                <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-300 flex-shrink-0 mt-0.5" />
                <span>
                  If you are in immediate danger, call <strong>911</strong>. For domestic violence support, the National
                  Domestic Violence Hotline is <strong>1-800-799-7233</strong> (24/7).
                </span>
              </div>
            )}

            {head && (
              <div className={`md-headline relative mb-4 pb-4 ${stagger(0).className}`} style={stagger(0).style}>
                <ReactMarkdown components={markdownComponents}>{head}</ReactMarkdown>
                <span
                  className={`absolute left-0 bottom-0 h-px w-full bg-paper-200 origin-left ${justArrived ? "grow-x" : ""}`}
                  aria-hidden
                />
                <span
                  className={`absolute left-0 bottom-0 h-[2px] w-16 bg-gold-400 origin-left ${justArrived ? "grow-x" : ""}`}
                  style={justArrived ? { animationDelay: "250ms" } : undefined}
                  aria-hidden
                />
              </div>
            )}

            <div className={`md ${stagger(140).className}`} style={stagger(140).style}>
              <ReactMarkdown components={markdownComponents}>{body}</ReactMarkdown>
            </div>

            {isClarifying && details.questions && (
              <ClarificationPrompt
                questions={details.questions.map((q) => ({ ...q, question: noEmDash(q.question), why: noEmDash(q.why) }))} interactive={!!isLatest && !busy} onSubmit={onSend} />
            )}
          </div>

          {/* Laws */}
          {isAnswered && (
            <Section icon={<Scale className="w-4 h-4" />} title="The law behind this answer" tone="paper" {...stagger(280)}>
              <div className="space-y-3">
                {sources.map((s, i) => (
                  <div key={s.id || s.citation} {...stagger(380 + i * 120)}>
                    <LegalSourceCard source={s} index={i} />
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Next steps */}
          {nextSteps.length > 0 && (
            <Section icon={<ListChecks className="w-4 h-4" />} title="What you can do next" {...stagger(520 + sources.length * 120)}>
              <ol className="space-y-2.5">
                {nextSteps.map((step, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full chip-accent text-xs font-semibold flex items-center justify-center mt-0.5">
                      {i + 1}
                    </span>
                    <div className="md flex-1 !text-[15px]">
                      <ReactMarkdown components={markdownComponents}>{step}</ReactMarkdown>
                    </div>
                  </li>
                ))}
              </ol>
            </Section>
          )}

          {/* Uncertainties */}
          {isAnswered && uncertainties.length > 0 && (
            <Section icon={<HelpCircle className="w-4 h-4" />} title="What could change this answer" {...stagger(640 + sources.length * 120)}>
              <ul className="space-y-2">
                {uncertainties.map((u, i) => (
                  <li key={i} className="text-[15px] text-ink-600 leading-relaxed pl-4 relative">
                    <span className="absolute left-0 top-[0.6rem] w-1.5 h-1.5 rounded-full bg-gold-400" />
                    <span className="md !text-[15px] inline">
                      <ReactMarkdown components={{ ...markdownComponents, p: ({ children }) => <>{children}</> }}>{u}</ReactMarkdown>
                    </span>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {/* Verification footnote */}
          {checked && (checked.verified?.length > 0 || checked.not_found?.length > 0) && (
            <div className="px-5 sm:px-6 py-3 bg-paper-50 border-t border-paper-200 text-xs text-ink-400 flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 text-sage-500 flex-shrink-0" />
              <span>
                Checked {checked.verified?.length || 0} section{checked.verified?.length === 1 ? "" : "s"} on
                leginfo.legislature.ca.gov
                {checked.not_found?.length
                  ? ` · rejected ${checked.not_found.length} citation${checked.not_found.length === 1 ? " that doesn't" : "s that don't"} exist`
                  : ""}
                {" · "}Legal information, not legal advice.
              </span>
            </div>
          )}
        </div>

        {/* Follow-up chips */}
        {isLatest && !busy && followUps.length > 0 && onSend && (
          <div className="mt-4">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-ink-400 mb-2 pl-1">You might also ask</p>
            <div className="flex flex-wrap gap-2">
              {followUps.map((q, i) => (
                <button
                  key={q}
                  onClick={() => onSend(q)}
                  className="pop-in group inline-flex items-center gap-1.5 text-sm text-ink-700 bg-surface border border-paper-300 hover:border-gold-300 hover:bg-gold-50 hover:-translate-y-0.5 px-3.5 py-2 rounded-full shadow-card transition-all"
                  style={{ animationDelay: `${(justArrived ? 800 + sources.length * 120 : 0) + i * 90}ms` }}
                >
                  <CornerDownRight className="w-3.5 h-3.5 text-gold-500 transition-transform group-hover:translate-x-0.5" />
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────

function Section({
  icon,
  title,
  children,
  tone = "white",
  className = "",
  style,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
  tone?: "white" | "paper";
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div className={`px-4 sm:px-6 py-5 border-t border-paper-200 ${tone === "paper" ? "bg-paper-50" : ""} ${className}`} style={style}>
      <h4 className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-widest text-ink-500 mb-3.5">
        <span className="text-gold-500">{icon}</span>
        {title}
      </h4>
      {children}
    </div>
  );
}

function StateBadge({ state, hasSources }: { state?: string; hasSources: boolean }) {
  const map: Record<string, { label: string; icon: React.ReactNode; cls: string }> = {
    clarifying: {
      label: "A few quick questions",
      icon: <HelpCircle className="w-3.5 h-3.5" />,
      cls: "bg-gold-50 text-gold-700 border-gold-100",
    },
    answered: {
      label: "Grounded in official California law",
      icon: <CheckCircle2 className="w-3.5 h-3.5" />,
      cls: "bg-sage-50 text-sage-700 border-sage-100",
    },
    insufficient_evidence: {
      label: "No California statute found",
      icon: <SearchX className="w-3.5 h-3.5" />,
      cls: "bg-paper-100 text-ink-600 border-paper-300",
    },
    out_of_scope: {
      label: "Outside California law",
      icon: <Scale className="w-3.5 h-3.5" />,
      cls: "bg-paper-100 text-ink-600 border-paper-300",
    },
    service_unavailable: {
      label: "Temporarily unavailable",
      icon: <WifiOff className="w-3.5 h-3.5" />,
      cls: "bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-200 border-rose-200 dark:border-rose-900/60",
    },
  };
  const entry = state && map[state];
  if (!entry || (state === "answered" && !hasSources)) {
    return <span className="font-display font-semibold text-sm text-ink-900">CalLaw</span>;
  }
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border ${entry.cls}`}>
      {entry.icon}
      {entry.label}
    </span>
  );
}

function ActionButton({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1 px-2 py-1 text-[11px] text-ink-400 hover:text-ink-800 hover:bg-paper-200 rounded-lg transition-colors"
    >
      {icon}
      {label}
    </button>
  );
}
