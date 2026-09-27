"use client";

import React, { useState, useRef, useEffect } from "react";
import { ArrowUp } from "lucide-react";

interface ChatInputProps {
  onSendMessage: (content: string) => void;
  isLoading: boolean;
  placeholder?: string;
  /** When set, populates the textarea without sending (for suggestion chips) */
  initialValue?: string;
  /** Called after the initialValue has been consumed so parent can reset it */
  onInitialValueConsumed?: () => void;
  /** Placeholder examples that type themselves out in a loop while the box is empty */
  rotatingPlaceholders?: string[];
}

/** Types each example out, pauses, erases, and moves to the next. */
function useTypedPlaceholder(examples: string[] | undefined, active: boolean): string | null {
  const [text, setText] = useState("");
  useEffect(() => {
    if (!examples?.length || !active) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setText(examples[0]);
      return;
    }
    let i = 0;
    let pos = 0;
    let deleting = false;
    let timer: ReturnType<typeof setTimeout>;
    const step = () => {
      const target = examples[i];
      if (!deleting) {
        pos++;
        setText(target.slice(0, pos));
        if (pos >= target.length) {
          deleting = true;
          timer = setTimeout(step, 2200);
          return;
        }
        timer = setTimeout(step, 38);
      } else {
        pos -= 3;
        setText(target.slice(0, Math.max(0, pos)));
        if (pos <= 0) {
          deleting = false;
          pos = 0;
          i = (i + 1) % examples.length;
          timer = setTimeout(step, 350);
          return;
        }
        timer = setTimeout(step, 14);
      }
    };
    timer = setTimeout(step, 600);
    return () => clearTimeout(timer);
  }, [examples, active]);
  return examples?.length ? text : null;
}

export function ChatInput({
  onSendMessage,
  isLoading,
  placeholder = "Describe your California legal situation...",
  initialValue,
  onInitialValueConsumed,
  rotatingPlaceholders,
}: ChatInputProps) {
  const [content, setContent] = useState("");
  const [focused, setFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const typed = useTypedPlaceholder(rotatingPlaceholders, !content && !focused);

  // When a chip sets initialValue, populate and focus, do NOT send
  useEffect(() => {
    if (initialValue !== undefined && initialValue !== "") {
      setContent(initialValue);
      onInitialValueConsumed?.();
      // Focus and place cursor at end
      setTimeout(() => {
        const el = textareaRef.current;
        if (el) {
          el.focus();
          el.setSelectionRange(el.value.length, el.value.length);
        }
      }, 50);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialValue]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [content]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || isLoading) return;
    onSendMessage(content.trim());
    setContent("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="relative flex items-end gap-2 bg-surface border border-paper-300 rounded-2xl p-2.5 pl-4 shadow-card focus-within:border-gold-300 focus-within:shadow-lift focus-within:ring-4 focus-within:ring-gold-100/70 transition-all duration-150"
    >
      <textarea
        ref={textareaRef}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={typed !== null && !focused ? typed || " " : placeholder}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        disabled={isLoading}
        rows={1}
        aria-label="Your message"
        className="w-full resize-none border-0 bg-transparent py-2 text-[15px] text-ink-900 placeholder:text-ink-300 focus:outline-none focus:ring-0 disabled:opacity-50 max-h-52 min-h-[40px] leading-relaxed"
      />

      <button
        type="submit"
        disabled={!content.trim() || isLoading}
        className="group h-10 w-10 rounded-xl btn-primary transition-all duration-150 flex-shrink-0 flex items-center justify-center active:scale-90 enabled:hover:-translate-y-0.5"
        aria-label="Send message"
      >
        <ArrowUp className="w-5 h-5 transition-transform group-enabled:group-hover:-translate-y-0.5" />
      </button>
    </form>
  );
}
