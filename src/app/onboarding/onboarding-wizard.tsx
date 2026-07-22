"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2Icon, PlusIcon, Trash2Icon, CheckIcon } from "lucide-react";
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
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { currencySymbol } from "@/lib/format";
import {
  ACCOUNT_TYPES,
  LIFE_AREA_MAP,
  SUGGESTED_ACCOUNTS,
  SUGGESTED_HABITS,
} from "@/lib/constants";
import type { AccountType } from "@/lib/supabase/types";
import { completeOnboarding } from "./actions";
import { toast } from "sonner";

type AccountRow = {
  id: string;
  name: string;
  type: AccountType;
  opening_balance: string;
  is_spending: boolean;
};

const CURRENCIES = ["PHP", "USD", "EUR", "GBP", "SGD", "AUD", "CAD", "JPY"];

let rowSeq = 0;
const nextId = () => `row-${rowSeq++}`;

export function OnboardingWizard({
  initialName,
}: {
  initialName: string | null;
}) {
  const router = useRouter();
  const [step, setStep] = React.useState(0);
  const [saving, setSaving] = React.useState(false);

  const [displayName, setDisplayName] = React.useState(initialName ?? "");
  const [currency, setCurrency] = React.useState("PHP");

  const [accounts, setAccounts] = React.useState<AccountRow[]>(() =>
    SUGGESTED_ACCOUNTS.slice(0, 2).map((a) => ({
      id: nextId(),
      name: a.name,
      type: a.type,
      opening_balance: "",
      is_spending: a.is_spending,
    })),
  );

  const [selectedHabits, setSelectedHabits] = React.useState<Set<string>>(
    new Set(["Prayer", "Exercise", "Gratitude"]),
  );

  const sym = currencySymbol(currency);

  function addSuggestedAccount(name: string) {
    const suggestion = SUGGESTED_ACCOUNTS.find((a) => a.name === name);
    setAccounts((prev) => [
      ...prev,
      {
        id: nextId(),
        name: suggestion?.name ?? "",
        type: suggestion?.type ?? "cash",
        opening_balance: "",
        is_spending: suggestion?.is_spending ?? true,
      },
    ]);
  }

  function updateAccount(id: string, patch: Partial<AccountRow>) {
    setAccounts((prev) =>
      prev.map((a) => (a.id === id ? { ...a, ...patch } : a)),
    );
  }

  function removeAccount(id: string) {
    setAccounts((prev) => prev.filter((a) => a.id !== id));
  }

  function toggleHabit(name: string) {
    setSelectedHabits((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  const canProceedName = displayName.trim().length > 0;
  const canProceedAccounts = accounts.some((a) => a.name.trim().length > 0);

  async function finish() {
    setSaving(true);
    const result = await completeOnboarding({
      displayName,
      currency,
      accounts: accounts
        .filter((a) => a.name.trim().length > 0)
        .map((a) => ({
          name: a.name,
          type: a.type,
          opening_balance: Number.parseFloat(a.opening_balance) || 0,
          is_spending: a.is_spending,
        })),
      habits: SUGGESTED_HABITS.filter((h) => selectedHabits.has(h.name)).map(
        (h) => ({ name: h.name, life_area: h.life_area }),
      ),
    });

    if (!result.ok) {
      toast.error(result.error);
      setSaving(false);
      return;
    }
    router.replace("/home");
    router.refresh();
  }

  const unusedSuggestions = SUGGESTED_ACCOUNTS.filter(
    (s) => !accounts.some((a) => a.name === s.name),
  );

  return (
    <div className="space-y-6">
      <StepDots step={step} total={3} />

      {step === 0 && (
        <Card className="shadow-card">
          <CardContent className="space-y-5 pt-6">
            <div className="space-y-1">
              <h2 className="font-display text-xl">What should we call you?</h2>
              <p className="text-sm text-muted-foreground">
                We&apos;ll use it to greet you each morning.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="name">Your name</Label>
              <Input
                id="name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="e.g. King"
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="currency">Currency</Label>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger id="currency" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {currencySymbol(c)} {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              className="w-full"
              disabled={!canProceedName}
              onClick={() => setStep(1)}
            >
              Continue
            </Button>
          </CardContent>
        </Card>
      )}

      {step === 1 && (
        <Card className="shadow-card">
          <CardContent className="space-y-5 pt-6">
            <div className="space-y-1">
              <h2 className="font-display text-xl">Your accounts</h2>
              <p className="text-sm text-muted-foreground">
                Add where your money lives and its current balance. Savings and
                emergency funds don&apos;t count toward spendable money.
              </p>
            </div>

            <div className="space-y-3">
              {accounts.map((a) => (
                <div
                  key={a.id}
                  className="rounded-xl border border-border bg-background/60 p-3 space-y-3"
                >
                  <div className="flex items-center gap-2">
                    <Input
                      value={a.name}
                      onChange={(e) =>
                        updateAccount(a.id, { name: e.target.value })
                      }
                      placeholder="Account name"
                      className="flex-1"
                      aria-label="Account name"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeAccount(a.id)}
                      aria-label={`Remove ${a.name || "account"}`}
                    >
                      <Trash2Icon className="size-4" />
                    </Button>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Select
                      value={a.type}
                      onValueChange={(v) =>
                        updateAccount(a.id, { type: v as AccountType })
                      }
                    >
                      <SelectTrigger className="w-32" aria-label="Account type">
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
                    <div className="relative flex-1 min-w-[8rem]">
                      <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted-foreground">
                        {sym}
                      </span>
                      <Input
                        value={a.opening_balance}
                        onChange={(e) =>
                          updateAccount(a.id, {
                            opening_balance: e.target.value.replace(
                              /[^0-9.]/g,
                              "",
                            ),
                          })
                        }
                        placeholder="0.00"
                        inputMode="decimal"
                        className="pl-7 tnum"
                        aria-label="Opening balance"
                      />
                    </div>
                  </div>
                  <label className="flex items-center justify-between gap-2 text-sm">
                    <span className="text-muted-foreground">
                      Counts as spending money
                    </span>
                    <Switch
                      checked={a.is_spending}
                      onCheckedChange={(v) =>
                        updateAccount(a.id, { is_spending: v })
                      }
                    />
                  </label>
                </div>
              ))}
            </div>

            {unusedSuggestions.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {unusedSuggestions.map((s) => (
                  <button
                    key={s.name}
                    type="button"
                    onClick={() => addSuggestedAccount(s.name)}
                    className="inline-flex items-center gap-1 rounded-full border border-dashed border-border px-3 py-1 text-xs text-muted-foreground transition-colors hover:border-brand hover:text-brand"
                  >
                    <PlusIcon className="size-3" /> {s.name}
                  </button>
                ))}
              </div>
            )}

            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() =>
                setAccounts((prev) => [
                  ...prev,
                  {
                    id: nextId(),
                    name: "",
                    type: "cash",
                    opening_balance: "",
                    is_spending: true,
                  },
                ])
              }
            >
              <PlusIcon className="size-4" /> Add custom account
            </Button>

            <div className="flex gap-2">
              <Button
                variant="ghost"
                className="flex-1"
                onClick={() => setStep(0)}
              >
                Back
              </Button>
              <Button
                className="flex-1"
                disabled={!canProceedAccounts}
                onClick={() => setStep(2)}
              >
                Continue
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <Card className="shadow-card">
          <CardContent className="space-y-5 pt-6">
            <div className="space-y-1">
              <h2 className="font-display text-xl">Pick a few habits</h2>
              <p className="text-sm text-muted-foreground">
                Choose what you want to track. You can change these anytime.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {SUGGESTED_HABITS.map((h) => {
                const active = selectedHabits.has(h.name);
                const area = LIFE_AREA_MAP[h.life_area];
                return (
                  <button
                    key={h.name}
                    type="button"
                    onClick={() => toggleHabit(h.name)}
                    aria-pressed={active}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-all",
                      active
                        ? "border-transparent text-primary-foreground shadow-soft"
                        : "border-border bg-background text-foreground hover:border-brand/60",
                    )}
                    style={active ? { backgroundColor: area.color } : undefined}
                  >
                    {active && <CheckIcon className="size-3.5" />}
                    {h.name}
                  </button>
                );
              })}
            </div>

            <p className="text-xs text-muted-foreground">
              {selectedHabits.size} selected
            </p>

            <div className="flex gap-2">
              <Button
                variant="ghost"
                className="flex-1"
                onClick={() => setStep(1)}
                disabled={saving}
              >
                Back
              </Button>
              <Button className="flex-1" onClick={finish} disabled={saving}>
                {saving && (
                  <Loader2Icon className="size-4 animate-spin" aria-hidden />
                )}
                Finish setup
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function StepDots({ step, total }: { step: number; total: number }) {
  return (
    <div className="flex items-center justify-center gap-2">
      {Array.from({ length: total }).map((_, i) => (
        <span
          key={i}
          className={cn(
            "h-1.5 rounded-full transition-all",
            i === step ? "w-6 bg-brand" : "w-1.5 bg-border",
          )}
        />
      ))}
    </div>
  );
}
