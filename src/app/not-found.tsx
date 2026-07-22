import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-3 px-4 text-center">
      <p className="font-display text-5xl text-brand">404</p>
      <h1 className="font-display text-xl">Page not found</h1>
      <p className="max-w-xs text-sm text-muted-foreground">
        That page doesn&apos;t exist or has moved.
      </p>
      <Button asChild className="mt-2">
        <Link href="/">Back home</Link>
      </Button>
    </main>
  );
}
