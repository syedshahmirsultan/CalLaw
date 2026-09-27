"use client";

import React from "react";
import Link from "next/link";
import { ArrowUp, ArrowUpRight, ShieldCheck } from "lucide-react";
import { CalLawWordmark } from "@/components/brand/CaliforniaLogo";
import { ThemeToggle } from "@/components/theme/ThemeToggle";

const COLUMNS: { title: string; links: { label: string; href: string; external?: boolean }[] }[] = [
  {
    title: "Product",
    links: [
      { label: "How it works", href: "#how" },
      { label: "Features", href: "#features" },
      { label: "Why trust it", href: "#trust" },
      { label: "Free account", href: "#account" },
    ],
  },
  {
    title: "Get started",
    links: [
      { label: "Ask a question", href: "/chat" },
      { label: "Create free account", href: "/sign-up" },
      { label: "Sign in", href: "/sign-in" },
    ],
  },
  {
    title: "Official sources",
    links: [
      { label: "California codes", href: "https://leginfo.legislature.ca.gov/faces/codes.xhtml", external: true },
      {
        label: "California Constitution",
        href: "https://leginfo.legislature.ca.gov/faces/codesTOCSelected.xhtml?tocCode=CONS",
        external: true,
      },
      { label: "California Legislature", href: "https://leginfo.legislature.ca.gov", external: true },
    ],
  },
];

/** Closing band of the landing page; dark in both themes, like the trust section. */
export function SiteFooter() {
  return (
    <footer className="relative overflow-hidden bg-night-900 text-cream-100">
      {/* Gold hairline and a slow glow */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold-400/70 to-transparent" aria-hidden />
      <div className="absolute -top-40 left-1/3 w-[520px] h-[320px] rounded-full bg-gold-400/10 blur-3xl drift" aria-hidden />

      <div className="relative max-w-6xl mx-auto px-5 sm:px-8 pt-16 pb-10">
        <div className="grid gap-12 lg:grid-cols-[1.4fr_2fr]">
          {/* Brand */}
          <div className="max-w-sm">
            <CalLawWordmark size={40} tone="light" />
            <p className="mt-5 text-[15px] leading-relaxed text-night-200">
              Describe what happened in plain words and see the California laws that apply to you, quoted from the
              official text.
            </p>
            <Link
              href="/chat"
              className="group mt-6 inline-flex items-center gap-2 rounded-xl bg-gold-400 hover:bg-gold-300 px-4 py-2.5 text-sm font-semibold text-night-950 transition-colors"
            >
              Ask your first question
              <ArrowUpRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </Link>
          </div>

          {/* Link columns */}
          <nav className="grid grid-cols-2 sm:grid-cols-3 gap-8" aria-label="Footer">
            {COLUMNS.map((col) => (
              <div key={col.title}>
                <h3 className="text-[11px] font-semibold uppercase tracking-widest text-gold-300">{col.title}</h3>
                <ul className="mt-4 space-y-2.5">
                  {col.links.map((l) => (
                    <li key={l.label}>
                      {l.external ? (
                        <a
                          href={l.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="group inline-flex items-center gap-1 text-sm text-night-200 hover:text-cream-50 transition-colors"
                        >
                          {l.label}
                          <ArrowUpRight className="w-3.5 h-3.5 opacity-50 transition-all group-hover:opacity-100 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                        </a>
                      ) : (
                        <Link
                          href={l.href}
                          className="relative text-sm text-night-200 hover:text-cream-50 transition-colors after:absolute after:left-0 after:-bottom-0.5 after:h-px after:w-full after:origin-left after:scale-x-0 after:bg-gold-300 after:transition-transform hover:after:scale-x-100"
                        >
                          {l.label}
                        </Link>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>

        {/* Verified badge strip */}
        <div className="mt-14 flex items-center gap-3 rounded-2xl border border-night-700 bg-night-800/60 px-5 py-4">
          <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-gold-400/15 text-gold-300">
            <ShieldCheck className="w-4 h-4" />
          </span>
          <p className="text-sm text-night-200">
            Every citation is checked live against{" "}
            <span className="font-semibold text-cream-50">leginfo.legislature.ca.gov</span>, the California
            Legislature&apos;s official site.
          </p>
        </div>

        {/* Bottom bar */}
        <div className="mt-10 flex flex-col-reverse gap-4 border-t border-night-800 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-night-400">
            © {new Date().getFullYear()} CalLaw · Made for Californians{" "}
            <span className="text-gold-300" aria-hidden>
              ★
            </span>
          </p>
          <div className="flex items-center gap-3">
            <ThemeToggle tone="night" />
            <button
              type="button"
              onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
              className="group inline-flex items-center gap-1.5 rounded-full border border-night-700 px-3 py-1.5 text-xs font-medium text-night-200 hover:border-gold-400/50 hover:text-cream-50 transition-colors"
            >
              Back to top
              <ArrowUp className="w-3.5 h-3.5 transition-transform group-hover:-translate-y-0.5" />
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
}
