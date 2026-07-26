import { requireOnboardedProfile } from "@/lib/auth";
import { getAccounts, getCategories } from "@/lib/queries/money";
import { getDueBillCount } from "@/lib/queries/planning";
import { ProfileProvider } from "@/components/providers/profile-provider";
import { ReferenceProvider } from "@/components/providers/reference-provider";
import {
  DesktopSidebar,
  MobileTopBar,
  MobileBottomNav,
} from "@/components/nav/main-nav";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await requireOnboardedProfile();
  const [accounts, categories, dueBills] = await Promise.all([
    getAccounts(false),
    getCategories(),
    getDueBillCount(profile.timezone),
  ]);

  return (
    <ProfileProvider profile={profile}>
      <ReferenceProvider accounts={accounts} categories={categories}>
        <div className="min-h-dvh md:pl-60">
          <DesktopSidebar moneyBadge={dueBills} />
          <MobileTopBar />
          <main className="mx-auto w-full max-w-2xl px-4 pb-24 pt-6 md:max-w-3xl md:pb-16">
            {children}
          </main>
          <MobileBottomNav moneyBadge={dueBills} />
        </div>
      </ReferenceProvider>
    </ProfileProvider>
  );
}
