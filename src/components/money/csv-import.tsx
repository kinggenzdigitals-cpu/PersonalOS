"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  UploadIcon,
  Loader2Icon,
  AlertTriangleIcon,
  CheckCircle2Icon,
  FileSpreadsheetIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Money } from "@/components/ui/money";
import { useReference } from "@/components/providers/reference-provider";
import { useCurrency } from "@/components/providers/profile-provider";
import {
  parseCsv,
  autoDetectColumns,
  buildRows,
  inferDayFirst,
  type CsvTable,
  type ColumnMap,
  type ParsedRow,
  type RowError,
} from "@/lib/csv";
import {
  suggestCategoryName,
  resolveCategory,
} from "@/lib/transaction-parser";
import { importTransactions } from "@/app/(app)/money/import-actions";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type Step = "upload" | "map" | "done";

const FIELDS: { key: keyof ColumnMap; label: string; hint: string }[] = [
  { key: "date", label: "Date", hint: "Required" },
  { key: "description", label: "Description", hint: "Merchant or details" },
  { key: "amount", label: "Amount", hint: "One signed column" },
  { key: "debit", label: "Debit / withdrawal", hint: "If split in two" },
  { key: "credit", label: "Credit / deposit", hint: "If split in two" },
  { key: "reference", label: "Reference no.", hint: "Optional" },
];

export function CsvImport() {
  const router = useRouter();
  const { accounts, expenseCategories, incomeCategories } = useReference();
  const currency = useCurrency();

  const [step, setStep] = React.useState<Step>("upload");
  const [filename, setFilename] = React.useState<string | null>(null);
  const [table, setTable] = React.useState<CsvTable | null>(null);
  const [map, setMap] = React.useState<ColumnMap | null>(null);
  const [accountId, setAccountId] = React.useState(accounts[0]?.id ?? "");
  const [dayFirst, setDayFirst] = React.useState(false);
  const [expenseIsNegative, setExpenseIsNegative] = React.useState(true);
  const [autoCategory, setAutoCategory] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [summary, setSummary] = React.useState<{
    imported: number;
    skipped: number;
  } | null>(null);

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("That file is over 5MB. Split it into smaller exports.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const parsed = parseCsv(String(reader.result ?? ""));
      if (parsed.headers.length === 0 || parsed.rows.length === 0) {
        toast.error(
          parsed.warning ?? "Couldn't find any rows in that file.",
        );
        return;
      }
      // A malformed file can still parse into *some* rows — say so loudly
      // rather than letting the user import a silently truncated statement.
      if (parsed.warning) toast.warning(parsed.warning, { duration: 10000 });
      const detected = autoDetectColumns(parsed.headers);
      setTable(parsed);
      setMap(detected);
      setFilename(file.name);
      if (detected.date !== null) {
        setDayFirst(
          inferDayFirst(parsed.rows.map((r) => r[detected.date as number])),
        );
      }
      setStep("map");
    };
    reader.onerror = () => toast.error("Couldn't read that file.");
    reader.readAsText(file);
  }

  // Preview is derived, never stored — changing a mapping re-derives instantly.
  const preview: { rows: ParsedRow[]; errors: RowError[] } = React.useMemo(() => {
    if (!table || !map || !accountId) return { rows: [], errors: [] };
    return buildRows(table, map, { accountId, dayFirst, expenseIsNegative });
  }, [table, map, accountId, dayFirst, expenseIsNegative]);

  function categoryFor(row: ParsedRow): string | null {
    if (!autoCategory) return null;
    const pool = row.type === "expense" ? expenseCategories : incomeCategories;
    return resolveCategory(suggestCategoryName(row.description), pool)?.id ?? null;
  }

  async function runImport() {
    if (!accountId) return toast.error("Choose an account.");
    if (preview.rows.length === 0) return toast.error("Nothing to import.");
    setBusy(true);
    const result = await importTransactions({
      accountId,
      filename,
      rows: preview.rows.map((r) => ({
        date: r.date,
        description: r.description,
        amount: r.amount,
        type: r.type,
        categoryId: categoryFor(r),
        fingerprint: r.fingerprint,
        reference: r.reference,
      })),
    });
    setBusy(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setSummary({
      imported: result.imported,
      skipped: result.skippedDuplicates,
    });
    setStep("done");
    router.refresh();
  }

  // ---- Upload ------------------------------------------------------------
  if (step === "upload") {
    return (
      <div className="rounded-xl border border-border bg-card p-6 shadow-soft">
        <div className="mx-auto max-w-md text-center">
          <span className="mx-auto grid size-12 place-items-center rounded-full bg-secondary text-muted-foreground">
            <FileSpreadsheetIcon className="size-6" aria-hidden />
          </span>
          <h2 className="mt-3 font-display text-lg">Import a statement</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Upload a CSV exported from your bank or e-wallet. You&rsquo;ll
            confirm which columns are which before anything is saved.
          </p>

          <label className="mt-5 block">
            <input
              type="file"
              accept=".csv,text/csv,text/plain"
              onChange={onFile}
              className="sr-only"
            />
            <span className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-brand px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-brand-hover">
              <UploadIcon className="size-4" aria-hidden />
              Choose CSV file
            </span>
          </label>

          <p className="mt-4 text-xs text-muted-foreground">
            Nothing is uploaded to a server — the file is read in your browser,
            and only the rows you confirm are saved. Re-importing the same
            statement won&rsquo;t create duplicates.
          </p>
        </div>
      </div>
    );
  }

  // ---- Done --------------------------------------------------------------
  if (step === "done" && summary) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 text-center shadow-soft">
        <span className="mx-auto grid size-12 place-items-center rounded-full bg-success/10 text-success">
          <CheckCircle2Icon className="size-6" aria-hidden />
        </span>
        <h2 className="mt-3 font-display text-lg">Import complete</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Added <span className="font-medium text-foreground">{summary.imported}</span>{" "}
          transaction{summary.imported === 1 ? "" : "s"}
          {summary.skipped > 0 && (
            <> · skipped {summary.skipped} already imported</>
          )}
          .
        </p>
        <div className="mt-5 flex justify-center gap-2">
          <Button
            variant="outline"
            onClick={() => {
              setStep("upload");
              setTable(null);
              setMap(null);
              setSummary(null);
              setFilename(null);
            }}
          >
            Import another
          </Button>
          <Button onClick={() => router.push("/money/transactions")}>
            View transactions
          </Button>
        </div>
      </div>
    );
  }

  // ---- Map + preview -----------------------------------------------------
  if (!table || !map) return null;
  const usingPair = map.debit !== null || map.credit !== null;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-card p-4 shadow-soft">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm">
            <span className="font-medium">{filename}</span>{" "}
            <span className="text-muted-foreground">
              · {table.rows.length} rows
            </span>
          </p>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setStep("upload");
              setTable(null);
              setMap(null);
            }}
          >
            Choose a different file
          </Button>
        </div>

        <div className="mt-4 space-y-1.5">
          <Label>Import into account</Label>
          <Select value={accountId} onValueChange={setAccountId}>
            <SelectTrigger className="w-full sm:w-72">
              <SelectValue placeholder="Choose an account" />
            </SelectTrigger>
            <SelectContent>
              {accounts.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <p className="mt-4 mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Match your columns
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          {FIELDS.map((f) => (
            <div key={f.key} className="space-y-1">
              <Label className="text-xs">
                {f.label}{" "}
                <span className="font-normal text-muted-foreground">
                  · {f.hint}
                </span>
              </Label>
              <Select
                value={map[f.key] === null ? "none" : String(map[f.key])}
                onValueChange={(v) =>
                  setMap({ ...map, [f.key]: v === "none" ? null : Number(v) })
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— not in this file —</SelectItem>
                  {table.headers.map((h, i) => (
                    <SelectItem key={i} value={String(i)}>
                      {h || `Column ${i + 1}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>

        <div className="mt-4 space-y-3">
          <Toggle
            id="day-first"
            label="Dates are day/month (e.g. 05/03 = 5 March)"
            hint="Ignored for unambiguous dates."
            checked={dayFirst}
            onChange={setDayFirst}
          />
          {!usingPair && (
            <Toggle
              id="neg-expense"
              label="Negative amounts are money out"
              hint="Turn off if your bank shows spending as positive."
              checked={expenseIsNegative}
              onChange={setExpenseIsNegative}
            />
          )}
          <Toggle
            id="auto-cat"
            label="Suggest categories automatically"
            hint="Uses the same matching as quick entry. You can edit any transaction after."
            checked={autoCategory}
            onChange={setAutoCategory}
          />
        </div>
      </div>

      {/* Preview */}
      <div className="rounded-xl border border-border bg-card p-4 shadow-soft">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="font-medium">Preview</p>
          <p className="text-xs text-muted-foreground">
            {preview.rows.length} ready
            {preview.errors.length > 0 && (
              <span className="text-warning">
                {" "}
                · {preview.errors.length} skipped
              </span>
            )}
          </p>
        </div>

        {preview.rows.length === 0 ? (
          <p className="mt-3 rounded-lg border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
            No rows could be read yet — check the Date and Amount mappings
            above.
          </p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="py-2 pr-3 font-medium">Date</th>
                  <th className="py-2 pr-3 font-medium">Description</th>
                  <th className="py-2 pr-3 font-medium">Category</th>
                  <th className="py-2 text-right font-medium">Amount</th>
                </tr>
              </thead>
              <tbody>
                {preview.rows.slice(0, 8).map((r) => {
                  const catId = categoryFor(r);
                  const pool =
                    r.type === "expense" ? expenseCategories : incomeCategories;
                  const cat = pool.find((c) => c.id === catId);
                  return (
                    <tr key={r.line} className="border-b border-border/50">
                      <td className="tnum py-2 pr-3 text-muted-foreground">
                        {r.date}
                      </td>
                      <td className="max-w-[22ch] truncate py-2 pr-3">
                        {r.description || "—"}
                      </td>
                      <td className="py-2 pr-3 text-xs text-muted-foreground">
                        {cat?.name ?? "—"}
                      </td>
                      <td
                        className={cn(
                          "tnum py-2 text-right",
                          r.type === "income" && "text-success",
                        )}
                      >
                        {r.type === "income" ? "+" : "−"}
                        <Money value={r.amount} currency={currency} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {preview.rows.length > 8 && (
              <p className="mt-2 text-xs text-muted-foreground">
                +{preview.rows.length - 8} more
              </p>
            )}
          </div>
        )}

        {preview.errors.length > 0 && (
          <details className="mt-3">
            <summary className="cursor-pointer text-xs text-warning">
              <AlertTriangleIcon className="mr-1 inline size-3.5" aria-hidden />
              {preview.errors.length} row
              {preview.errors.length === 1 ? "" : "s"} will be skipped
            </summary>
            <ul className="mt-2 space-y-0.5 text-xs text-muted-foreground">
              {preview.errors.slice(0, 10).map((e) => (
                <li key={e.line}>
                  Row {e.line}: {e.reason}
                </li>
              ))}
            </ul>
          </details>
        )}

        <Button
          className="mt-4 w-full"
          onClick={runImport}
          disabled={busy || preview.rows.length === 0 || !accountId}
        >
          {busy && <Loader2Icon className="size-4 animate-spin" aria-hidden />}
          Import {preview.rows.length} transaction
          {preview.rows.length === 1 ? "" : "s"}
        </Button>
      </div>
    </div>
  );
}

function Toggle({
  id,
  label,
  hint,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  hint: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
      <div className="min-w-0 space-y-0.5">
        <Label htmlFor={id} className="text-sm">
          {label}
        </Label>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
