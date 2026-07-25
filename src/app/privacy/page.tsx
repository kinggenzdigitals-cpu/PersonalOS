import type { Metadata } from "next";
import { LegalShell } from "@/components/marketing/legal-shell";

export const metadata: Metadata = { title: "Privacy Policy" };

export default function PrivacyPage() {
  return (
    <LegalShell title="Privacy Policy" updated="July 2026">
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
            and secure the service.
          </li>
        </ul>
      </section>

      <section>
        <h2>How we use it</h2>
        <p>
          Only to provide Life OS to you: to show your dashboard, compute your
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
          <a href="mailto:hello@lifeos.app">hello@lifeos.app</a>.
        </p>
      </section>
    </LegalShell>
  );
}
