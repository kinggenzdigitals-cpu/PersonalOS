"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2Icon, AlertTriangleIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormSheet } from "@/components/money/form-sheet";
import { deleteAllData, deleteAccount } from "@/app/(app)/settings/actions";
import { toast } from "sonner";

export function DangerZone({ email }: { email: string | null }) {
  const router = useRouter();
  const [confirm, setConfirm] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const canDelete = confirm.trim().toUpperCase() === "DELETE";

  // Account deletion is confirmed by typing the account's own email rather than
  // a fixed word: it is irreversible, and it must stay distinguishable from the
  // "reset my data" action directly above it, which keeps the login.
  const [confirmEmail, setConfirmEmail] = React.useState("");
  const [busyAccount, setBusyAccount] = React.useState(false);
  const canDeleteAccount =
    !!email && confirmEmail.trim().toLowerCase() === email.toLowerCase();

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

      <div className="mt-4 border-t border-error/30 pt-4">
        <p className="text-sm font-medium text-error">Delete your account</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Removes your login and every record tied to it. Unlike the option
          above, this cannot be recovered and you cannot sign in again.
        </p>

        <FormSheet
          title="Delete your account permanently?"
          description="Your login and all your data are removed. This cannot be undone."
          trigger={
            <Button
              variant="outline"
              className="mt-3 border-error/50 text-error hover:bg-error/10 hover:text-error"
            >
              Delete my account
            </Button>
          }
        >
          {(close) => (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                This deletes your login and everything attached to it —
                accounts, transactions, habits, mood entries, tasks, budgets,
                bills, goals and settings. You will be signed out immediately
                and <strong>will not be able to sign in again</strong>.
              </p>
              <p className="text-sm text-muted-foreground">
                Payment records are kept for accounting, with your identifiers
                removed from them.
              </p>

              {email ? (
                <div className="space-y-1.5">
                  <Label htmlFor="confirm-delete-account">
                    Type <span className="font-mono font-semibold">{email}</span>{" "}
                    to confirm
                  </Label>
                  <Input
                    id="confirm-delete-account"
                    type="email"
                    value={confirmEmail}
                    onChange={(e) => setConfirmEmail(e.target.value)}
                    placeholder={email}
                    autoComplete="off"
                  />
                </div>
              ) : (
                <p className="text-sm text-error">
                  We couldn&rsquo;t read the email on this account, so deletion
                  can&rsquo;t be confirmed here. Please contact support.
                </p>
              )}

              <Button
                className="w-full bg-error text-white hover:bg-error/90"
                disabled={!canDeleteAccount || busyAccount}
                onClick={async () => {
                  setBusyAccount(true);
                  const res = await deleteAccount(confirmEmail);
                  if (!res.ok) {
                    toast.error(res.error);
                    setBusyAccount(false);
                    return;
                  }
                  close();
                  // Full reload, not router.push: every client cache and
                  // provider still holds the deleted user's data in memory.
                  window.location.href = "/login";
                }}
              >
                {busyAccount && (
                  <Loader2Icon className="size-4 animate-spin" aria-hidden />
                )}
                Permanently delete my account
              </Button>
            </div>
          )}
        </FormSheet>
      </div>
    </div>
  );
}
