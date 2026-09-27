"use client";

import React, { useEffect, useRef, useState } from "react";
import { BadgeCheck, Briefcase, CheckCircle2, Home, KeyRound, ShieldCheck } from "lucide-react";
import { CaliforniaLogo } from "@/components/brand/CaliforniaLogo";

/**
 * Animated product demo for the hero. Every quote below is the exact official
 * wording from leginfo.legislature.ca.gov (checked when this was written).
 */
const SCENARIOS = [
  {
    id: "rent",
    tab: "Rent increase",
    icon: Home,
    question: "My landlord texted that rent goes from $2,000 to $2,600 next month. Is that allowed?",
    checks: ["Cal. Civ. Code § 827", "Cal. Civ. Code § 1947.12"],
    headline: ["A 30% increase needs at least ", "90 days’ written notice", ", so a text for next month doesn’t meet the rule."],
    citation: "Cal. Civ. Code § 827",
    quote: "…the notice shall be delivered at least 90 days before the effective date of the increase…",
  },
  {
    id: "pay",
    tab: "Final paycheck",
    icon: Briefcase,
    question: "I was fired on Friday and my boss says my last check comes with the next payday.",
    checks: ["Cal. Lab. Code § 201", "Cal. Lab. Code § 203"],
    headline: ["When you’re fired, your final wages are ", "due immediately", ", not on the next payday."],
    citation: "Cal. Lab. Code § 201",
    quote: "If an employer discharges an employee, the wages earned and unpaid at the time of discharge are due and payable immediately.",
  },
  {
    id: "deposit",
    tab: "Security deposit",
    icon: KeyRound,
    question: "I moved out 5 weeks ago and my landlord still hasn’t returned my deposit or said why.",
    checks: ["Cal. Civ. Code § 1950.5"],
    headline: ["Your landlord had ", "21 days", " after you moved out to return the deposit or send an itemized statement."],
    citation: "Cal. Civ. Code § 1950.5",
    quote: "No later than 21 calendar days after the tenant has vacated the premises, … the landlord shall furnish the tenant, a copy of an itemized statement …",
  },
] as const;

type Phase = "typing" | "thinking" | "checking" | "answer";

export function LiveDemo() {
  const [index, setIndex] = useState(0);
  const [typed, setTyped] = useState("");
  const [phase, setPhase] = useState<Phase>("typing");
  const [checked, setChecked] = useState(0);
  const [sweep, setSweep] = useState(false);
  const paused = useRef(false);
  const s = SCENARIOS[index];

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const at = (ms: number, fn: () => void) => timers.push(setTimeout(fn, ms));

    setChecked(0);
    setSweep(false);
    if (reduce) {
      setTyped(s.question);
      setChecked(s.checks.length);
      setPhase("answer");
      setSweep(true);
      return;
    }

    setTyped("");
    setPhase("typing");
    const perChar = 24;
    for (let i = 1; i <= s.question.length; i++) at(i * perChar, () => setTyped(s.question.slice(0, i)));
    let t = s.question.length * perChar + 350;
    at(t, () => setPhase("thinking"));
    t += 900;
    at(t, () => setPhase("checking"));
    s.checks.forEach((_, i) => at(t + 550 * (i + 1), () => setChecked(i + 1)));
    t += 550 * s.checks.length + 500;
    at(t, () => setPhase("answer"));
    at(t + 450, () => setSweep(true));

    // Advance to the next situation unless the visitor is hovering the demo.
    const advance = () => {
      if (paused.current) {
        at(1500, advance);
        return;
      }
      setIndex((n) => (n + 1) % SCENARIOS.length);
    };
    at(t + 5200, advance);

    return () => timers.forEach(clearTimeout);
  }, [index, s]);

  return (
    <div
      className="relative"
      onMouseEnter={() => (paused.current = true)}
      onMouseLeave={() => (paused.current = false)}
    >
      <div className="rounded-[28px] bg-surface border border-paper-300 shadow-lift overflow-hidden">
        {/* Situation tabs */}
        <div role="tablist" aria-label="Example situations" className="flex gap-1 p-2 bg-paper-50 border-b border-paper-200">
          {SCENARIOS.map((sc, i) => {
            const Icon = sc.icon;
            const active = i === index;
            return (
              <button
                key={sc.id}
                role="tab"
                aria-selected={active}
                onClick={() => setIndex(i)}
                className={`relative flex-1 inline-flex items-center justify-center gap-1.5 px-2 py-2 rounded-xl text-xs font-semibold transition-all ${
                  active ? "bg-surface text-ink-900 shadow-card" : "text-ink-500 hover:text-ink-800"
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${active ? "text-gold-500" : ""}`} />
                <span className="truncate">{sc.tab}</span>
              </button>
            );
          })}
        </div>

        <div className="p-5 sm:p-6 min-h-[430px] sm:min-h-[420px] flex flex-col gap-4">
          {/* The visitor's question, typed out */}
          <div className="flex justify-end">
            <p className={`max-w-[88%] bubble-user text-sm leading-relaxed px-4 py-3 rounded-2xl rounded-br-md ${phase === "typing" ? "caret" : ""}`}>
              {typed || " "}
            </p>
          </div>

          {/* Research */}
          {(phase === "thinking" || phase === "checking") && (
            <div className="flex gap-3 pop-in">
              <CaliforniaLogo size={30} animated />
              <div className="flex-1 rounded-2xl border border-paper-300 bg-paper-50 p-4 overflow-hidden relative">
                <div className="absolute inset-x-0 top-0 h-0.5 bg-paper-200 overflow-hidden">
                  <div className="h-full w-1/3 bg-gold-400 progress-indeterminate" />
                </div>
                <p className="text-sm font-medium shimmer-text">
                  {phase === "thinking" ? "Understanding your situation…" : "Checking the official California codes…"}
                </p>
                {phase === "checking" && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {s.checks.slice(0, checked).map((c) => (
                      <span key={c} className="pop-in inline-flex items-center gap-1 text-xs text-sage-700 bg-sage-50 border border-sage-100 px-2.5 py-1 rounded-full">
                        <CheckCircle2 className="w-3 h-3" /> {c}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Answer */}
          {phase === "answer" && (
            <div className="rounded-2xl border border-paper-300 bg-paper-50 p-4 pop-in">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-sage-700 bg-sage-50 border border-sage-100 px-2 py-0.5 rounded-full">
                <BadgeCheck className="w-3 h-3" /> Grounded in official California law
              </span>
              <p className="mt-3 font-display text-[17px] leading-snug text-ink-900">
                {s.headline[0]}
                <span className={`highlight-sweep ${sweep ? "is-on" : ""}`}>{s.headline[1]}</span>
                {s.headline[2]}
              </p>
              <div className="mt-4 rounded-xl bg-surface border border-paper-300 p-4 fade-up" style={{ animationDelay: "250ms" }}>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-display font-semibold text-ink-900">{s.citation}</span>
                  <span className="text-[10px] font-bold uppercase tracking-wide text-sage-700 bg-sage-50 px-1.5 py-0.5 rounded">
                    Applies
                  </span>
                </div>
                <blockquote className="mt-3 border-l-[3px] border-gold-400 pl-3 font-serif text-[13px] leading-relaxed text-ink-700">
                  “{s.quote}”
                </blockquote>
                <p className="mt-2 inline-flex items-center gap-1 text-[10px] text-ink-400">
                  <ShieldCheck className="w-3 h-3 text-sage-500" /> Quoted word-for-word from the official text
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Progress dots */}
      <div className="mt-4 flex justify-center gap-1.5" aria-hidden>
        {SCENARIOS.map((sc, i) => (
          <span key={sc.id} className={`h-1.5 rounded-full transition-all duration-500 ${i === index ? "w-6 bg-gold-400" : "w-1.5 bg-paper-300"}`} />
        ))}
      </div>
    </div>
  );
}
