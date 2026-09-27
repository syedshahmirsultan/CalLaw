"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { ChatInput } from "@/components/chat/ChatInput";
import { api, isSignupRequired } from "@/lib/api";
import { useChatAuth } from "@/lib/chatAuth";
import { Spotlight } from "@/components/motion/Motion";
import { useSafeAuthToken } from "@/lib/useAuthToken";
import { PENDING_MESSAGE_KEY } from "@/lib/utils";
import { Home, Briefcase, Car, ShoppingBag, Users, HeartHandshake, ShieldCheck, Sparkles } from "lucide-react";
import Link from "next/link";
import { CaliforniaLogo } from "@/components/brand/CaliforniaLogo";

const SUGGESTIONS = [
  {
    icon: Home,
    title: "Housing",
    prompt: "I rented this apartment 8 months ago. Now my landlord is increasing the rent without any notice.",
  },
  {
    icon: Briefcase,
    title: "Work & pay",
    prompt: "I was fired last Friday and my boss says my final paycheck will come with the next regular payday.",
  },
  {
    icon: ShoppingBag,
    title: "Deposits",
    prompt: "I moved out 5 weeks ago and my landlord still hasn't returned my $2,000 security deposit or explained why.",
  },
  {
    icon: Car,
    title: "Traffic",
    prompt: "Someone hit my parked car and drove off. I have a photo of their license plate. What are they required to do?",
  },
  {
    icon: Users,
    title: "Family inheritance",
    prompt: "My father passed away without a will. He owned a house in Fresno. How is it divided between my mother, my sister, and me?",
  },
  {
    icon: HeartHandshake,
    title: "Elderly parent",
    prompt: "I think my grandmother's caregiver has been taking money from her bank account. What can our family do?",
  },
];

const TYPED_EXAMPLES = [
  "My landlord kept my deposit and won't say why…",
  "I was fired and haven't gotten my last paycheck…",
  "Someone hit my parked car and drove away…",
  "My dad passed away without a will…",
];

export default function NewChatPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chipText, setChipText] = useState<string | undefined>(undefined);
  const router = useRouter();
  const getToken = useSafeAuthToken();
  const { isGuest, guestUsedFreeQuestion, openSignupGate } = useChatAuth();

  const handleStartInquiry = async (content: string) => {
    if (!content.trim() || isLoading) return;
    if (guestUsedFreeQuestion) {
      setChipText(content);
      openSignupGate();
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const token = await getToken();
      const conv = await api.createConversation({ initial_message: content }, token);
      try {
        sessionStorage.setItem(PENDING_MESSAGE_KEY(conv.id), content);
      } catch {
        /* storage unavailable: the conversation page will simply open empty */
      }
      router.push(`/chat/${conv.id}`);
    } catch (err) {
      setIsLoading(false);
      if (isSignupRequired(err)) {
        setChipText(content);
        openSignupGate();
        return;
      }
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-y-auto bg-paper-100 relative">
      <div className="absolute inset-0 bg-grain opacity-60 pointer-events-none" aria-hidden />
      <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[640px] h-[420px] rounded-full bg-gold-100/60 blur-3xl drift pointer-events-none" aria-hidden />
      <div className="relative flex-1 flex flex-col items-center justify-center px-4 sm:px-6 py-10 max-w-3xl w-full mx-auto">
        <div className="pop-in">
          <CaliforniaLogo size={60} animated className="shadow-lift rounded-2xl" />
        </div>

        <h1
          className="mt-6 font-display text-4xl sm:text-5xl font-semibold tracking-tight text-ink-900 text-center leading-tight fade-up"
          style={{ animationDelay: "80ms" }}
        >
          What&apos;s going on?
        </h1>
        <p className="mt-4 text-[16px] text-ink-600 max-w-xl text-center leading-relaxed fade-up" style={{ animationDelay: "160ms" }}>
          Tell me what happened in your own words. I&apos;ll ask a couple of quick questions if I need to, then
          show you exactly which California laws apply, quoted from the official text.
        </p>

        <div className="w-full mt-8 fade-up" style={{ animationDelay: "240ms" }}>
          <ChatInput
            onSendMessage={handleStartInquiry}
            isLoading={isLoading}
            placeholder="Describe what happened…"
            rotatingPlaceholders={TYPED_EXAMPLES}
            initialValue={chipText}
            onInitialValueConsumed={() => setChipText(undefined)}
          />
          {error && (
            <p className="mt-3 text-sm text-rose-800 dark:text-rose-200 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded-xl px-4 py-2.5">
              {error}
            </p>
          )}
          {isGuest ? (
            <div className="mt-3 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-xs text-ink-500">
              <Sparkles className="w-3.5 h-3.5 text-gold-500" />
              {guestUsedFreeQuestion ? (
                <span>You&apos;ve used your free question.</span>
              ) : (
                <span>Your first question is free, no account needed.</span>
              )}
              <Link href="/sign-up?redirect_url=/chat" className="font-semibold text-ink-800 underline decoration-gold-300 decoration-2 underline-offset-2 hover:text-gold-600">
                Sign up free
              </Link>
              <span>for unlimited questions.</span>
            </div>
          ) : (
            <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-ink-400">
              <ShieldCheck className="w-3.5 h-3.5 text-sage-500" />
              Every citation is verified live on leginfo.legislature.ca.gov
            </p>
          )}
        </div>

        <div className="w-full mt-12">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-ink-400 mb-3 text-center fade-up" style={{ animationDelay: "320ms" }}>
            Not sure how to start? Try one of these
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {SUGGESTIONS.map((item, i) => {
              const Icon = item.icon;
              return (
                <div key={item.title} className="fade-up" style={{ animationDelay: `${380 + i * 70}ms` }}>
                  <Spotlight className="h-full rounded-2xl">
                    <button
                      onClick={() => setChipText(item.prompt)}
                      disabled={isLoading}
                      className="group w-full h-full p-4 rounded-2xl border border-paper-300 bg-surface/90 hover:border-gold-300 hover:shadow-lift hover:-translate-y-0.5 transition-all flex items-start gap-3 text-left active:scale-[0.99]"
                    >
                      <div className="p-2 rounded-xl bg-paper-100 text-gold-500 group-hover:bg-gold-400 group-hover:text-night-900 group-hover:-rotate-6 transition-all flex-shrink-0">
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-sm font-semibold text-ink-900 mb-0.5">{item.title}</h4>
                        <p className="text-[13px] text-ink-500 line-clamp-2 leading-relaxed">{item.prompt}</p>
                      </div>
                    </button>
                  </Spotlight>
                </div>
              );
            })}
          </div>
        </div>

        <p className="text-xs text-ink-400 mt-10 max-w-md text-center leading-relaxed">
          CalLaw explains California state law. It&apos;s legal information, not legal advice, and not a substitute
          for a lawyer.
        </p>
      </div>
    </div>
  );
}
