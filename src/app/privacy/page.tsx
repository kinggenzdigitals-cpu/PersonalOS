import type { Metadata } from "next";
import { LegalShell } from "@/components/marketing/legal-shell";

export const metadata: Metadata = { title: "Privacy Policy" };

export default function PrivacyPage() {
  return (
    <LegalShell title="Privacy Policy" updated="September 2026">
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
            budgets, goals, habits, mood, tasks, events, and other records you
            create.
          </li>
          <li>
            <strong>Security history</strong> — sign-in time, login provider,
            browser information, and sensitive account actions.
          </li>
          <li>
            <strong>Payment records</strong> — selected plan, amount, billing
            period, payment status, and provider invoice reference. We do not
            store your full card or bank credentials.
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
        <h2>Service providers</h2>
        <p>
          Supabase provides authentication and database storage. Google may
          process sign-in information when you choose Google login. Xendit
          processes paid checkouts. Each provider handles data under its own
          terms and privacy policy.
        </p>
      </section>

      <section>
        <h2>Bank connections</h2>
        <p>
          Direct bank and e-wallet connections are not active yet. Before any
          future connection, the app will show what data is requested, ask for
          consent, and provide a way to remove the connection.
        </p>
      </section>

      <section>
        <h2>Your rights</h2>
        <ul>
          <li>Access, edit, and download your personal data.</li>
          <li>Delete tracking data or your entire account.</li>
          <li>Ask us questions about your data.</li>
        </ul>
      </section>

      <section>
        <h2>Changes &amp; contact</h2>
        <p>
          We may update this policy; we&apos;ll note the date above. For any
          privacy questions, contact{" "}
          <a href="mailto:kingfmgonzales@gmail.com">kingfmgonzales@gmail.com</a>.
        </p>
      </section>
    </LegalShell>
  );
}
