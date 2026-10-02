import type { Metadata } from "next";
import Link from "next/link";

// Sign-in and password pages are utilities, not search results. The pages
// here set only `title`, so they inherit this (metadata merges shallowly).
// Keep these paths out of robots.txt's disallow list: a crawler that may not
// fetch a page never reads its noindex.
export const metadata: Metadata = { robots: { index: false, follow: true } };

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-[400px]">
        <Link href="/" className="mb-8 flex items-center justify-center gap-2">
          <span className="grid size-9 place-items-center rounded-xl bg-brand text-brand-foreground shadow-soft">
            <span className="font-display text-lg leading-none">F</span>
          </span>
          <span className="font-display text-xl tracking-tight">Finance & Habit Tracker</span>
        </Link>
        {children}
      </div>
    </main>
  );
}
