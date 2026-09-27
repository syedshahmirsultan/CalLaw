"use client";

import React, { useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowRight, BookmarkCheck, MessagesSquare, ShieldCheck, X } from "lucide-react";
import { CaliforniaLogo } from "@/components/brand/CaliforniaLogo";

const PERKS = [
  { icon: MessagesSquare, text: "Keep this conversation going and ask follow-ups" },
  { icon: BookmarkCheck, text: "Your questions are saved privately to your account" },
  { icon: ShieldCheck, text: "Free. No credit card." },
];

/** Shown when a guest has used their free question. */
export function SignupGate({ open, onClose }: { open: boolean; onClose: () => void }) {
  const pathname = usePathname();
  const primaryRef = useRef<HTMLAnchorElement>(null);
  const redirect = encodeURIComponent(pathname || "/chat");

  useEffect(() => {
    if (!open) return;
    primaryRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-4">
      <div className="absolute inset-0 bg-night-950/60 backdrop-blur-sm fade-up" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="gate-title"
        className="relative w-full max-w-md bg-surface border border-paper-300 rounded-3xl shadow-lift overflow-hidden pop-in"
      >
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute top-4 right-4 p-1.5 rounded-lg text-ink-400 hover:text-ink-800 hover:bg-paper-100 z-10"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="relative px-7 pt-8 pb-6 bg-paper-50 border-b border-paper-200 overflow-hidden">
          <div className="absolute -right-10 -top-10 w-40 h-40 rounded-full bg-gold-100 blur-2xl opacity-80" aria-hidden />
          <CaliforniaLogo size={44} className="relative logo-sway" />
          <h2 id="gate-title" className="relative mt-5 font-display text-2xl font-semibold text-ink-900 leading-tight">
            You&apos;ve used your free question.
            <br />
            <span className="italic text-gold-500">Keep going with an account.</span>
          </h2>
        </div>

        <div className="px-7 py-6">
          <ul className="space-y-3">
            {PERKS.map(({ icon: Icon, text }, i) => (
              <li key={text} className="flex items-center gap-3 text-sm text-ink-700 fade-up" style={{ animationDelay: `${120 + i * 80}ms` }}>
                <span className="w-8 h-8 rounded-xl chip-accent flex items-center justify-center flex-shrink-0">
                  <Icon className="w-4 h-4" />
                </span>
                {text}
              </li>
            ))}
          </ul>

          <div className="mt-7 flex flex-col gap-2.5">
            <Link
              ref={primaryRef}
              href={`/sign-up?redirect_url=${redirect}`}
              className="btn-primary inline-flex items-center justify-center gap-2 py-3.5 rounded-2xl font-semibold shadow-card"
            >
              Create free account <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href={`/sign-in?redirect_url=${redirect}`}
              className="inline-flex items-center justify-center py-3 rounded-2xl text-sm font-semibold text-ink-700 bg-paper-100 hover:bg-paper-200 border border-paper-300 transition-colors"
            >
              I already have an account
            </Link>
          </div>
          <p className="mt-4 text-center text-xs text-ink-400">Your conversation so far moves into your new account.</p>
        </div>
      </div>
    </div>
  );
}
