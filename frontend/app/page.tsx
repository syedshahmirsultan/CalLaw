import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  Check,
  FileSearch,
  ListChecks,
  MessageCircleQuestion,
  Printer,
  Quote,
  SearchX,
  ShieldCheck,
  UserRound,
  Sparkles,
} from "lucide-react";
import { CalLawWordmark } from "@/components/brand/CaliforniaLogo";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { NavAuth, HeroCtas } from "@/components/auth/NavAuth";
import { LiveDemo } from "@/components/landing/LiveDemo";
import { StatuteMarquee } from "@/components/landing/StatuteMarquee";
import { SiteFooter } from "@/components/landing/SiteFooter";
import { CountUp, Reveal, RotatingWord, Spotlight } from "@/components/motion/Motion";

const STEPS = [
  {
    n: "01",
    title: "Tell us what happened",
    body: "Write it the way you'd tell a friend. No legal words needed. “My landlord raised the rent without telling me” is perfect.",
  },
  {
    n: "02",
    title: "Answer a few quick questions",
    body: "If a detail changes which law applies (your lease type, a date, an amount), CalLaw asks. Most answers are one tap.",
  },
  {
    n: "03",
    title: "See the law that applies to you",
    body: "A plain-English explanation of your situation, the exact California laws behind it quoted word-for-word, and practical next steps.",
  },
];

const FEATURES = [
  {
    icon: MessageCircleQuestion,
    title: "Asks before it answers",
    body: "Up to three short questions, only the ones that change the answer, with tap-to-answer options.",
  },
  {
    icon: Quote,
    title: "Quotes the actual law",
    body: "Every answer shows the exact words of the statute, checked by the system character-for-character.",
  },
  {
    icon: BadgeCheck,
    title: "Every citation verified, live",
    body: "Each law is fetched from leginfo.legislature.ca.gov when you ask. Made-up citations are thrown out.",
  },
  {
    icon: SearchX,
    title: "Honest when there's no law",
    body: "If no California statute covers it, or it's federal law, CalLaw says so and points you to real help.",
  },
  {
    icon: ListChecks,
    title: "Practical next steps",
    body: "What to ask for in writing, what to keep as evidence, and what could change the answer.",
  },
  {
    icon: Printer,
    title: "Print or save as PDF",
    body: "Take the answer and its official quotes to your landlord, employer, or a legal aid office.",
  },
];

export default function HomePage() {
  return (
    <main className="min-h-screen bg-paper-100 text-ink-900 overflow-x-hidden">
      {/* ── Nav ── */}
      <header className="sticky top-0 z-30 bg-paper-100/80 backdrop-blur-md border-b border-paper-300/60">
        <div className="max-w-6xl mx-auto px-5 sm:px-8 h-16 flex items-center justify-between gap-3">
          <Link href="/" aria-label="CalLaw home" className="flex-shrink-0">
            <CalLawWordmark size={34} />
          </Link>
          {/* Everything else sits on the right: section links, then actions */}
          <div className="flex items-center gap-5 lg:gap-8">
            <nav className="hidden lg:flex items-center gap-8 text-sm text-ink-600">
              <a href="#how" className="hover:text-ink-900 transition-colors">How it works</a>
              <a href="#features" className="hover:text-ink-900 transition-colors">Features</a>
              <a href="#trust" className="hover:text-ink-900 transition-colors">Why trust it</a>
            </nav>
            <span className="hidden lg:block h-6 w-px bg-paper-300" aria-hidden />
            <div className="flex items-center gap-5">
              <div className="hidden sm:block">
                <ThemeToggle compact />
              </div>
              <NavAuth />
            </div>
          </div>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="relative">
        <div className="absolute inset-0 bg-grain opacity-70" aria-hidden />
        <div className="absolute -top-32 right-[-10%] w-[560px] h-[560px] rounded-full bg-gold-100/70 blur-3xl drift" aria-hidden />
        <div
          className="absolute top-72 left-[-15%] w-[420px] h-[420px] rounded-full bg-sage-100/50 blur-3xl drift"
          style={{ animationDelay: "-7s" }}
          aria-hidden
        />
        <div className="relative max-w-6xl mx-auto px-5 sm:px-8 pt-12 pb-16 lg:pt-20 lg:pb-24 grid lg:grid-cols-[1.05fr_1fr] gap-12 lg:gap-14 items-center">
          <div>
            <p className="fade-up inline-flex items-center gap-2 text-xs font-semibold tracking-wide uppercase text-gold-600 bg-gold-50 border border-gold-100 px-3 py-1.5 rounded-full mb-6">
              <span className="relative flex w-2 h-2">
                <span className="absolute inline-flex h-full w-full rounded-full bg-gold-400 opacity-60 animate-ping" />
                <span className="relative inline-flex w-2 h-2 rounded-full bg-gold-400" />
              </span>
              Made for California residents
            </p>
            <h1
              className="fade-up font-display text-[2.5rem] sm:text-[3.4rem] lg:text-[2.75rem] xl:text-[3.2rem] leading-[1.05] tracking-tight font-semibold text-ink-900"
              style={{ animationDelay: "80ms" }}
            >
              Know your rights on
              <br />
              <span className="italic text-gold-500 whitespace-nowrap">
                <RotatingWord
                  words={["your rent.", "your paycheck.", "your deposit.", "an inheritance.", "a car accident."]}
                />
              </span>
            </h1>
            <p className="fade-up mt-6 text-lg text-ink-600 leading-relaxed max-w-xl" style={{ animationDelay: "160ms" }}>
              Describe your situation in your own words. CalLaw asks what it needs to know, then shows you the
              California laws that apply to <em>you</em>, explained simply and quoted from the official text.
            </p>
            <div className="fade-up mt-8" style={{ animationDelay: "240ms" }}>
              <HeroCtas />
            </div>
            <dl className="fade-up mt-10 grid grid-cols-3 max-w-md divide-x divide-paper-300" style={{ animationDelay: "320ms" }}>
              {[
                { n: 29, suffix: "", label: "California codes", approx: false },
                { n: 100, suffix: "%", label: "Quotes checked", approx: false },
                { n: 60, suffix: "s", label: "Typical answer", approx: true },
              ].map((s) => (
                <div key={s.label} className="px-4 first:pl-0">
                  <dt className="sr-only">{s.label}</dt>
                  <dd className="font-display text-3xl font-semibold text-ink-900">
                    {s.approx && <span className="text-lg text-ink-400 mr-0.5">~</span>}
                    <CountUp to={s.n} suffix={s.suffix} />
                  </dd>
                  <p className="text-xs text-ink-500 mt-1">{s.label}</p>
                </div>
              ))}
            </dl>
          </div>

          <div className="fade-up" style={{ animationDelay: "200ms" }}>
            <LiveDemo />
          </div>
        </div>
      </section>

      {/* ── Real laws ticker ── */}
      <section className="py-12 border-y border-paper-300/60 bg-paper-50">
        <Reveal className="max-w-6xl mx-auto px-5 sm:px-8 mb-6 flex flex-col sm:flex-row sm:items-end justify-between gap-2">
          <h2 className="font-display text-2xl font-semibold text-ink-900">Real California law, not guesses.</h2>
          <p className="text-sm text-ink-500">Every section below is live on the official site. Tap one to read it.</p>
        </Reveal>
        <StatuteMarquee />
      </section>

      {/* ── How it works ── */}
      <section id="how" className="scroll-mt-16">
        <div className="max-w-6xl mx-auto px-5 sm:px-8 py-20">
          <Reveal>
            <SectionHeading eyebrow="How it works" title="From “what just happened?” to the exact law, in about a minute." />
          </Reveal>
          <div className="relative mt-14 grid md:grid-cols-3 gap-6">
            <div
              className="hidden md:block absolute top-[3.25rem] left-[16%] right-[16%] h-px bg-gradient-to-r from-transparent via-gold-300 to-transparent"
              aria-hidden
            />
            {STEPS.map((s, i) => (
              <Reveal key={s.n} delay={i * 140}>
                <div className="relative h-full rounded-3xl bg-surface border border-paper-300/70 p-7 shadow-card hover:shadow-lift hover:-translate-y-1 transition-all duration-300">
                  <span className="relative z-10 inline-flex w-12 h-12 items-center justify-center rounded-2xl chip-accent font-display text-lg font-semibold">
                    {s.n}
                  </span>
                  <h3 className="mt-5 font-display text-xl font-semibold text-ink-900">{s.title}</h3>
                  <p className="mt-2 text-[15px] text-ink-600 leading-relaxed">{s.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section id="features" className="scroll-mt-16 bg-paper-50 border-y border-paper-300/60">
        <div className="max-w-6xl mx-auto px-5 sm:px-8 py-20">
          <Reveal>
            <SectionHeading eyebrow="Features" title="Built to be understood, and built to be right." />
          </Reveal>
          <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map(({ icon: Icon, title, body }, i) => (
              <Reveal key={title} delay={(i % 3) * 110}>
                <Spotlight className="group h-full rounded-3xl bg-surface border border-paper-300/70 p-7 shadow-card hover:border-gold-200 transition-colors">
                  <div className="w-11 h-11 rounded-2xl chip-accent flex items-center justify-center transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110">
                    <Icon className="w-5 h-5" />
                  </div>
                  <h3 className="mt-5 font-semibold text-lg text-ink-900">{title}</h3>
                  <p className="mt-2 text-[15px] text-ink-600 leading-relaxed">{body}</p>
                </Spotlight>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── Trust ── */}
      <section id="trust" className="bg-night-900 text-cream-100 scroll-mt-16 relative overflow-hidden dark:border-y dark:border-night-800">
        <div className="absolute -bottom-40 -right-20 w-[480px] h-[480px] rounded-full bg-gold-400/10 blur-3xl drift" aria-hidden />
        <div className="relative max-w-6xl mx-auto px-5 sm:px-8 py-20 grid lg:grid-cols-2 gap-12 items-center">
          <Reveal>
            <p className="text-xs font-semibold tracking-widest uppercase text-gold-300">Why trust it</p>
            <h2 className="mt-3 font-display text-4xl font-semibold leading-tight">
              It shows its work, so you never have to take its word for it.
            </h2>
            <p className="mt-5 text-night-200 leading-relaxed">
              AI can sound confident and still be wrong. CalLaw is designed so it can&apos;t make up the law: it only
              explains statutes it has just retrieved from the Legislature&apos;s official website, and every quote and
              citation is checked by code before you see it.
            </p>
          </Reveal>
          <ol className="space-y-3">
            {[
              { icon: FileSearch, t: "Proposes the laws that may apply", d: "Across all 29 California codes and the Constitution." },
              { icon: ShieldCheck, t: "Verifies each one on leginfo.legislature.ca.gov", d: "Citations that don't exist are rejected." },
              { icon: Quote, t: "Explains using only the verified text", d: "Quotes must match the official wording exactly." },
              { icon: SearchX, t: "Says so when there's no law", d: "And points you to self-help centers and legal aid." },
            ].map(({ icon: Icon, t, d }, i) => (
              <Reveal as="li" key={t} delay={i * 120}>
                <div className="group flex gap-4 rounded-2xl bg-night-800/70 border border-night-700 p-5 hover:border-gold-400/40 hover:bg-night-800 transition-colors">
                  <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-gold-400/15 text-gold-300 flex items-center justify-center transition-transform group-hover:scale-110">
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="font-semibold text-cream-50">
                      <span className="text-gold-300 mr-2">{i + 1}.</span>
                      {t}
                    </p>
                    <p className="text-sm text-night-300 mt-1">{d}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </ol>
        </div>
      </section>

      {/* ── Guest vs account ── */}
      <section id="account" className="scroll-mt-16">
        <div className="max-w-5xl mx-auto px-5 sm:px-8 py-20">
          <Reveal className="text-center">
            <SectionHeading eyebrow="Free to use" title="Try one question now. Keep going with a free account." center />
          </Reveal>
          <div className="mt-12 grid md:grid-cols-2 gap-5">
            <Reveal>
              <div className="h-full rounded-3xl bg-surface border border-paper-300/70 p-7 shadow-card">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-paper-100 text-ink-500 flex items-center justify-center">
                    <UserRound className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg text-ink-900">As a guest</h3>
                    <p className="text-sm text-ink-500">No sign-up needed</p>
                  </div>
                </div>
                <ul className="mt-6 space-y-3 text-[15px] text-ink-700">
                  {["Ask one question", "See the laws that apply, quoted", "Try the whole experience"].map((t) => (
                    <li key={t} className="flex items-center gap-2.5">
                      <Check className="w-4 h-4 text-sage-500 flex-shrink-0" /> {t}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/chat"
                  className="mt-7 inline-flex items-center gap-1.5 text-sm font-semibold text-ink-900 hover:text-gold-600 transition-colors group"
                >
                  Ask a question <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                </Link>
              </div>
            </Reveal>
            <Reveal delay={120}>
              <div className="relative h-full rounded-3xl bg-surface border-2 border-gold-300 p-7 shadow-lift overflow-hidden">
                <div className="absolute -top-16 -right-16 w-48 h-48 rounded-full bg-gold-100 blur-2xl drift" aria-hidden />
                <span className="absolute top-5 right-5 inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide chip-accent px-2.5 py-1 rounded-full">
                  <Sparkles className="w-3 h-3" /> Recommended
                </span>
                <div className="relative flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl chip-accent flex items-center justify-center">
                    <BadgeCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg text-ink-900">Free account</h3>
                    <p className="text-sm text-ink-500">Takes 30 seconds</p>
                  </div>
                </div>
                <ul className="relative mt-6 space-y-3 text-[15px] text-ink-700">
                  {[
                    "Unlimited questions and follow-ups",
                    "Answer clarifying questions for a precise answer",
                    "Your history saved privately",
                    "Your guest question comes with you",
                  ].map((t) => (
                    <li key={t} className="flex items-center gap-2.5">
                      <Check className="w-4 h-4 text-sage-500 flex-shrink-0" /> {t}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/sign-up"
                  className="relative mt-7 btn-primary group inline-flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold shadow-card"
                >
                  Create free account <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                </Link>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="border-t border-paper-300/60 bg-paper-50">
        <Reveal className="max-w-4xl mx-auto px-5 sm:px-8 py-20 text-center">
          <h2 className="font-display text-4xl sm:text-5xl font-semibold tracking-tight text-ink-900">
            What&apos;s going on? <span className="italic text-gold-500">Let&apos;s look it up.</span>
          </h2>
          <p className="mt-4 text-ink-600 text-lg">It takes a minute, and you don&apos;t need to know any legal terms.</p>
          <Link
            href="/chat"
            className="mt-8 btn-primary group inline-flex items-center gap-2 px-7 py-4 rounded-2xl font-semibold shadow-lift transition-transform hover:-translate-y-0.5"
          >
            Describe your situation <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
          </Link>
        </Reveal>
      </section>

      <SiteFooter />
    </main>
  );
}

function SectionHeading({ eyebrow, title, center = false }: { eyebrow: string; title: string; center?: boolean }) {
  return (
    <div className={`max-w-2xl ${center ? "mx-auto" : ""}`}>
      <p className="text-xs font-semibold tracking-widest uppercase text-gold-500">{eyebrow}</p>
      <h2 className="mt-3 font-display text-3xl sm:text-4xl font-semibold tracking-tight text-ink-900 leading-tight">
        {title}
      </h2>
    </div>
  );
}
