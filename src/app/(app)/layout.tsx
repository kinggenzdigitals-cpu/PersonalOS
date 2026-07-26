import { requireOnboardedProfile } from "@/lib/auth";
import { isSuperAdmin } from "@/lib/entitlement";
import { getAccounts, getCategories } from "@/lib/queries/money";
import { getDueBillCount } from "@/lib/queries/planning";
import { ProfileProvider } from "@/components/providers/profile-provider";
import { ReferenceProvider } from "@/components/providers/reference-provider";
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
  const [accounts, categories, dueBills, admin] = await Promise.all([
    getAccounts(false),
    getCategories(),
    getDueBillCount(profile.timezone),
    isSuperAdmin(),
  ]);

  return (
    <ProfileProvider profile={profile}>
      <ReferenceProvider accounts={accounts} categories={categories}>
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
      </ReferenceProvider>
    </ProfileProvider>
  );
}
