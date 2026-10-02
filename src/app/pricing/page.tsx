import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { MarketingHeader } from "@/components/marketing/marketing-header";
import { MarketingFooter } from "@/components/marketing/marketing-footer";
import { PricingCards } from "@/components/marketing/pricing-cards";
import { BASE_OPEN_GRAPH, SHARED_OG_IMAGE } from "@/lib/seo";

const DESCRIPTION =
  "Start free, upgrade to Pro when you're ready. Simple, honest pricing for Finance & Habit Tracker.";

export const metadata: Metadata = {
  title: "Pricing",
  description: DESCRIPTION,
  alternates: { canonical: "/pricing" },
  openGraph: {
    ...BASE_OPEN_GRAPH,
    title: "Finance & Habit Tracker — Pricing",
    description: DESCRIPTION,
    url: "/pricing",
    images: [SHARED_OG_IMAGE],
  },
};

const FAQS = [
  {
    q: "Can I try it before paying?",
    a: "Yes — the Free plan is genuinely useful and never expires. Upgrade to Pro only when you need more.",
  },
  {
    q: "Do I need to cancel?",
    a: "No. Paid plans are prepaid — no card is stored and nothing renews automatically. You keep your plan until the period you paid for ends, then move to Free unless you renew.",
  },
  {
    // Matches plan-guard: caps are checked only when adding, but net worth
    // and CSV import/export are refused outright on Free, edits included.
    q: "What happens to my data if I downgrade?",
    a: "Your data is never deleted. Accounts, transactions, budgets, goals, bills and habits you already created stay editable; while you are over a Free limit you can't add new ones of that type until you remove some or upgrade again. Paid-only features lock on Free: net worth tracking, CSV import and export, and older report history. Your assets and liabilities are kept and come back when you upgrade.",
  },
];

export default async function PricingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  // Signed-in users manage their plan inside the app.
  if (user) redirect("/settings");

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <MarketingHeader />
      <main className="mx-auto max-w-6xl px-5 py-16">
        <div className="text-center">
          <h1 className="font-display text-4xl tracking-tight sm:text-5xl">
            Simple, honest pricing
          </h1>
          <p className="mx-auto mt-3 max-w-md text-muted-foreground">
            Start free — everything to run your everyday life. Upgrade to Pro
            for your whole financial picture.
          </p>
        </div>

        {/* PricingCards titles each plan with an h3 (the landing page puts it
            under a visible h2), so this page needs an h2 of its own here. */}
        <section aria-labelledby="plans-heading" className="mt-12">
          <h2 id="plans-heading" className="sr-only">
            Plans
          </h2>
          <PricingCards />
        </section>

        <section className="mx-auto mt-20 max-w-3xl">
          <h2 className="text-center font-display text-2xl tracking-tight">
            Pricing questions
          </h2>
          <dl className="mt-6 divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
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
      </main>
      <MarketingFooter />
    </div>
  );
}
