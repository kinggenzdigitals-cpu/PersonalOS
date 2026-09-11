import { requireOnboardedAccount } from "@/lib/auth";
import { getEntitlement } from "@/lib/entitlement";
import { getAccounts, getCategories } from "@/lib/queries/money";
import { getDueBillCount } from "@/lib/queries/planning";
import { getHabitReminders } from "@/lib/queries/habits";
import { ProfileProvider } from "@/components/providers/profile-provider";
import { ReferenceProvider } from "@/components/providers/reference-provider";
import { UpgradeProvider } from "@/components/providers/upgrade-provider";
import { ActiveUseTimer } from "@/components/providers/active-use-timer";
import {
  DesktopSidebar,
  TopBar,
  MobileBottomNav,
} from "@/components/nav/main-nav";
import { QuickAdd } from "@/components/nav/quick-add";
import { HabitReminderRunner } from "@/components/habits/habit-reminder-runner";
import { AppLockGate } from "@/components/security/app-lock-gate";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // The account menus (sidebar footer on desktop, top bar on mobile) show the
  // signed-in address, which the profile row doesn't carry. Taking it off the
  // gate that already fetched the auth user costs nothing; getEntitlement()
  // below reads its user through the same memoized lookup, so the whole layout
  // still makes one supabase.auth.getUser() round-trip.
  const { profile, email } = await requireOnboardedAccount();
  const [accounts, categories, dueBills, ent, habitReminders] = await Promise.all([
    getAccounts(false),
    getCategories(),
    getDueBillCount(profile.timezone),
    getEntitlement(),
    getHabitReminders(),
  ]);
  const admin = ent.isSuperAdmin;
  // Free & paid users below Premium (not comp/lifetime/super-admin) may see the
  // occasional upgrade nudge.
  const upgradeEligible =
    !ent.isSuperAdmin &&
    ent.accessType !== "complimentary_pro" &&
    ent.accessType !== "lifetime_pro" &&
    ent.plan !== "premium";

  return (
    <ProfileProvider profile={profile}>
      <ReferenceProvider accounts={accounts} categories={categories}>
        <UpgradeProvider>
        <ActiveUseTimer eligible={upgradeEligible} />
        <div className="app-shell min-h-dvh">
          {/* Skip link — WCAG 2.4.1 (Bypass Blocks). The sidebar puts a dozen
              nav links ahead of the content, so without this a keyboard or
              screen-reader user tabs through all of them on EVERY page. Hidden
              until focused, then pinned top-left above the sticky header. */}
          <a
            href="#main-content"
            className="sr-only z-50 focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:rounded-lg focus:bg-brand focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-brand-foreground focus:shadow-card focus:outline-none focus:ring-2 focus:ring-ring"
          >
            Skip to main content
          </a>
          <DesktopSidebar moneyBadge={dueBills} isAdmin={admin} />
          <TopBar email={email} />
          <main
            id="main-content"
            tabIndex={-1}
            className="mx-auto w-full max-w-2xl px-4 pb-24 pt-6 md:max-w-3xl md:pb-16"
          >
            {children}
          </main>
          <MobileBottomNav moneyBadge={dueBills} isAdmin={admin} />
          <HabitReminderRunner reminders={habitReminders} />
          <AppLockGate />
          {/* Floating Quick Add — mobile only, above the bottom nav */}
          <div
            className="fixed right-4 z-40 md:hidden"
            style={{ bottom: "calc(env(safe-area-inset-bottom) + 4.75rem)" }}
          >
            <QuickAdd variant="fab" />
          </div>
        </div>
        </UpgradeProvider>
      </ReferenceProvider>
    </ProfileProvider>
  );
}
