"use client";

import React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { SignIn, SignUp } from "@clerk/nextjs";
import { ArrowRight, BadgeCheck, MessagesSquare, Quote, ShieldCheck } from "lucide-react";
import { CalLawWordmark, CaliforniaLogo } from "@/components/brand/CaliforniaLogo";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { RotatingWord } from "@/components/motion/Motion";

const clerkAppearance = {
  variables: { colorPrimary: "#0E1728", colorText: "#0E1728", borderRadius: "0.9rem", fontFamily: "var(--font-inter)" },
  elements: {
    rootBox: "w-full",
    card: "shadow-lift border border-paper-300 w-full",
    formButtonPrimary: "bg-ink-900 hover:bg-ink-800 normal-case text-sm",
    footerActionLink: "text-gold-600 hover:text-gold-700",
  },
};

const PERKS = [
  { icon: MessagesSquare, text: "Unlimited questions and follow-ups" },
  { icon: Quote, text: "The exact law, quoted word-for-word" },
  { icon: BadgeCheck, text: "Your history saved privately" },
];

/** Branded split-screen wrapper for Clerk sign-in / sign-up. */
export function AuthShell({ mode }: { mode: "sign-in" | "sign-up" }) {
  const isClerkConfigured = !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  const params = useSearchParams();
  // Only allow same-site paths as the return destination.
  const requested = params.get("redirect_url") || "/chat";
  const redirect = requested.startsWith("/") && !requested.startsWith("//") ? requested : "/chat";

  return (
    <div className="min-h-screen bg-paper-100 grid lg:grid-cols-[1fr_1.1fr]">
      {/* Brand panel */}
      <aside className="relative hidden lg:flex flex-col justify-between overflow-hidden bg-night-900 text-cream-100 p-12">
        <div className="absolute -top-24 -left-24 w-[420px] h-[420px] rounded-full bg-gold-400/15 blur-3xl drift" aria-hidden />
        <div
          className="absolute bottom-[-120px] right-[-80px] w-[380px] h-[380px] rounded-full bg-sage-500/10 blur-3xl drift"
          style={{ animationDelay: "-9s" }}
          aria-hidden
        />
        <Link href="/" className="relative" aria-label="CalLaw home">
          <CalLawWordmark size={36} tone="light" />
        </Link>

        <div className="relative">
          <CaliforniaLogo size={64} animated className="mb-8" />
          <h2 className="font-display text-4xl xl:text-5xl font-semibold leading-tight">
            Understand your rights on
            <br />
            <span className="italic text-gold-300">
              <RotatingWord words={["your lease.", "your paycheck.", "your deposit.", "an inheritance."]} />
            </span>
          </h2>
          <ul className="mt-10 space-y-4">
            {PERKS.map(({ icon: Icon, text }, i) => (
              <li key={text} className="flex items-center gap-3 fade-up" style={{ animationDelay: `${200 + i * 120}ms` }}>
                <span className="w-9 h-9 rounded-xl bg-gold-400/15 text-gold-300 flex items-center justify-center">
                  <Icon className="w-4 h-4" />
                </span>
                <span className="text-night-100">{text}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative flex items-center gap-2 text-sm text-night-300">
          <ShieldCheck className="w-4 h-4 text-gold-300" />
          Every citation is verified live on leginfo.legislature.ca.gov
        </p>
      </aside>

      {/* Form */}
      <main className="relative flex flex-col items-center justify-center px-5 py-12">
        <div className="absolute inset-0 bg-grain opacity-60 pointer-events-none" aria-hidden />
        <div className="absolute top-4 right-4">
          <ThemeToggle />
        </div>
        <div className="relative w-full max-w-md flex flex-col items-center">
          <Link href="/" className="mb-8 lg:hidden" aria-label="CalLaw home">
            <CalLawWordmark size={40} subtitle="California law, explained" />
          </Link>

          <div className="w-full mb-6 text-center pop-in">
            <h1 className="font-display text-3xl font-semibold text-ink-900">
              {mode === "sign-in" ? "Welcome back" : "Create your free account"}
            </h1>
            <p className="mt-2 text-sm text-ink-500">
              {mode === "sign-in"
                ? "Pick up where you left off."
                : "Takes 30 seconds. Your guest question comes with you."}
            </p>
          </div>

          {isClerkConfigured ? (
            <div className="w-full flex justify-center fade-up" style={{ animationDelay: "120ms" }}>
              {mode === "sign-in" ? (
                <SignIn appearance={clerkAppearance} fallbackRedirectUrl={redirect} signUpUrl={`/sign-up?redirect_url=${encodeURIComponent(redirect)}`} />
              ) : (
                <SignUp appearance={clerkAppearance} fallbackRedirectUrl={redirect} signInUrl={`/sign-in?redirect_url=${encodeURIComponent(redirect)}`} />
              )}
            </div>
          ) : (
            <div className="w-full bg-surface border border-paper-300 rounded-3xl p-8 shadow-lift text-center">
              <p className="text-sm text-ink-500 mb-6 leading-relaxed">
                Sign-in isn&apos;t configured yet. Set <code className="bg-paper-200 px-1 rounded">NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY</code>{" "}
                in <code className="bg-paper-200 px-1 rounded">.env.local</code> to enable accounts.
              </p>
              <Link
                href="/chat"
                className="w-full inline-flex items-center justify-center gap-2 py-3.5 px-4 rounded-2xl btn-primary font-semibold shadow-card"
              >
                Continue to CalLaw <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
