import { ShieldCheckIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { SecurityHistory as SecurityHistoryData } from "@/lib/queries/security";

const EVENT_LABELS: Record<string, string> = {
  login_success: "Signed in",
  password_changed: "Password changed",
  data_exported: "Personal data downloaded",
  tracking_data_deleted: "Tracking data deleted",
};

export function SecurityHistory({
  history,
}: {
  history: SecurityHistoryData;
}) {
  return (
    <Card className="shadow-card">
      <CardContent className="space-y-4 pt-6">
        <div className="flex items-start gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-success/15 text-success">
            <ShieldCheckIcon className="size-4" aria-hidden />
          </span>
          <div>
            <p className="text-sm font-medium">Login &amp; security history</p>
            <p className="text-xs text-muted-foreground">
              Review recent sign-ins and sensitive account actions.
            </p>
          </div>
        </div>

        {!history.available ? (
          <p className="rounded-xl border border-dashed border-border p-3 text-sm text-muted-foreground">
            Security history will appear after the latest database update.
          </p>
        ) : history.events.length === 0 ? (
          <p className="text-sm text-muted-foreground">No security events yet.</p>
        ) : (
          <div className="divide-y divide-border rounded-xl border border-border">
            {history.events.map((event) => {
              const provider =
                typeof event.metadata.provider === "string"
                  ? event.metadata.provider
                  : null;
              return (
                <div
                  key={event.id}
                  className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm"
                >
                  <div>
                    <p className="font-medium">
                      {EVENT_LABELS[event.event_type] ?? event.event_type}
                    </p>
                    {provider && (
                      <p className="text-xs capitalize text-muted-foreground">
                        {provider}
                      </p>
                    )}
                  </div>
                  <time className="shrink-0 text-xs text-muted-foreground">
                    {new Date(event.created_at).toLocaleString("en-PH", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </time>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
