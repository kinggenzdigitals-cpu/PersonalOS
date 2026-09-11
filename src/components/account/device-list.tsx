"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2Icon, MonitorSmartphoneIcon, SmartphoneIcon, XIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { removeDevice } from "@/app/(app)/account/device-actions";
import type { DeviceInfo } from "@/lib/devices";

function fmt(iso: string) {
  return new Date(iso).toLocaleString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function DeviceList({ devices }: { devices: DeviceInfo[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = React.useState<string | null>(null);

  if (devices.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-border py-5 text-center text-sm text-muted-foreground">
        Device tracking will appear here after your next sign-in.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {devices.map((device) => {
        const mobile = /mobile|android|iphone|ipad/i.test(device.user_agent ?? "");
        const Icon = mobile ? SmartphoneIcon : MonitorSmartphoneIcon;
        return (
          <div
            key={device.id}
            className={cn(
              "flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-3 py-2.5",
              device.current && "border-brand/40 bg-brand/5",
            )}
          >
            <div className="flex min-w-0 items-center gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-secondary text-muted-foreground">
                <Icon className="size-4" />
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  {device.name} {device.current && <span className="text-brand">· current</span>}
                </p>
                <p className="text-xs text-muted-foreground">Last used {fmt(device.last_seen_at)}</p>
              </div>
            </div>
            <Button
              size="sm"
              variant="ghost"
              disabled={busyId === device.id}
              onClick={async () => {
                setBusyId(device.id);
                const res = await removeDevice(device.id);
                setBusyId(null);
                if (!res.ok) return toast.error(res.error);
                toast.success(res.message);
                router.refresh();
              }}
            >
              {busyId === device.id ? (
                <Loader2Icon className="size-4 animate-spin" />
              ) : (
                <XIcon className="size-4" />
              )}
              Remove
            </Button>
          </div>
        );
      })}
    </div>
  );
}