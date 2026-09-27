"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useClerk, useUser } from "@clerk/nextjs";
import { ChevronDown, LogOut, MessagesSquare, Settings } from "lucide-react";

function initials(first?: string | null, last?: string | null, fallback?: string | null) {
  const a = (first || "").trim()[0] || "";
  const b = (last || "").trim()[0] || "";
  return (a + b || (fallback || "?")[0]).toUpperCase();
}

/** Gold initials avatar, or the user's own photo if they uploaded one. */
export function Avatar({ size = 32 }: { size?: number }) {
  const { user } = useUser();
  if (user?.hasImage) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={user.imageUrl}
        alt=""
        width={size}
        height={size}
        className="rounded-full object-cover ring-2 ring-gold-400/60"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span
      className="inline-flex items-center justify-center rounded-full bg-gradient-to-br from-gold-300 to-gold-500 font-semibold text-night-950 ring-2 ring-gold-400/30"
      style={{ width: size, height: size, fontSize: size * 0.38 }}
      aria-hidden
    >
      {initials(user?.firstName, user?.lastName, user?.primaryEmailAddress?.emailAddress)}
    </span>
  );
}

/**
 * Account button + themed dropdown (replaces Clerk's UserButton so it matches the site).
 * `tone="night"` is for the always-dark sidebar; `placement="up"` opens above the button.
 */
export function AccountMenu({
  tone = "auto",
  placement = "down",
  showName = true,
}: {
  tone?: "auto" | "night";
  placement?: "down" | "up";
  showName?: boolean;
}) {
  const { user } = useUser();
  const { signOut, openUserProfile } = useClerk();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!user) return null;
  const night = tone === "night";
  const name = user.fullName || user.firstName || user.username || "Your account";
  const email = user.primaryEmailAddress?.emailAddress;

  const item =
    "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-left transition-colors " +
    (night ? "text-cream-100 hover:bg-night-700" : "text-ink-700 hover:bg-paper-100 hover:text-ink-900");

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={`group flex items-center gap-2 rounded-full py-1 pl-1 transition-colors ${
          showName ? "pr-2.5" : "pr-1"
        } ${
          night
            ? "hover:bg-night-800"
            : "border border-paper-300 bg-surface/80 hover:border-gold-300 shadow-card"
        }`}
      >
        <Avatar size={30} />
        {showName && (
          <>
            <span className={`hidden sm:block max-w-[7.5rem] truncate text-sm font-medium ${night ? "text-cream-100" : "text-ink-800"}`}>
              {user.firstName || name}
            </span>
            <ChevronDown
              className={`hidden sm:block w-3.5 h-3.5 transition-transform ${open ? "rotate-180" : ""} ${
                night ? "text-night-300" : "text-ink-400"
              }`}
            />
          </>
        )}
      </button>

      {open && (
        <div
          role="menu"
          className={`absolute z-50 w-64 rounded-2xl border p-1.5 pop-in ${
            placement === "up" ? "bottom-full mb-2 left-0" : "top-full mt-2 right-0"
          } ${night ? "bg-night-800 border-night-700 shadow-lift" : "bg-surface border-paper-300 shadow-lift"}`}
        >
          <div className={`flex items-center gap-3 px-3 py-3 mb-1 border-b ${night ? "border-night-700" : "border-paper-200"}`}>
            <Avatar size={38} />
            <div className="min-w-0">
              <p className={`truncate text-sm font-semibold ${night ? "text-cream-50" : "text-ink-900"}`}>{name}</p>
              {email && <p className={`truncate text-xs ${night ? "text-night-300" : "text-ink-500"}`}>{email}</p>}
            </div>
          </div>
          <Link href="/chat" role="menuitem" className={item} onClick={() => setOpen(false)}>
            <MessagesSquare className="w-4 h-4 text-gold-500" /> My questions
          </Link>
          <button
            type="button"
            role="menuitem"
            className={item}
            onClick={() => {
              setOpen(false);
              openUserProfile();
            }}
          >
            <Settings className="w-4 h-4 text-gold-500" /> Manage account
          </button>
          <div className={`my-1 h-px ${night ? "bg-night-700" : "bg-paper-200"}`} />
          <button
            type="button"
            role="menuitem"
            className={`${item} ${night ? "hover:text-rose-300" : "hover:text-rose-700"}`}
            onClick={() => signOut({ redirectUrl: "/" })}
          >
            <LogOut className="w-4 h-4" /> Sign out
          </button>
        </div>
      )}
    </div>
  );
}
