"use client";

import React, { useEffect, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { ProgressEvent } from "@/types";
import { CaliforniaLogo } from "@/components/brand/CaliforniaLogo";

interface ResearchProgressProps {
  /** Live stages streamed from the backend, oldest first */
  events: ProgressEvent[];
}

export function ResearchProgress({ events }: ResearchProgressProps) {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  // "received" is just an acknowledgement; hide it once real work starts.
  const visible = (events.length > 1 ? events.filter((e) => e.stage !== "received") : events).filter(
    (e) => e.stage !== "verifying"
  );
  // Laws confirmed on leginfo so far, shown as chips while the rest are checked.
  const verifiedSoFar = events.filter((e) => e.stage === "verifying").map((e) => e.label.replace(/^Verified /, ""));
  const steps = visible.length ? visible : [{ stage: "sending", label: "Sending your message" }];

  return (
    <div className="flex gap-3 mb-8 fade-up" role="status" aria-live="polite">
      <div className="flex-shrink-0 pt-0.5 hidden sm:block">
        <CaliforniaLogo size={32} animated />
      </div>
      <div className="flex-1 min-w-0">
        <div className="relative overflow-hidden bg-surface border border-paper-300/80 rounded-3xl rounded-tl-lg shadow-card px-5 sm:px-6 py-5">
          <div className="absolute inset-x-0 top-0 h-[3px] bg-paper-200 overflow-hidden" aria-hidden>
            <div className="h-full w-1/3 bg-gradient-to-r from-transparent via-gold-400 to-transparent progress-indeterminate" />
          </div>
          <div className="flex items-center justify-between mb-4">
            <span className="font-display font-semibold text-[15px] text-ink-900">Looking up California law</span>
            <span className="text-xs tabular-nums text-ink-400 bg-paper-100 px-2 py-0.5 rounded-full">{seconds}s</span>
          </div>

          <ol className="space-y-2.5">
            {steps.map((step, idx) => {
              const isCurrent = idx === steps.length - 1;
              return (
                <li key={`${step.stage}-${idx}`} className="flex items-start gap-2.5 fade-up">
                  <div className="mt-0.5 flex-shrink-0">
                    {isCurrent ? (
                      <div className="w-4 h-4 rounded-full border-2 border-gold-400 border-t-transparent animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4 text-sage-500" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className={`text-[15px] leading-snug ${isCurrent ? "shimmer-text font-medium" : "text-ink-500"}`}>
                      {step.label}
                    </p>
                    {step.detail && (
                      <p className="text-xs text-ink-400 mt-1 break-words">{step.detail}</p>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>

          {verifiedSoFar.length > 0 && (
            <div className="mt-4 pt-3 border-t border-paper-200 flex flex-wrap gap-1.5">
              {verifiedSoFar.map((c) => (
                <span
                  key={c}
                  className="fade-up inline-flex items-center gap-1 text-xs text-sage-700 bg-sage-50 border border-sage-100 px-2.5 py-1 rounded-full"
                >
                  <CheckCircle2 className="w-3 h-3" />
                  {c}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
