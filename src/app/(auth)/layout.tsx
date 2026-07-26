import Link from "next/link";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-[400px]">
        <Link href="/" className="mb-8 flex items-center justify-center gap-2">
          <span className="grid size-9 place-items-center rounded-xl bg-brand text-primary-foreground shadow-soft">
            <span className="font-display text-lg leading-none">F</span>
          </span>
          <span className="font-display text-xl tracking-tight">Finance & Habit Tracker</span>
        </Link>
        {children}
      </div>
    </main>
  );
}
