"use client";

import React, { useEffect, useState } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { THEME_STORAGE_KEY as STORAGE_KEY, type ThemeChoice } from "@/lib/theme";

function applyTheme(choice: ThemeChoice) {
  const dark =
    choice === "dark" || (choice === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
}

function readChoice(): ThemeChoice {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === "light" || v === "dark" ? v : "system";
  } catch {
    return "system";
  }
}

const OPTIONS: { value: ThemeChoice; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "system", label: "System", icon: Monitor },
  { value: "dark", label: "Dark", icon: Moon },
];

/**
 * Three-way theme switch. `tone="night"` is for the always-dark sidebar.
 */
export function ThemeToggle({ tone = "auto" }: { tone?: "auto" | "night" }) {
  const [choice, setChoice] = useState<ThemeChoice>("system");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setChoice(readChoice());
    setMounted(true);
  }, []);

  // Follow the OS setting live while on "system".
  useEffect(() => {
    if (!mounted || choice !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyTheme("system");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [choice, mounted]);

  const select = (value: ThemeChoice) => {
    setChoice(value);
    try {
      localStorage.setItem(STORAGE_KEY, value);
    } catch {
      /* storage unavailable: still apply for this page view */
    }
    applyTheme(value);
  };

  const night = tone === "night";
  return (
    <div
      role="radiogroup"
      aria-label="Color theme"
      className={`inline-flex items-center gap-0.5 p-0.5 rounded-full border ${
        night ? "bg-night-800 border-night-700" : "bg-paper-200/70 border-paper-300"
      }`}
    >
      {OPTIONS.map(({ value, label, icon: Icon }) => {
        const active = mounted && choice === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={`${label} theme`}
            title={`${label} theme`}
            onClick={() => select(value)}
            className={`w-7 h-7 rounded-full flex items-center justify-center transition-all ${
              active
                ? night
                  ? "bg-night-600 text-gold-300 shadow-sm"
                  : "bg-surface text-ink-900 shadow-card"
                : night
                  ? "text-night-300 hover:text-cream-100"
                  : "text-ink-400 hover:text-ink-800"
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
          </button>
        );
      })}
    </div>
  );
}
