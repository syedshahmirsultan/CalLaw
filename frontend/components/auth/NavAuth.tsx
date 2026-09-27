"use client";

import React from "react";
import Link from "next/link";
import { ArrowRight, MessageSquarePlus } from "lucide-react";
import { SignedIn, SignedOut } from "@clerk/nextjs";
import { AccountMenu } from "@/components/auth/AccountMenu";
import { CLERK_ENABLED } from "@/lib/useAuthToken";

/** Sign in / Sign up for visitors; "Open CalLaw" + account menu once signed in. */
export function NavAuth() {
  if (!CLERK_ENABLED) {
    return (
      <Link href="/chat" className="btn-primary inline-flex items-center gap-1.5 text-sm font-semibold px-4 py-2.5 rounded-xl shadow-card">
        Open CalLaw <ArrowRight className="w-4 h-4" />
      </Link>
    );
  }
  return (
    <>
      <SignedOut>
        <div className="flex items-center gap-4">
        <Link
          href="/sign-in"
          className="hidden sm:inline-flex text-sm font-semibold text-ink-700 hover:text-ink-950 px-3 py-2 rounded-xl hover:bg-paper-200/70 transition-colors"
        >
          Sign in
        </Link>
        <Link
          href="/sign-up"
          className="btn-primary group inline-flex items-center gap-1.5 text-sm font-semibold px-4 py-2.5 rounded-xl shadow-card"
        >
          Sign up
          <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
        </Link>
        </div>
      </SignedOut>
      <SignedIn>
        <div className="flex items-center gap-5">
          <Link
            href="/chat"
            className="btn-primary group inline-flex items-center gap-1.5 text-sm font-semibold px-4 py-2.5 rounded-xl shadow-card"
          >
            <MessageSquarePlus className="w-4 h-4" />
            <span className="hidden sm:inline">Ask a question</span>
            <span className="sm:hidden">Ask</span>
          </Link>
          <AccountMenu />
        </div>
      </SignedIn>
    </>
  );
}

/** Hero call-to-action pair, aware of whether the visitor is signed in. */
export function HeroCtas() {
  const primary = (label: string) => (
    <Link
      href="/chat"
      className="btn-primary group inline-flex items-center justify-center gap-2 px-6 py-4 rounded-2xl font-semibold shadow-lift transition-transform hover:-translate-y-0.5"
    >
      {label}
      <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
    </Link>
  );
  if (!CLERK_ENABLED) return primary("Describe your situation");
  return (
    <>
      <SignedOut>
        <div className="flex flex-col sm:flex-row gap-3">
          {primary("Ask your first question free")}
          <Link
            href="/sign-up"
            className="inline-flex items-center justify-center gap-2 px-6 py-4 rounded-2xl bg-surface hover:bg-paper-50 border border-paper-300 text-ink-800 font-semibold transition-colors"
          >
            Create free account
          </Link>
        </div>
      </SignedOut>
      <SignedIn>{primary("Ask a new question")}</SignedIn>
    </>
  );
}

