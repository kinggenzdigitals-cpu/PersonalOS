"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2Icon, AlertTriangleIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormSheet } from "@/components/money/form-sheet";
import { deleteAllData } from "@/app/(app)/settings/actions";
import { toast } from "sonner";

export function DangerZone() {
  const router = useRouter();
  const [confirm, setConfirm] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const canDelete = confirm.trim().toUpperCase() === "DELETE";

  return (
    <div className="rounded-xl border border-error/40 bg-error/5 p-4">
      <p className="flex items-center gap-2 text-sm font-medium text-error">
        <AlertTriangleIcon className="size-4" /> Danger zone
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        Permanently delete all your accounts, transactions, habits, tasks, and
        everything else. This cannot be undone.
      </p>

      <FormSheet
        title="Delete all your data?"
        description="This permanently removes everything and starts you fresh. Your login is kept."
        trigger={
          <Button
            variant="outline"
            className="mt-3 border-error/50 text-error hover:bg-error/10 hover:text-error"
          >
            Delete all data
          </Button>
        }
      >
        {(close) => (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              This will delete <strong>all</strong> your data — accounts,
              transactions, habits, mood, tasks, events, budgets, bills, goals,
              assets, and liabilities. This <strong>cannot be undone</strong>.
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="confirm-delete">
                Type <span className="font-mono font-semibold">DELETE</span> to
                confirm
              </Label>
              <Input
                id="confirm-delete"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="DELETE"
                autoComplete="off"
                autoFocus
              />
            </div>
            <Button
              className="w-full bg-error text-white hover:bg-error/90"
              disabled={!canDelete || busy}
              onClick={async () => {
                setBusy(true);
                const res = await deleteAllData();
                if (!res.ok) {
                  toast.error(res.error);
                  setBusy(false);
                  return;
                }
                close();
                toast.success("All data deleted");
                router.replace("/onboarding");
                router.refresh();
              }}
            >
              {busy && (
                <Loader2Icon className="size-4 animate-spin" aria-hidden />
              )}
              Permanently delete everything
            </Button>
          </div>
        )}
      </FormSheet>
    </div>
  );
}
