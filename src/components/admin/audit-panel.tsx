"use client";

import * as React from "react";
import { ScrollTextIcon, ShieldIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";
import type { AuditEntry } from "@/lib/admin/audit";

/** Colour-code the destructive actions so they stand out when skimming. */
function toneFor(action: string): string {
  if (
    action.includes("revoked") ||
    action.includes("suspended") ||
    action.includes("delete") ||
    action.includes("reset_password")
  ) {
    return "bg-error/10 text-error";
  }
  if (action.includes("grant") || action.includes("accepted")) {
    return "bg-success/10 text-success";
  }
  return "bg-secondary text-muted-foreground";
}

function humanise(action: string): string {
  return action.replace(/_/g, " ");
}

/**
 * Fixed locale + timezone so the server and browser renders agree, and safe
 * against a malformed timestamp (which would otherwise throw during render).
 */
function auditTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "unknown time";
  return d.toLocaleString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "UTC",
  });
}

export function AuditPanel({ entries }: { entries: AuditEntry[] }) {
  const [q, setQ] = React.useState("");

  const filtered = entries.filter((e) => {
    if (!q.trim()) return true;
    const needle = q.toLowerCase();
    return (
      e.action.toLowerCase().includes(needle) ||
      e.adminLabel.toLowerCase().includes(needle) ||
      (e.targetLabel ?? "").toLowerCase().includes(needle)
    );
  });

  if (entries.length === 0) {
    return (
      <EmptyState
        icon={ScrollTextIcon}
        title="No admin activity yet"
        description="Privileged actions — granting access, suspending accounts, resetting passwords, sending invitations — are recorded here."
        className="py-10"
      />
    );
  }

  return (
    <div className="space-y-3">
      <Input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search by action, admin, or target…"
        aria-label="Search audit log"
      />

      <p className="text-xs text-muted-foreground">
        {filtered.length} of {entries.length}{" "}
        {entries.length === 1 ? "entry" : "entries"} · newest first
      </p>

      <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card shadow-soft">
        {filtered.map((e) => (
          <li key={e.id} className="space-y-1.5 px-3 py-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-[11px] font-medium capitalize",
                  toneFor(e.action),
                )}
              >
                {humanise(e.action)}
              </span>
              <span className="text-xs text-muted-foreground">
                {auditTime(e.createdAt)} UTC
              </span>
            </div>

            <p className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
              <ShieldIcon className="size-3.5 shrink-0" aria-hidden />
              <span className="font-medium text-foreground">
                {e.adminLabel}
              </span>
              {e.targetLabel && (
                <>
                  <span>→</span>
                  <span className="font-medium text-foreground">
                    {e.targetLabel}
                  </span>
                </>
              )}
            </p>

            {e.detail && (
              <pre className="overflow-x-auto rounded-lg bg-secondary/50 px-2 py-1.5 text-[11px] text-muted-foreground">
                {JSON.stringify(e.detail)}
              </pre>
            )}
          </li>
        ))}
      </ul>

      {filtered.length === 0 && (
        <p className="py-6 text-center text-sm text-muted-foreground">
          No entries match &ldquo;{q}&rdquo;.
        </p>
      )}
    </div>
  );
}
