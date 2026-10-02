import type { Metadata } from "next";
import { LegalShell } from "@/components/marketing/legal-shell";
import { PRIVACY_UPDATED, legalDateLabel } from "@/lib/legal-dates";
import { BASE_OPEN_GRAPH, SHARED_OG_IMAGE } from "@/lib/seo";

const DESCRIPTION =
  "What Finance & Habit Tracker collects, why, who processes it, and the control you have over your data.";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: DESCRIPTION,
  alternates: { canonical: "/privacy" },
  openGraph: {
    ...BASE_OPEN_GRAPH,
    title: "Privacy Policy · Finance & Habit Tracker",
    description: DESCRIPTION,
    url: "/privacy",
    images: [SHARED_OG_IMAGE],
  },
};

export default function PrivacyPage() {
  return (
    <LegalShell
      title="Privacy Policy"
      updated={legalDateLabel(PRIVACY_UPDATED)}
    >
      <section>
        <p>
          Your privacy matters. This policy explains what we collect, why, and
          the control you have over your data.
        </p>
      </section>

      <section>
        <h2>What we collect</h2>
        <ul>
          <li>
            <strong>Account info</strong> — your email and display name.
          </li>
          <li>
            <strong>The data you enter</strong> — accounts, transactions,
            habits, mood, tasks, events, and goals you create.
          </li>
          <li>
            <strong>Basic usage</strong> — minimal technical data needed to run
            and secure the service, including the browser and device each
            sign-in comes from, kept so you can manage your signed-in devices.
          </li>
        </ul>
      </section>

      <section>
        <h2>How we use it</h2>
        <p>
          Only to provide Finance & Habit Tracker to you: to show your dashboard, compute your
          reports, and keep your account secure. We do <strong>not</strong> sell
          your data or use it for advertising.
        </p>
      </section>

      <section>
        <h2>Storage &amp; security</h2>
        <p>
          Your data is stored with our infrastructure provider (Supabase) and
          protected by row-level security — every record is scoped to your
          account, so no other user can read or write your data.
        </p>
      </section>

      <section>
        <h2>Who processes your data</h2>
        <p>We use these service providers to run Finance &amp; Habit Tracker:</p>
        <ul>
          <li>
            <strong>Supabase</strong> — database and sign-in. Your account
            details and everything you enter are stored here.
          </li>
          <li>
            <strong>Vercel</strong> — hosting; every request to the app passes
            through it. We also use Vercel Web Analytics to count page views
            (the page, the referring site, and general browser, device and
            country information). It does not use cookies. Where enabled,
            Vercel Speed Insights measures how fast pages load.
          </li>
          <li>
            <strong>PayMongo</strong> — payments, only if you buy a paid plan.
            PayMongo receives your email address and the plan, amount and
            payment reference, and emails you a receipt. You enter your card
            or wallet details on PayMongo&apos;s checkout page, never on ours.
          </li>
        </ul>
      </section>

      <section>
        <h2>Your rights</h2>
        <ul>
          <li>Access and edit your data anytime inside the app.</li>
          <li>Delete your data or your entire account at any time.</li>
          <li>Ask us questions about your data.</li>
        </ul>
      </section>

      <section>
        <h2>Changes &amp; contact</h2>
        <p>
          We may update this policy; we&apos;ll note the date above. For any
          privacy questions, contact{" "}
          <a href="mailto:kinggenzdigitals@gmail.com">kinggenzdigitals@gmail.com</a>.
        </p>
      </section>
    </LegalShell>
  );
}
