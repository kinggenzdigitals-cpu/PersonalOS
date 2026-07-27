import { requireOnboardedProfile } from "@/lib/auth";
import { getEntitlement } from "@/lib/entitlement";
import { getAccounts, getCategories } from "@/lib/queries/money";
import { getDueBillCount } from "@/lib/queries/planning";
import { ProfileProvider } from "@/components/providers/profile-provider";
import { ReferenceProvider } from "@/components/providers/reference-provider";
import { UpgradeProvider } from "@/components/providers/upgrade-provider";
import { ActiveUseTimer } from "@/components/providers/active-use-timer";
import {
  DesktopSidebar,
  MobileTopBar,
  MobileBottomNav,
} from "@/components/nav/main-nav";
import { QuickAdd } from "@/components/nav/quick-add";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await requireOnboardedProfile();
  const [accounts, categories, dueBills, ent] = await Promise.all([
    getAccounts(false),
    getCategories(),
    getDueBillCount(profile.timezone),
    getEntitlement(),
  ]);
  const admin = ent.isSuperAdmin;
  // Free & paid users below Premium (not comp/lifetime/super-admin) may see the
  // occasional upgrade nudge.
  const upgradeEligible =
    !ent.isSuperAdmin && ent.accessType == null && ent.plan !== "premium";

  return (
    <ProfileProvider profile={profile}>
      <ReferenceProvider accounts={accounts} categories={categories}>
        <UpgradeProvider>
        <ActiveUseTimer eligible={upgradeEligible} />
        <div className="min-h-dvh md:pl-60">
          <DesktopSidebar moneyBadge={dueBills} isAdmin={admin} />
          <MobileTopBar />
          <main className="mx-auto w-full max-w-2xl px-4 pb-24 pt-6 md:max-w-3xl md:pb-16">
            {children}
          </main>
          <MobileBottomNav moneyBadge={dueBills} isAdmin={admin} />
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
