"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2Icon, AlertTriangleIcon, UserXIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormSheet } from "@/components/money/form-sheet";
import { deleteAccount, deleteAllData } from "@/app/(app)/settings/actions";
import { toast } from "sonner";

export function DangerZone() {
  const router = useRouter();
  const [confirm, setConfirm] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [accountConfirm, setAccountConfirm] = React.useState("");
  const [accountBusy, setAccountBusy] = React.useState(false);
  const canDelete = confirm.trim().toUpperCase() === "DELETE";
  const canDeleteAccount =
    accountConfirm.trim().toUpperCase() === "DELETE ACCOUNT";

  return (
    <div className="rounded-xl border border-error/40 bg-error/5 p-4">
      <p className="flex items-center gap-2 text-sm font-medium text-error">
        <AlertTriangleIcon className="size-4" /> Danger zone
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        Delete your tracking data, or permanently remove your login and entire
        account. These actions cannot be undone.
      </p>

      <FormSheet
        title="Delete all your data?"
        description="This removes your tracking records and starts you fresh. Your login, settings, plan, and security history are kept."
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
              This will delete your <strong>tracking data</strong>: accounts,
              transactions, habits, mood, tasks, events, budgets, bills, goals,
              assets, and liabilities. Your login and plan remain. This cannot
              be undone.
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

      <FormSheet
        title="Delete your account?"
        description="This permanently removes your login and all data connected to it."
        trigger={
          <Button
            variant="outline"
            className="mt-3 border-error/50 text-error hover:bg-error/10 hover:text-error"
          >
            <UserXIcon className="size-4" /> Delete account
          </Button>
        }
      >
        {() => (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Your login, profile, financial records, habits, and subscription
              record will be permanently removed. Sign in again first if your
              current login is more than 15 minutes old.
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="confirm-delete-account">
                Type <span className="font-mono font-semibold">DELETE ACCOUNT</span>
              </Label>
              <Input
                id="confirm-delete-account"
                value={accountConfirm}
                onChange={(e) => setAccountConfirm(e.target.value)}
                placeholder="DELETE ACCOUNT"
                autoComplete="off"
              />
            </div>
            <Button
              className="w-full bg-error text-white hover:bg-error/90"
              disabled={!canDeleteAccount || accountBusy}
              onClick={async () => {
                setAccountBusy(true);
                const result = await deleteAccount(accountConfirm);
                if (!result.ok) {
                  toast.error(result.error);
                  setAccountBusy(false);
                  return;
                }
                window.location.assign("/");
              }}
            >
              {accountBusy && <Loader2Icon className="size-4 animate-spin" />}
              Permanently delete account
            </Button>
          </div>
        )}
      </FormSheet>
    </div>
  );
}
