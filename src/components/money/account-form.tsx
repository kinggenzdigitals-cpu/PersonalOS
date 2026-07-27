"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCurrency } from "@/components/providers/profile-provider";
import { currencySymbol } from "@/lib/format";
import { ACCOUNT_TYPES } from "@/lib/constants";
import type { Account, AccountType } from "@/lib/supabase/types";
import {
  createAccount,
  updateAccount,
  setAccountArchived,
} from "@/app/(app)/money/actions";
import { toast } from "sonner";
import { useUpgrade } from "@/components/providers/upgrade-provider";

export function AccountForm({
  initial,
  onDone,
}: {
  initial?: Account;
  onDone: () => void;
}) {
  const router = useRouter();
  const { notify } = useUpgrade();
  const currency = useCurrency();
  const editing = Boolean(initial);

  const [name, setName] = React.useState(initial?.name ?? "");
  const [type, setType] = React.useState<AccountType>(initial?.type ?? "cash");
  const [openingBalance, setOpeningBalance] = React.useState(
    initial ? String(initial.opening_balance) : "",
  );
  const [isSpending, setIsSpending] = React.useState(
    initial?.is_spending ?? true,
  );
  const [saving, setSaving] = React.useState(false);

  async function save() {
    if (!name.trim()) {
      toast.error("Give the account a name.");
      return;
    }
    setSaving(true);
    const payload = {
      name,
      type,
      opening_balance: Number.parseFloat(openingBalance) || 0,
      is_spending: isSpending,
    };
    const result = editing
      ? await updateAccount(initial!.id, payload)
      : await createAccount(payload);

    if (!result.ok) {
      notify(result.error);
      setSaving(false);
      return;
    }
    onDone();
    router.refresh();
    toast.success(editing ? "Account updated" : "Account added");
  }

  async function archive() {
    if (!initial) return;
    setSaving(true);
    const result = await setAccountArchived(initial.id, !initial.archived);
    if (!result.ok) {
      notify(result.error);
      setSaving(false);
      return;
    }
    onDone();
    router.refresh();
    toast.success(initial.archived ? "Account restored" : "Account archived");
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="acc-name">Name</Label>
        <Input
          id="acc-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. GCash"
          autoFocus
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="acc-type">Type</Label>
        <Select value={type} onValueChange={(v) => setType(v as AccountType)}>
          <SelectTrigger id="acc-type" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ACCOUNT_TYPES.map((t) => (
              <SelectItem key={t.value} value={t.value}>
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="acc-balance">
          {editing ? "Opening balance" : "Current balance"}
        </Label>
        <div className="relative">
          <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted-foreground">
            {currencySymbol(currency)}
          </span>
          <Input
            id="acc-balance"
            inputMode="decimal"
            value={openingBalance}
            onChange={(e) =>
              setOpeningBalance(e.target.value.replace(/[^0-9.]/g, ""))
            }
            placeholder="0.00"
            className="pl-7 tnum"
          />
        </div>
        {editing && (
          <p className="text-xs text-muted-foreground">
            This is the starting balance. Use an adjustment to reconcile without
            changing history.
          </p>
        )}
      </div>

      <label className="flex items-center justify-between gap-2">
        <span className="text-sm">
          Counts as spending money
          <span className="block text-xs text-muted-foreground">
            Turn off for savings and emergency funds.
          </span>
        </span>
        <Switch checked={isSpending} onCheckedChange={setIsSpending} />
      </label>

      <div className="flex gap-2 pt-2">
        {editing && (
          <Button
            type="button"
            variant="outline"
            onClick={archive}
            disabled={saving}
          >
            {initial!.archived ? "Restore" : "Archive"}
          </Button>
        )}
        <Button className="flex-1" onClick={save} disabled={saving}>
          {saving && <Loader2Icon className="size-4 animate-spin" aria-hidden />}
          {editing ? "Save changes" : "Add account"}
        </Button>
      </div>
    </div>
  );
}
