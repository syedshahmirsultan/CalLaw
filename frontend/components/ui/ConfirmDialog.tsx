"use client";

import React, { useEffect, useRef } from "react";
import { Loader2, Trash2 } from "lucide-react";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Destructive actions get a red confirm button and trash icon */
  tone?: "danger" | "default";
  busy?: boolean;
  error?: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Accessible, themed replacement for window.confirm(). */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  tone = "default",
  busy = false,
  error,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    // Focus the safe choice first; Esc closes.
    cancelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, busy, onCancel]);

  if (!open) return null;

  const danger = tone === "danger";
  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-night-950/55 backdrop-blur-sm fade-up"
        style={{ animationDuration: "0.15s" }}
        onClick={() => !busy && onCancel()}
        aria-hidden
      />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-desc"
        className="relative w-full max-w-sm bg-surface border border-paper-300 rounded-3xl shadow-lift p-6 fade-up"
      >
        <div
          className={`w-11 h-11 rounded-2xl flex items-center justify-center mb-4 ${
            danger ? "bg-rose-50 text-rose-600 dark:bg-rose-950/50 dark:text-rose-300" : "chip-accent"
          }`}
        >
          <Trash2 className="w-5 h-5" />
        </div>
        <h2 id="confirm-title" className="font-display text-xl font-semibold text-ink-900">
          {title}
        </h2>
        {description && (
          <div id="confirm-desc" className="mt-2 text-sm text-ink-500 leading-relaxed">
            {description}
          </div>
        )}
        {error && (
          <p className="mt-3 text-sm text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded-xl px-3 py-2">
            {error}
          </p>
        )}
        <div className="mt-6 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="px-4 py-2.5 rounded-xl text-sm font-semibold text-ink-700 bg-paper-100 hover:bg-paper-200 border border-paper-300 transition-colors disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className={`inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors disabled:opacity-70 ${
              danger ? "bg-rose-600 hover:bg-rose-700 text-white" : "btn-primary"
            }`}
          >
            {busy && <Loader2 className="w-4 h-4 animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
