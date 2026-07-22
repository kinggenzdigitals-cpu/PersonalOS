"use client";

import { useEffect } from "react";
import { AlertCircleIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[60dvh] flex-col items-center justify-center gap-3 text-center">
      <span className="grid size-12 place-items-center rounded-full bg-error/10 text-error">
        <AlertCircleIcon className="size-6" aria-hidden />
      </span>
      <h1 className="font-display text-xl">Something went wrong</h1>
      <p className="max-w-xs text-sm text-muted-foreground">
        We couldn&apos;t load this page. It might be a connection hiccup.
      </p>
      <Button onClick={reset}>Try again</Button>
    </div>
  );
}
