"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2Icon, Trash2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCurrency } from "@/components/providers/profile-provider";
import { currencySymbol } from "@/lib/format";
import {
  upsertAsset,
  deleteAsset,
  upsertLiability,
  deleteLiability,
} from "@/app/(app)/money/networth-actions";
import type {
  Asset,
  AssetKind,
  Liability,
  LiabilityKind,
} from "@/lib/supabase/types";
import { toast } from "sonner";

const ASSET_KINDS: { value: AssetKind; label: string }[] = [
  { value: "property", label: "Property" },
  { value: "investment", label: "Investment" },
  { value: "business", label: "Business" },
  { value: "vehicle", label: "Vehicle" },
  { value: "cash", label: "Cash / Savings" },
  { value: "other", label: "Other" },
];

const LIABILITY_KINDS: { value: LiabilityKind; label: string }[] = [
  { value: "mortgage", label: "Mortgage" },
  { value: "loan", label: "Loan" },
  { value: "credit_card", label: "Credit card" },
  { value: "other", label: "Other" },
];

export function NetWorthItemForm({
  type,
  initial,
  onDone,
}: {
  type: "asset" | "liability";
  initial?: Asset | Liability;
  onDone: () => void;
}) {
  const router = useRouter();
  const currency = useCurrency();
  const editing = Boolean(initial);
  const isAsset = type === "asset";

  const initialAmount = initial
    ? isAsset
      ? (initial as Asset).value
      : (initial as Liability).balance
    : "";

  const [name, setName] = React.useState(initial?.name ?? "");
  const [kind, setKind] = React.useState<string>(
    initial?.kind ?? (isAsset ? "other" : "other"),
  );
  const [amount, setAmount] = React.useState(String(initialAmount));
  const [saving, setSaving] = React.useState(false);

  const kinds = isAsset ? ASSET_KINDS : LIABILITY_KINDS;

  async function save() {
    if (!name.trim()) return toast.error(`Name the ${type}.`);
    const value = Number.parseFloat(amount);
    if (!(value >= 0)) return toast.error("Enter an amount.");

    setSaving(true);
    const result = isAsset
      ? await upsertAsset({
          id: initial?.id,
          name,
          kind: kind as AssetKind,
          value,
        })
      : await upsertLiability({
          id: initial?.id,
          name,
          kind: kind as LiabilityKind,
          balance: value,
        });

    if (!result.ok) {
      toast.error(result.error);
      setSaving(false);
      return;
    }
    onDone();
    router.refresh();
    toast.success(editing ? "Updated" : "Added");
  }

  async function remove() {
    if (!initial) return;
    setSaving(true);
    const result = isAsset
      ? await deleteAsset(initial.id)
      : await deleteLiability(initial.id);
    if (!result.ok) {
      toast.error(result.error);
      setSaving(false);
      return;
    }
    onDone();
    router.refresh();
    toast.success("Removed");
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="nw-name">Name</Label>
        <Input
          id="nw-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={isAsset ? "e.g. Condo unit" : "e.g. Home mortgage"}
          autoFocus
        />
      </div>

      <div className="space-y-1.5">
        <Label>Type</Label>
        <Select value={kind} onValueChange={setKind}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {kinds.map((k) => (
              <SelectItem key={k.value} value={k.value}>
                {k.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="nw-amount">{isAsset ? "Value" : "Balance owed"}</Label>
        <div className="relative">
          <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted-foreground">
            {currencySymbol(currency)}
          </span>
          <Input
            id="nw-amount"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
            placeholder="0.00"
            className="pl-7 tnum"
          />
        </div>
      </div>

      <div className="flex gap-2 pt-2">
        {editing && (
          <Button
            type="button"
            variant="ghost"
            className="text-error hover:text-error"
            onClick={remove}
            disabled={saving}
          >
            <Trash2Icon className="size-4" />
          </Button>
        )}
        <Button className="flex-1" onClick={save} disabled={saving}>
          {saving && <Loader2Icon className="size-4 animate-spin" aria-hidden />}
          {editing ? "Save changes" : `Add ${type}`}
        </Button>
      </div>
    </div>
  );
}
