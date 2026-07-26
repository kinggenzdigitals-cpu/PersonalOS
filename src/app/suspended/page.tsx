import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Account suspended" };

export default async function SuspendedPage() {
  await requireUser();

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-background px-4 text-center">
      <div className="w-full max-w-md space-y-4">
        <h1 className="font-display text-2xl tracking-tight">
          Account suspended
        </h1>
        <p className="text-sm text-muted-foreground">
          Your access to Finance &amp; Habit Tracker is currently paused. If you
          think this is a mistake, please contact support at{" "}
          <a
            className="text-brand underline-offset-4 hover:underline"
            href="mailto:kingfmgonzales@gmail.com"
          >
            kingfmgonzales@gmail.com
          </a>
          .
        </p>
        <form action="/auth/signout" method="post">
          <Button variant="outline" type="submit" className="w-full">
            Sign out
          </Button>
        </form>
      </div>
    </main>
  );
}
