import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import {
  WalletIcon,
  SparklesIcon,
  ArrowRightIcon,
  CheckIcon,
  ShieldCheckIcon,
  SmartphoneIcon,
  PiggyBankIcon,
  ReceiptTextIcon,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getSiteURL } from "@/lib/site";
import { resolveLifetimeOffer } from "@/lib/offer";
import { MarketingHeader } from "@/components/marketing/marketing-header";
import { MarketingFooter } from "@/components/marketing/marketing-footer";
import { PricingCards } from "@/components/marketing/pricing-cards";
import { LifetimeCard } from "@/components/marketing/lifetime-card";
import { LifetimePopup } from "@/components/marketing/lifetime-popup";
import { StickyCta } from "@/components/marketing/sticky-cta";
import { ProductProof } from "@/components/marketing/product-proof";

export const metadata: Metadata = {
  title: "Money + habits in one place — Finance & Habit Tracker",
  description:
    "Know where your money goes and build habits that keep you on track. Plan your monthly budget, track spending, savings, bills, accounts and daily habits in one simple workspace — on your phone or desktop.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "Money + habits in one place — Finance & Habit Tracker",
    description:
      "One system for what you spend and what you repeat. Budget, spending, savings, bills, accounts and habits together.",
    type: "website",
  },
};

/** Real testimonials go here once collected + consented. Empty = the section
 *  is hidden and product proof stands in — never seeded with fake names (§12). */
const TESTIMONIALS: { name: string; role: string; quote: string }[] = [];

type SP = { [k: string]: string | string[] | undefined };

function utmQuery(sp: SP): string {
  const utm = new URLSearchParams();
  for (const k of [
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_content",
    "utm_term",
  ]) {
    const v = sp[k];
    if (typeof v === "string" && v) utm.set(k, v);
  }
  return utm.toString();
}

export default async function LandingPage({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  // Signed-in visitors skip the marketing page.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/home");

  const [sp, offer] = await Promise.all([searchParams, resolveLifetimeOffer()]);

  // Carry marketing attribution through to signup so it survives the funnel.
  const qs = utmQuery(sp);
  const freeHref = qs ? `/signup?${qs}` : "/signup";
  const paid = new URLSearchParams(qs);
  paid.set("next", "/subscription");
  const lifetimeHref = `/signup?${paid.toString()}`;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Finance & Habit Tracker",
    applicationCategory: "FinanceApplication",
    operatingSystem: "Web, iOS, Android (PWA)",
    url: getSiteURL(),
    offers: [
      { "@type": "Offer", price: "0", priceCurrency: "USD", name: "Free" },
      {
        "@type": "Offer",
        price: String(offer.priceUSD),
        priceCurrency: "USD",
        name: "Premium Lifetime",
      },
    ],
  };

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <MarketingHeader startHref={freeHref} />

      <main>
        {/* 1 · HERO */}
        <section className="mx-auto grid max-w-6xl items-center gap-10 px-5 py-14 lg:grid-cols-[1fr_1fr] lg:py-20">
          <div>
            <p className="mb-4 inline-flex items-center gap-2 rounded-full bg-sage-soft px-3 py-1 text-xs font-medium uppercase tracking-wider text-sage">
              <SparklesIcon className="size-3.5" /> Money + habits in one place
            </p>
            <h1 className="font-display text-4xl leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
              Know where your money goes.
              <br />
              <span className="text-brand">Build habits</span> that keep you on
              track.
            </h1>
            <p className="mt-6 max-w-md text-lg leading-relaxed text-muted-foreground">
              Plan your monthly budget and track spending, savings, bills,
              accounts and daily habits in one simple workspace — on your phone
              or desktop.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                href={freeHref}
                className="inline-flex items-center gap-2 rounded-full bg-brand px-6 py-3 text-base font-medium text-brand-foreground shadow-card transition-all hover:-translate-y-0.5 hover:bg-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                Start Free <ArrowRightIcon className="size-4" />
              </Link>
              <Link
                href="/#how"
                className="inline-flex items-center gap-2 rounded-full border border-border px-6 py-3 text-base font-medium transition-colors hover:bg-secondary"
              >
                See How It Works
              </Link>
            </div>
            <p className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <CheckIcon className="size-4 text-success" /> No credit card
                required
              </span>
              <span className="inline-flex items-center gap-1.5">
                <SmartphoneIcon className="size-4 text-success" /> Installable on
                phone &amp; desktop
              </span>
            </p>
          </div>

          {/* Hero visual = the real product, from sample data */}
          <ProductProof />
        </section>

        {/* 2 · IMMEDIATE PRODUCT PROOF — capability ribbon */}
        <section
          id="features"
          className="border-y border-border/60 bg-secondary/40"
        >
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-5 gap-y-2 px-5 py-5 text-sm font-medium text-muted-foreground">
            {[
              "Monthly Budget",
              "Budget vs Actual",
              "Income & Expenses",
              "Savings Goals",
              "Accounts",
              "Bills",
              "Habit Tracker",
              "Reports",
            ].map((f) => (
              <span key={f} className="flex items-center gap-2">
                <span className="size-1.5 rounded-full bg-brand/60" />
                {f}
              </span>
            ))}
          </div>
        </section>

        {/* 3 · THE PROBLEM */}
        <section className="mx-auto max-w-3xl px-5 py-20 text-center">
          <h2 className="font-display text-3xl leading-tight tracking-tight sm:text-4xl">
            Your money is in one place.
            <br />
            Your habits are somewhere else.
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-muted-foreground">
            You track expenses in one app, goals somewhere else, and habits in
            another. It gets harder to see what is actually helping you move
            forward. Finance &amp; Habit Tracker brings them together in one
            clear workspace.
          </p>
        </section>

        {/* 4 · CORE USP */}
        <section className="border-y border-border/60 bg-secondary/40">
          <div className="mx-auto max-w-4xl px-5 py-20 text-center">
            <p className="mb-3 text-xs font-medium uppercase tracking-wider text-brand">
              The difference
            </p>
            <h2 className="font-display text-3xl leading-tight tracking-tight sm:text-4xl">
              One system for what you spend and what you repeat.
            </h2>
            <p className="mx-auto mt-5 max-w-xl text-muted-foreground">
              A budget tells you where your money should go. Your transactions
              show where it actually went. Your habits show what you keep doing
              every day. Here you see all three.
            </p>
            <div className="mt-10 flex flex-wrap items-center justify-center gap-3 text-sm font-medium">
              {["Plan", "Track", "Build", "Review"].map((s, i) => (
                <span key={s} className="flex items-center gap-3">
                  <span className="rounded-full border border-border bg-card px-4 py-2 shadow-soft">
                    {s}
                  </span>
                  {i < 3 && (
                    <ArrowRightIcon className="size-4 text-muted-foreground" />
                  )}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* 5 · KEY BENEFITS */}
        <div className="mx-auto max-w-5xl space-y-6 px-5 py-20">
          <div className="grid gap-4 sm:grid-cols-2">
            <Benefit
              icon={<WalletIcon className="size-5" />}
              title="See your month clearly"
              body="Create a monthly budget and compare what you planned with what you actually spent — remaining, over budget, and budget used, at a glance."
            />
            <Benefit
              icon={<ReceiptTextIcon className="size-5" />}
              title="Record money fast"
              body="Log income and expenses in a few taps, with quick category entry, so tracking never becomes a chore."
            />
            <Benefit
              icon={<PiggyBankIcon className="size-5" />}
              title="Know what you have and owe"
              body="Track your accounts, e-wallets, cash and savings, plus who owes you and who you owe — added and reconciled by you, no bank linking."
            />
            <Benefit
              icon={<SparklesIcon className="size-5" />}
              title="Build better daily habits"
              body="Track habits right beside your financial activity instead of keeping yet another separate app open."
            />
          </div>
          <div className="rounded-2xl border border-border bg-card p-6 text-center shadow-soft">
            <SmartphoneIcon className="mx-auto size-6 text-brand" />
            <h3 className="mt-3 font-display text-xl">Use it where you are</h3>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
              A responsive web app you can install (PWA) and use from your
              phone, tablet or desktop — add it to your home screen and it works
              like a native app.
            </p>
          </div>
        </div>

        {/* 6 · HOW IT WORKS */}
        <section id="how" className="border-t border-border/60 bg-secondary/40">
          <div className="mx-auto max-w-6xl px-5 py-20">
            <h2 className="text-center font-display text-3xl tracking-tight sm:text-4xl">
              Three simple steps
            </h2>
            <div className="mt-12 grid gap-8 sm:grid-cols-3">
              {[
                {
                  n: "1",
                  t: "Plan",
                  d: "Set your budget, accounts, goals and habits.",
                },
                {
                  n: "2",
                  t: "Track",
                  d: "Record what you earn, spend, save and complete.",
                },
                {
                  n: "3",
                  t: "Review",
                  d: "See your progress and make better decisions next month.",
                },
              ].map((s) => (
                <div key={s.n} className="text-center">
                  <span className="mx-auto grid size-12 place-items-center rounded-full bg-brand font-display text-xl text-brand-foreground shadow-soft">
                    {s.n}
                  </span>
                  <h3 className="mt-4 font-display text-xl">{s.t}</h3>
                  <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-muted-foreground">
                    {s.d}
                  </p>
                </div>
              ))}
            </div>
            <div className="mt-10 text-center">
              <Link
                href={freeHref}
                className="inline-flex items-center gap-2 rounded-full bg-brand px-6 py-3 text-sm font-medium text-brand-foreground shadow-soft transition-colors hover:bg-brand-hover"
              >
                Start Free <ArrowRightIcon className="size-4" />
              </Link>
            </div>
          </div>
        </section>

        {/* 7 · PRODUCT DEMO */}
        <section className="mx-auto max-w-5xl px-5 py-20">
          <h2 className="text-center font-display text-3xl tracking-tight sm:text-4xl">
            The whole month, in one view
          </h2>
          <p className="mx-auto mt-3 max-w-md text-center text-muted-foreground">
            Budget vs actual, your net position, and habits — together.
          </p>
          <ProductProof className="mx-auto mt-10 max-w-3xl" />
        </section>

        {/* 8 · FINANCE + HABITS DIFFERENTIATOR */}
        <section className="border-y border-border/60 bg-secondary/40">
          <div className="mx-auto max-w-3xl px-5 py-20 text-center">
            <h2 className="font-display text-3xl leading-tight tracking-tight sm:text-4xl">
              The daily actions and the financial results, side by side
            </h2>
            <p className="mx-auto mt-5 max-w-xl text-muted-foreground">
              Most apps do money or habits. Seeing them together is what makes
              the pattern obvious — the no-spend day that kept the budget green,
              the week you skipped the walk and the takeout crept up.
            </p>
          </div>
        </section>

        {/* 9 · SOCIAL PROOF — real only; hidden while empty */}
        {TESTIMONIALS.length > 0 && (
          <section className="mx-auto max-w-5xl px-5 py-20">
            <h2 className="text-center font-display text-3xl tracking-tight sm:text-4xl">
              What users are saying
            </h2>
            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {TESTIMONIALS.map((t) => (
                <figure
                  key={t.name}
                  className="rounded-2xl border border-border bg-card p-5 shadow-soft"
                >
                  <blockquote className="text-sm leading-relaxed">
                    &ldquo;{t.quote}&rdquo;
                  </blockquote>
                  <figcaption className="mt-3 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">
                      {t.name}
                    </span>{" "}
                    · {t.role}
                  </figcaption>
                </figure>
              ))}
            </div>
          </section>
        )}

        {/* 10 · PRICING */}
        <section id="pricing" className="mx-auto max-w-6xl px-5 py-20">
          <div className="text-center">
            <h2 className="font-display text-3xl tracking-tight sm:text-4xl">
              Simple, honest pricing
            </h2>
            <p className="mx-auto mt-3 max-w-md text-muted-foreground">
              Start free. Upgrade when you need more — or own Premium for life.
            </p>
          </div>
          <div className="mt-10">
            <PricingCards />
          </div>

          {/* 11 · FOUNDING LIFETIME OFFER */}
          <div className="mx-auto mt-8 max-w-md">
            <LifetimeCard
              available={offer.available}
              remaining={offer.remaining}
              priceUSD={offer.priceUSD}
              regularUSD={offer.regularUSD}
              ctaHref={lifetimeHref}
            />
          </div>
        </section>

        {/* Trust / privacy (§34) */}
        <section className="border-y border-border/60 bg-secondary/40">
          <div className="mx-auto max-w-3xl px-5 py-16 text-center">
            <ShieldCheckIcon className="mx-auto size-7 text-brand" />
            <h2 className="mt-3 font-display text-2xl tracking-tight sm:text-3xl">
              Your financial records are personal
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
              Every record is scoped to your own account with database-level row
              security, so other users can&rsquo;t read or write your data. A
              one-tap toggle hides amounts on screen when you&rsquo;re in public.
              See our{" "}
              <Link href="/privacy" className="text-brand underline underline-offset-4">
                Privacy Policy
              </Link>{" "}
              for exactly what we collect and who processes it.
            </p>
          </div>
        </section>

        {/* 12 · FAQ */}
        <section id="faq" className="mx-auto max-w-3xl px-5 py-20">
          <h2 className="text-center font-display text-3xl tracking-tight sm:text-4xl">
            Questions, answered
          </h2>
          <dl className="mt-8 divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
            {FAQS.map((f) => (
              <div key={f.q} className="p-5">
                <dt className="font-medium">{f.q}</dt>
                <dd className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                  {f.a}
                </dd>
              </div>
            ))}
          </dl>
        </section>

        {/* 13 · FINAL CTA */}
        <section className="mx-auto max-w-6xl px-5 py-20">
          <div className="overflow-hidden rounded-[2rem] border border-border bg-card px-6 py-14 text-center shadow-card sm:px-16">
            <h2 className="mx-auto max-w-2xl font-display text-3xl leading-tight tracking-tight sm:text-4xl">
              Your money and your habits affect each other. Track them in one
              place.
            </h2>
            <p className="mx-auto mt-4 max-w-md text-muted-foreground">
              Start with your next transaction, your next budget, and your next
              habit.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link
                href={freeHref}
                className="inline-flex items-center gap-2 rounded-full bg-brand px-7 py-3.5 text-base font-medium text-brand-foreground shadow-card transition-all hover:-translate-y-0.5 hover:bg-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                Start Free <ArrowRightIcon className="size-4" />
              </Link>
              {offer.available && (
                <Link
                  href={lifetimeHref}
                  className="inline-flex items-center gap-2 rounded-full border border-accent-brand px-7 py-3.5 text-base font-medium text-sage transition-colors hover:bg-accent-brand/10"
                >
                  <SparklesIcon className="size-4" /> Get Lifetime for $
                  {offer.priceUSD}
                </Link>
              )}
            </div>
          </div>
        </section>
      </main>

      <MarketingFooter />

      {/* Conversion aids — only render for a genuinely live offer */}
      <LifetimePopup
        href={lifetimeHref}
        priceUSD={offer.priceUSD}
        regularUSD={offer.regularUSD}
        remaining={offer.remaining}
        available={offer.available}
      />
      <StickyCta
        freeHref={freeHref}
        lifetimeHref={lifetimeHref}
        lifetimePriceUSD={offer.priceUSD}
        offerAvailable={offer.available}
      />
    </div>
  );
}

const FAQS: { q: string; a: string }[] = [
  {
    q: "What is Finance & Habit Tracker?",
    a: "One workspace for your money and your habits — monthly budgets, spending, savings, bills, accounts, plus daily habits, mood and tasks.",
  },
  {
    q: "Does it connect to my bank automatically?",
    a: "No. It is manual-first: you add accounts and log expenses yourself in a few taps. There is no automatic bank syncing.",
  },
  {
    q: "Can I install it like an app?",
    a: "Yes. It is a PWA — add it to your home screen on phone, tablet or desktop and it works like a native app.",
  },
  {
    q: "Is my information private?",
    a: "Your records are scoped to your own account with database-level row security, so other users can't see them. You can also hide amounts on screen with one tap.",
  },
  {
    q: "What is included in the Free plan?",
    a: "Enough to run your everyday life — budgets, accounts, transactions and habits at the Free limits. Upgrade only when you need more room.",
  },
  {
    q: "Can I cancel my subscription?",
    a: "Yes. Cancel anytime and keep your paid plan until the end of the period you already paid for, then move to Free. Nothing is charged after that.",
  },
  {
    q: "What does Lifetime access mean?",
    a: "One payment for Premium access for the lifetime of the product, subject to the Terms. It is not a subscription and is never billed again.",
  },
  {
    q: "Can I use Google to sign in?",
    a: "Email sign-in is available today. Google sign-in appears automatically when it is enabled for the app.",
  },
];

function Benefit({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
      <span className="grid size-10 place-items-center rounded-xl bg-secondary text-brand">
        {icon}
      </span>
      <h3 className="mt-3 font-display text-lg">{title}</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
        {body}
      </p>
    </div>
  );
}
