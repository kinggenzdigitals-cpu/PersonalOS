"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LandmarkIcon, Loader2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Money, usePrivacyHidden } from "@/components/ui/money";
import { previewAccountBalance, saveAccountComparison } from "@/app/(app)/money/banking-actions";
import { parseBalance, RECONCILIATION_LABELS, type BalancePreview } from "@/lib/reconciliation";
import type { ComparisonAccount } from "@/lib/queries/banking";
import type { AccountReconciliation } from "@/lib/supabase/types";

function dateLabel(value: string, timezone: string) {
  try {
    return new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeStyle: "short", timeZone: timezone }).format(new Date(value));
  } catch { return new Date(value).toISOString(); }
}

export function BankConnections({ accounts, history, available, currency, timezone }: {
  accounts: ComparisonAccount[];
  history: AccountReconciliation[];
  available: boolean;
  currency: string;
  timezone: string;
}) {
  const router = useRouter();
  const hidden = usePrivacyHidden();
  const [pending, startTransition] = useTransition();
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const [balance, setBalance] = useState("");
  const [preview, setPreview] = useState<BalancePreview | null>(null);
  const [adjust, setAdjust] = useState(false);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const names = new Map(accounts.map(account => [account.id, account.name]));

  function clearPreview() { setPreview(null); setAdjust(false); setError(""); setMessage(""); }

  function compare() {
    const observed = parseBalance(balance);
    if (observed === null) { setError("Enter a balance like 40000 or 40000.50."); return; }
    setError(""); setMessage("");
    startTransition(async () => {
      try {
        const result = await previewAccountBalance(accountId, observed);
        if (!result.ok) { setError(result.error); return; }
        setPreview(result.data); setAdjust(false);
      } catch { setError("The balance couldn't be checked. Please try again."); }
    });
  }

  function save() {
    if (!preview) return;
    setError("");
    startTransition(async () => {
      try {
        const result = await saveAccountComparison({ ...preview, applyAdjustment: adjust, notes });
        if (!result.ok) {
          setError(result.error);
          if (result.restart) setPreview(null);
          return;
        }
        setPreview(null); setAdjust(false); setNotes(""); setBalance("");
        setMessage(result.data.status === "needs_review" ? "Comparison saved. Review the difference in your transactions." : "Comparison saved.");
        router.refresh();
      } catch { setError("The comparison couldn't be saved. Please try again."); }
    });
  }

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-border bg-card p-4">
        <p className="flex items-center gap-2 font-medium"><LandmarkIcon className="size-5 text-brand" aria-hidden /> Bank &amp; wallet connections</p>
        <p className="mt-1 text-sm text-muted-foreground">Your accounts currently use manual entries. Automatic bank sync is awaiting setup.</p>
        <p className="mt-2 text-xs text-muted-foreground">Compare a balance from your bank, wallet, or cash count. This does not connect to your bank.</p>
      </div>

      {!available ? (
        <p role="status" className="rounded-xl border border-warning/40 bg-warning/5 p-4 text-sm">Balance comparisons are temporarily unavailable. Your saved accounts can still be viewed in <Link className="underline" href="/money">Money Overview</Link>.</p>
      ) : accounts.length === 0 ? (
        <p className="rounded-xl border border-dashed p-6 text-sm">Add an account such as BPI, GCash, or Maya in <Link className="underline" href="/money">Money Overview</Link> to start comparing balances.</p>
      ) : (
        <Card>
          <CardHeader><CardTitle className="text-base">Compare a balance</CardTitle></CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={event => { event.preventDefault(); compare(); }}>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="compare-account">Account · Manual</Label>
                  <select id="compare-account" className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" disabled={pending} value={accountId} onChange={event => { setAccountId(event.target.value); clearPreview(); }}>
                    {accounts.map(account => <option key={account.id} value={account.id}>{account.name}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="observed-balance">Balance you checked ({currency})</Label>
                  <Input id="observed-balance" type={hidden ? "password" : "text"} inputMode="decimal" autoComplete="off" placeholder="e.g. 40000.00" value={balance} disabled={pending} onChange={event => { setBalance(event.target.value); clearPreview(); }} />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">Use the same currency and cutoff. Review pending transactions before changing a balance.</p>
              <Button type="submit" variant="outline" disabled={pending || !balance.trim()}>{pending && <Loader2Icon className="size-4 animate-spin" aria-hidden />}Compare balances</Button>

              {preview && (
                <div className="space-y-4 rounded-xl border border-border p-4">
                  <p className="text-xs text-muted-foreground">As of {dateLabel(preview.asOf, timezone)}</p>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div><p className="text-xs text-muted-foreground">Recorded in tracker</p><Money value={preview.recordedBalance} currency={currency} className="font-semibold" /></div>
                    <div><p className="text-xs text-muted-foreground">Balance you entered</p><Money value={preview.observedBalance} currency={currency} className="font-semibold" /></div>
                    <div><p className="text-xs text-muted-foreground">Difference</p><Money value={preview.difference} currency={currency} sign className="font-semibold" /></div>
                  </div>
                  {preview.difference !== 0 ? <>
                    <p className="text-sm">Check for missing or duplicate entries in <Link className="underline" href="/money/transactions">Transactions</Link>. Saving this comparison alone keeps your balance unchanged.</p>
                    <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1 size-4" checked={adjust} disabled={pending} onChange={event => setAdjust(event.target.checked)} /><span>I reviewed the difference. Add a balance adjustment when I save.</span></label>
                    {adjust && <div className="space-y-1.5"><Label htmlFor="comparison-note">Reason for adjustment</Label><Textarea id="comparison-note" maxLength={240} disabled={pending} value={notes} onChange={event => setNotes(event.target.value)} placeholder="e.g. Correcting an old opening balance" /><p className="text-xs text-muted-foreground">An adjustment changes this account balance. It is excluded from income and expense totals.</p></div>}
                  </> : <p className="text-sm text-success">The balances match. No adjustment is needed.</p>}
                  <Button type="button" onClick={save} disabled={pending || (adjust && !notes.trim())}>{pending && <Loader2Icon className="size-4 animate-spin" aria-hidden />}{adjust ? "Save comparison & adjustment" : "Save comparison"}</Button>
                </div>
              )}
              {error && <p role="alert" className="text-sm text-error">{error}</p>}
              {message && <p role="status" className="text-sm text-success">{message}</p>}
            </form>
          </CardContent>
        </Card>
      )}

      {available && <section className="space-y-3">
        <h2 className="text-sm font-medium">Recent comparisons</h2>
        {history.length === 0 ? <p className="text-sm text-muted-foreground">No comparisons saved yet.</p> : history.map(entry => (
          <div key={entry.id} className="rounded-xl border border-border bg-card p-4">
            <div className="flex flex-wrap items-start justify-between gap-2"><p className="font-medium">{names.get(entry.account_id) ?? "Archived account"}</p><span className="text-xs text-muted-foreground">{RECONCILIATION_LABELS[entry.status]}</span></div>
            <p className="mt-1 text-xs text-muted-foreground">Manual comparison · {dateLabel(entry.as_of, timezone)}</p>
            <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-sm"><span>Entered: <Money value={Number(entry.observed_balance)} currency={currency} /></span><span>Difference: <Money value={Number(entry.difference)} currency={currency} sign /></span></div>
          </div>
        ))}
      </section>}
    </div>
  );
}
