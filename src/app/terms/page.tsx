import type { Metadata } from "next";
import { LegalShell } from "@/components/marketing/legal-shell";

export const metadata: Metadata = { title: "Terms of Service" };

export default function TermsPage() {
  return (
    <LegalShell title="Terms of Service" updated="July 2026">
      <section>
        <p>
          Welcome to Life OS. By creating an account or using the service, you
          agree to these terms. Please read them carefully.
        </p>
      </section>

      <section>
        <h2>1. The service</h2>
        <p>
          Life OS is a personal life-management app for tracking money, habits,
          mood, tasks, and your calendar. We may add, change, or remove features
          over time.
        </p>
      </section>

      <section>
        <h2>2. Your account</h2>
        <p>
          You&apos;re responsible for keeping your login secure and for all
          activity under your account. You must be old enough to form a binding
          contract in your country to use Life OS.
        </p>
      </section>

      <section>
        <h2>3. Acceptable use</h2>
        <ul>
          <li>Don&apos;t misuse, disrupt, or attempt to break the service.</li>
          <li>Don&apos;t access other users&apos; data or accounts.</li>
          <li>Don&apos;t use Life OS for anything unlawful.</li>
        </ul>
      </section>

      <section>
        <h2>4. Plans &amp; billing</h2>
        <p>
          Life OS offers a Free plan and a paid Pro subscription. Paid plans
          renew automatically until cancelled. You can cancel anytime and keep
          Pro until the end of the current billing period. Prices may change with
          advance notice.
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
          Life OS is provided &quot;as is&quot; and is not financial, tax, or
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
      </section>
    </LegalShell>
  );
}
