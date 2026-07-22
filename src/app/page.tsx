import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import {
  WalletIcon,
  SparklesIcon,
  ListChecksIcon,
  ArrowRightIcon,
  CheckIcon,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Life OS — your whole life, in one calm place",
  description:
    "Money, habits, mood, tasks, and your calendar together at last. A warm, low-friction personal operating system for a calmer everyday.",
};

/**
 * Stock imagery (Unsplash, warm-toned to match the palette). Swap the URLs for
 * your own branded photos anytime — hosts are allow-listed in next.config.ts.
 */
const IMAGES = {
  hero: "https://images.unsplash.com/photo-1499750310107-5fef28a66643?w=1200&q=80&auto=format&fit=crop",
  money:
    "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=1000&q=80&auto=format&fit=crop",
  habits:
    "https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=1000&q=80&auto=format&fit=crop",
  plan: "https://images.unsplash.com/photo-1484480974693-6ca0a78fb36b?w=1000&q=80&auto=format&fit=crop",
};

export default async function LandingPage() {
  // Signed-in visitors skip the marketing page.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/home");

  return (
    <div className="min-h-dvh bg-background text-foreground">
      {/* Nav */}
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-3">
          <Link href="/" className="flex items-center gap-2">
            <span className="grid size-9 place-items-center rounded-xl bg-brand text-primary-foreground shadow-soft">
              <span className="font-display text-lg leading-none">L</span>
            </span>
            <span className="font-display text-lg tracking-tight">Life OS</span>
          </Link>
          <nav className="hidden items-center gap-7 text-sm text-muted-foreground sm:flex">
            <a href="#features" className="transition-colors hover:text-foreground">
              Features
            </a>
            <a href="#how" className="transition-colors hover:text-foreground">
              How it works
            </a>
          </nav>
          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className="rounded-full px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
            >
              Sign in
            </Link>
            <Link
              href="/signup"
              className="rounded-full bg-brand px-4 py-2 text-sm font-medium text-primary-foreground shadow-soft transition-colors hover:bg-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              Get started
            </Link>
          </div>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="mx-auto grid max-w-6xl items-center gap-12 px-5 py-14 lg:grid-cols-[1.05fr_0.95fr] lg:py-20">
          <div>
            <p className="mb-4 inline-flex items-center gap-2 rounded-full bg-sage-soft px-3 py-1 text-xs font-medium uppercase tracking-wider text-sage">
              <SparklesIcon className="size-3.5" /> Your personal life OS
            </p>
            <h1 className="font-display text-5xl leading-[1.02] tracking-tight sm:text-6xl lg:text-7xl">
              Your whole life, in one{" "}
              <span className="text-brand">calm</span> place.
            </h1>
            <p className="mt-6 max-w-md text-lg leading-relaxed text-muted-foreground">
              Money, habits, mood, tasks, and your calendar — together at last.
              Open the app and know exactly how your day and your money are
              doing.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                href="/signup"
                className="inline-flex items-center gap-2 rounded-full bg-brand px-6 py-3 text-base font-medium text-primary-foreground shadow-card transition-all hover:-translate-y-0.5 hover:bg-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                Get started — it&apos;s free <ArrowRightIcon className="size-4" />
              </Link>
              <Link
                href="/login"
                className="inline-flex items-center gap-2 rounded-full border border-border px-6 py-3 text-base font-medium transition-colors hover:bg-secondary"
              >
                Sign in
              </Link>
            </div>
            <p className="mt-5 text-sm text-muted-foreground">
              No spreadsheets. No clutter. Just clarity.
            </p>
          </div>

          {/* Hero visual: arch-topped photo + floating stat card */}
          <div className="relative">
            <div className="relative aspect-[4/5] overflow-hidden rounded-[2rem] rounded-t-[7rem] border border-border shadow-lifted">
              <Image
                src={IMAGES.hero}
                alt="A calm desk with coffee and a notepad by a window"
                fill
                priority
                sizes="(max-width: 1024px) 90vw, 45vw"
                className="object-cover"
              />
              <div
                className="absolute inset-0"
                style={{
                  background:
                    "linear-gradient(160deg, color-mix(in srgb, var(--brand) 32%, transparent), transparent 55%), linear-gradient(0deg, color-mix(in srgb, var(--sage) 26%, transparent), transparent 45%)",
                }}
              />
            </div>
            <div className="absolute -bottom-5 -left-4 w-52 rounded-2xl border border-border bg-card p-4 shadow-lifted sm:-left-6">
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Net position
              </p>
              <p className="tnum font-display text-2xl">₱74,080</p>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-secondary">
                <div className="h-full w-3/4 rounded-full bg-sage" />
              </div>
              <p className="mt-1.5 text-[11px] text-muted-foreground">
                Cash + owed − you owe
              </p>
            </div>
          </div>
        </section>

        {/* Feature ribbon */}
        <section
          id="features"
          className="border-y border-border/60 bg-secondary/40"
        >
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-6 gap-y-2 px-5 py-5 text-sm font-medium text-muted-foreground">
            {["Money", "Budgets", "Bills", "Habits", "Mood", "Tasks", "Calendar", "Reports"].map(
              (f) => (
                <span key={f} className="flex items-center gap-2">
                  <span className="size-1.5 rounded-full bg-brand/60" />
                  {f}
                </span>
              ),
            )}
          </div>
        </section>

        {/* Benefit sections */}
        <div className="mx-auto max-w-6xl space-y-24 px-5 py-20">
          <Benefit
            icon={<WalletIcon className="size-5" />}
            eyebrow="Money"
            title="Know your true position at a glance"
            body="Every account, what you're owed, and what you owe — combined into one honest number. Log an expense in three taps, set budgets, and never miss a bill again."
            points={[
              "Live account balances, no manual math",
              "Receivables & payables in one place",
              "Budgets and gentle bill reminders",
            ]}
            image={IMAGES.money}
            imageAlt="Two people reviewing plans and finances at a desk"
          />
          <Benefit
            reverse
            icon={<SparklesIcon className="size-5" />}
            eyebrow="Habits & mood"
            title="Build momentum, gently"
            body="Tap to check off habits and watch your streaks grow. A five-second mood check-in each day quietly becomes a picture of how you're really doing."
            points={[
              "Streaks that forgive intentional rest days",
              "Balance across every area of life",
              "Mood, energy & stress trends over time",
            ]}
            image={IMAGES.habits}
            imageAlt="A person meditating outdoors at golden hour"
          />
          <Benefit
            icon={<ListChecksIcon className="size-5" />}
            eyebrow="Tasks & calendar"
            title="Focus on what matters today"
            body="Pick your top three priorities, let the rest wait in the backlog, and see events, deadlines, bills, and scheduled habits together in one unified calendar."
            points={[
              "A daily top-3 that keeps you focused",
              "Gentle carry-over for unfinished tasks",
              "One calendar for everything",
            ]}
            image={IMAGES.plan}
            imageAlt="A hand writing a checklist in a notebook"
          />
        </div>

        {/* How it works */}
        <section id="how" className="border-t border-border/60 bg-secondary/40">
          <div className="mx-auto max-w-6xl px-5 py-20">
            <h2 className="text-center font-display text-3xl tracking-tight sm:text-4xl">
              Up and running in two minutes
            </h2>
            <div className="mt-12 grid gap-8 sm:grid-cols-3">
              {[
                {
                  n: "1",
                  t: "Create your account",
                  d: "Sign up with email or Google in seconds — nothing to install.",
                },
                {
                  n: "2",
                  t: "Add accounts & habits",
                  d: "A quick, friendly setup gives you a working dashboard right away.",
                },
                {
                  n: "3",
                  t: "Open it daily",
                  d: "Capture in three taps and see your whole life at a glance.",
                },
              ].map((s) => (
                <div key={s.n} className="text-center">
                  <span className="mx-auto grid size-12 place-items-center rounded-full bg-brand font-display text-xl text-primary-foreground shadow-soft">
                    {s.n}
                  </span>
                  <h3 className="mt-4 font-display text-xl">{s.t}</h3>
                  <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-muted-foreground">
                    {s.d}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="mx-auto max-w-6xl px-5 py-20">
          <div className="overflow-hidden rounded-[2rem] border border-border bg-card px-6 py-14 text-center shadow-card sm:px-16">
            <h2 className="mx-auto max-w-2xl font-display text-4xl leading-tight tracking-tight sm:text-5xl">
              Ready for a calmer everyday?
            </h2>
            <p className="mx-auto mt-4 max-w-md text-muted-foreground">
              Bring your money, habits, and days into one warm, simple place.
            </p>
            <Link
              href="/signup"
              className="mt-8 inline-flex items-center gap-2 rounded-full bg-brand px-7 py-3.5 text-base font-medium text-primary-foreground shadow-card transition-all hover:-translate-y-0.5 hover:bg-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              Get started — it&apos;s free <ArrowRightIcon className="size-4" />
            </Link>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-border/60">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-5 py-8 text-sm text-muted-foreground sm:flex-row">
          <div className="flex items-center gap-2">
            <span className="grid size-7 place-items-center rounded-lg bg-brand text-primary-foreground">
              <span className="font-display text-sm leading-none">L</span>
            </span>
            <span className="font-medium text-foreground">Life OS</span>
          </div>
          <p>Your whole life, in one calm place.</p>
          <p>© {new Date().getFullYear()} Life OS</p>
        </div>
      </footer>
    </div>
  );
}

function Benefit({
  icon,
  eyebrow,
  title,
  body,
  points,
  image,
  imageAlt,
  reverse = false,
}: {
  icon: React.ReactNode;
  eyebrow: string;
  title: string;
  body: string;
  points: string[];
  image: string;
  imageAlt: string;
  reverse?: boolean;
}) {
  return (
    <section className="grid items-center gap-10 lg:grid-cols-2">
      <div className={reverse ? "lg:order-2" : ""}>
        <p className="mb-3 inline-flex items-center gap-2 rounded-full bg-secondary px-3 py-1 text-xs font-medium uppercase tracking-wider text-brand">
          {icon}
          {eyebrow}
        </p>
        <h2 className="font-display text-3xl leading-tight tracking-tight sm:text-4xl">
          {title}
        </h2>
        <p className="mt-4 max-w-md text-lg leading-relaxed text-muted-foreground">
          {body}
        </p>
        <ul className="mt-6 space-y-3">
          {points.map((p) => (
            <li key={p} className="flex items-start gap-3 text-[15px]">
              <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-success/15 text-success">
                <CheckIcon className="size-3.5" />
              </span>
              {p}
            </li>
          ))}
        </ul>
      </div>
      <div className={reverse ? "lg:order-1" : ""}>
        <div
          className={`relative aspect-[5/4] overflow-hidden border border-border shadow-card ${
            reverse
              ? "rounded-[2rem] rounded-tr-[6rem]"
              : "rounded-[2rem] rounded-tl-[6rem]"
          }`}
        >
          <Image
            src={image}
            alt={imageAlt}
            fill
            sizes="(max-width: 1024px) 90vw, 45vw"
            className="object-cover"
          />
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(180deg, transparent 55%, color-mix(in srgb, var(--brand) 18%, transparent))",
            }}
          />
        </div>
      </div>
    </section>
  );
}
