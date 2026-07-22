"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { HistoryIcon, Loader2Icon } from "lucide-react";
import { carryOverAll } from "@/app/(app)/tasks/actions";
import { toast } from "sonner";

export function CarryOver({ count }: { count: number }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [dismissed, setDismissed] = React.useState(false);

  if (count === 0 || dismissed) return null;

  async function moveAll() {
    setBusy(true);
    const res = await carryOverAll();
    if (!res.ok) {
      toast.error(res.error);
      setBusy(false);
      return;
    }
    setDismissed(true);
    router.refresh();
    toast.success("Moved to today");
  }

  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-secondary/50 px-3 py-2.5">
      <HistoryIcon className="size-4 shrink-0 text-muted-foreground" />
      <p className="flex-1 text-sm">
        {count} unfinished {count === 1 ? "task" : "tasks"} from before.
      </p>
      <Link
        href="/tasks"
        className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
      >
        Review
      </Link>
      <button
        type="button"
        onClick={moveAll}
        disabled={busy}
        className="inline-flex items-center gap-1 rounded-lg bg-brand px-2.5 py-1 text-xs font-medium text-primary-foreground transition-colors hover:bg-brand-hover disabled:opacity-60"
      >
        {busy && <Loader2Icon className="size-3 animate-spin" />}
        Move to today
      </button>
    </div>
  );
}
