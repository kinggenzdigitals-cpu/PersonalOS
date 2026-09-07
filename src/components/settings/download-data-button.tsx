"use client";

import * as React from "react";
import { DatabaseIcon, Loader2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { exportAllData } from "@/app/(app)/settings/actions";
import { toast } from "sonner";

/**
 * "Download my data" — a full JSON copy of everything the user owns. Available
 * on every plan; the server scopes it to the caller via RLS.
 */
export function DownloadDataButton() {
  const [busy, setBusy] = React.useState(false);

  async function download() {
    setBusy(true);
    try {
      const result = await exportAllData();
      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      const blob = new Blob([JSON.stringify(result.data, null, 2)], {
        type: "application/json;charset=utf-8;",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `finance-habit-tracker-data-${result.data.exportedAt.slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      const rows = Object.values(result.data.tables).reduce(
        (sum, t) => sum + t.length,
        0,
      );
      toast.success(`Downloaded ${rows} records`);
    } catch {
      toast.error("Couldn't prepare your download. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button variant="outline" onClick={download} disabled={busy}>
      {busy ? (
        <Loader2Icon className="size-4 animate-spin" aria-hidden />
      ) : (
        <DatabaseIcon className="size-4" aria-hidden />
      )}
      Download my data (JSON)
    </Button>
  );
}
