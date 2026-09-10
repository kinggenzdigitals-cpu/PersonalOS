import type { Metadata } from "next";
import { LegalShell } from "@/components/marketing/legal-shell";

export const metadata: Metadata = { title: "Terms of Service" };

export default function TermsPage() {
  return (
    <LegalShell title="Terms of Service" updated="September 2026">
      <section>
        <p>
          Welcome to Finance & Habit Tracker. By creating an account or using the service, you
          agree to these terms. Please read them carefully.
        </p>
      </section>

      <section>
        <h2>1. The service</h2>
        <p>
          Finance & Habit Tracker is a personal life-management app for tracking money, habits,
          mood, tasks, and your calendar. We may add, change, or remove features
          over time.
        </p>
      </section>

      <section>
        <h2>2. Your account</h2>
        <p>
          You&apos;re responsible for keeping your login secure and for all
          activity under your account. You must be old enough to form a binding
          contract in your country to use Finance & Habit Tracker.
        </p>
      </section>

      <section>
        <h2>3. Acceptable use</h2>
        <ul>
          <li>Don&apos;t misuse, disrupt, or attempt to break the service.</li>
          <li>Don&apos;t access other users&apos; data or accounts.</li>
          <li>Don&apos;t use Finance & Habit Tracker for anything unlawful.</li>
        </ul>
      </section>

      <section>
        <h2>4. Plans &amp; billing</h2>
        <p>
          Finance &amp; Habit Tracker offers a Free plan, paid Pro and Premium
          subscriptions, and a one-time Premium Lifetime option. Prices may
          change with advance notice; a change never affects a period you have
          already paid for.
        </p>
        <p>
          <strong>Subscriptions are prepaid</strong> for the billing period you
          choose. No card is stored and nothing renews automatically — your
          access continues until the end of the period you paid for and then
          returns to Free unless you choose to renew. You can turn off future
          renewal at any time from your account and keep the access you have
          already paid for until it ends.
        </p>
        <p>
          <strong>Premium Lifetime</strong> is a single payment for Premium-tier
          access for the operational lifetime of the Finance &amp; Habit Tracker
          product, subject to these Terms. It is not a subscription and is never
          billed again. &ldquo;Lifetime&rdquo; means the lifetime of the
          product, not your personal lifetime, and does not include separately
          sold future products or third-party services that may carry their own
          costs. Lifetime is charged in US dollars; the exact amount and
          currency are shown before you pay.
        </p>
        <p>
          <strong>Refunds.</strong> Nothing in these Terms limits the refund or
          other remedies you are entitled to under Philippine consumer law,
          including the Consumer Act (Republic Act No. 7394) and the Internet
          Transactions Act (Republic Act No. 11967). To request a refund or
          raise a billing concern, contact us at the address below.
        </p>
      </section>

      <section>
        <h2>5. Your data</h2>
        <p>
          Your data belongs to you. We store it securely and never sell it. See
          our <a href="/privacy">Privacy Policy</a> for details. You can delete
          your data at any time.
        </p>
      </section>

      <section>
        <h2>6. Disclaimer</h2>
        <p>
          Finance & Habit Tracker is provided &quot;as is&quot; and is not financial, tax, or
          investment advice. You&apos;re responsible for decisions you make based
          on the information you record.
        </p>
      </section>

      <section>
        <h2>7. Changes &amp; contact</h2>
        <p>
          We may update these terms; we&apos;ll note the date above. Questions?
          Reach us at{" "}
          <a href="mailto:kingfmgonzales@gmail.com">kingfmgonzales@gmail.com</a>.
        </p>
        <p>
          These Terms are governed by the laws of the Republic of the
          Philippines, and any dispute is subject to the appropriate courts
          there. If any part of these Terms is found unenforceable, the rest
          continues to apply.
        </p>
      </section>
    </LegalShell>
  );
}
