import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { MarketingHeader } from "@/components/marketing/marketing-header";
import { MarketingFooter } from "@/components/marketing/marketing-footer";
import { PricingCards } from "@/components/marketing/pricing-cards";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Start free, upgrade to Pro when you're ready. Simple, honest pricing for Finance & Habit Tracker.",
  openGraph: { title: "Finance & Habit Tracker — Pricing", type: "website" },
};

const FAQS = [
  {
    q: "Can I try it before paying?",
    a: "Yes — the Free plan is genuinely useful and never expires. Upgrade to Pro only when you need more.",
  },
  {
    q: "Can I cancel anytime?",
    a: "Yes. Cancel whenever you like and you'll keep Pro until the end of your billing period.",
  },
  {
    q: "What happens to my data if I downgrade?",
    a: "Your data is never deleted. If you exceed Free limits, older items become read-only until you're back within the plan.",
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

        <div className="mt-12">
          <PricingCards />
        </div>

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
