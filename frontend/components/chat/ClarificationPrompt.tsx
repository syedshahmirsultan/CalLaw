"use client";

import React, { useState } from "react";
import { ArrowRight, Check } from "lucide-react";
import { ClarifyingQuestion } from "@/types";

interface ClarificationPromptProps {
  questions: ClarifyingQuestion[];
  /** Only the latest unanswered question set is interactive */
  interactive: boolean;
  onSubmit?: (answer: string) => void;
}

/**
 * Tap-to-answer clarifying questions. Answers are composed into one plain-text
 * reply so the conversation history stays readable ("Q → A").
 */
export function ClarificationPrompt({ questions, interactive, onSubmit }: ClarificationPromptProps) {
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [typed, setTyped] = useState<Record<number, string>>({});

  if (!questions?.length) return null;

  const answerFor = (i: number) => (typed[i]?.trim() ? typed[i].trim() : answers[i]);
  const answeredCount = questions.filter((_, i) => answerFor(i)).length;

  const submit = () => {
    if (!onSubmit || answeredCount === 0) return;
    const lines = questions
      .map((q, i) => (answerFor(i) ? `${q.question}\n→ ${answerFor(i)}` : null))
      .filter(Boolean);
    onSubmit(lines.join("\n\n"));
  };

  return (
    <div className="mt-4 space-y-3">
      {questions.map((q, i) => (
        <div
          key={i}
          className={`rounded-2xl border p-4 transition-colors ${
            answerFor(i) ? "border-gold-200 bg-gold-50" : "border-paper-300 bg-paper-50/60"
          }`}
        >
          <div className="flex items-start gap-2.5">
            <span className="flex-shrink-0 w-6 h-6 rounded-full chip-accent text-xs font-semibold flex items-center justify-center mt-0.5">
              {i + 1}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-[15px] font-semibold text-ink-900 leading-snug">{q.question}</p>
              {q.why && <p className="text-[13px] text-ink-500 mt-1 leading-relaxed">{q.why}</p>}

              {interactive && (
                <>
                  {q.options?.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-3">
                      {q.options.map((opt) => {
                        const selected = answers[i] === opt && !typed[i]?.trim();
                        return (
                          <button
                            key={opt}
                            type="button"
                            onClick={() => {
                              setAnswers((a) => ({ ...a, [i]: opt }));
                              setTyped((t) => ({ ...t, [i]: "" }));
                            }}
                            className={`inline-flex items-center gap-1.5 text-sm px-3.5 py-2 rounded-full border transition-all ${
                              selected
                                ? "btn-primary border-transparent shadow-sm"
                                : "bg-surface border-paper-300 text-ink-700 hover:border-gold-300 hover:text-ink-900"
                            }`}
                          >
                            {selected && <Check className="w-3 h-3" />}
                            {opt}
                          </button>
                        );
                      })}
                    </div>
                  )}
                  <input
                    type="text"
                    value={typed[i] || ""}
                    onChange={(e) => setTyped((t) => ({ ...t, [i]: e.target.value }))}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        submit();
                      }
                    }}
                    placeholder={q.options?.length ? "Or type your own answer…" : "Type your answer…"}
                    className="mt-2.5 w-full text-sm bg-surface border border-paper-300 rounded-xl px-3.5 py-2 placeholder:text-ink-300 focus:outline-none focus:border-gold-300 focus:ring-2 focus:ring-gold-100"
                  />
                </>
              )}
            </div>
          </div>
        </div>
      ))}

      {interactive && (
        <div className="flex items-center justify-between gap-3 pt-1">
          <p className="text-[11px] text-ink-400">
            {answeredCount}/{questions.length} answered · skip any you&apos;re unsure about
          </p>
          <button
            type="button"
            onClick={submit}
            disabled={answeredCount === 0}
            className="inline-flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-xl btn-primary disabled:opacity-40 disabled:cursor-not-allowed shadow-sm transition-all active:scale-[0.98]"
          >
            Continue
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
