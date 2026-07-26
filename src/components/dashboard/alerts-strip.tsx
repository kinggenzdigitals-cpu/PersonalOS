"use client";

import Link from "next/link";
import {
  AlertTriangleIcon,
  AlertCircleIcon,
  InfoIcon,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { maskAmountsInText } from "@/lib/format";
import { usePrivacyHidden } from "@/components/ui/money";

export type AlertLevel = "info" | "warning" | "error";

export type DashboardAlert = {
  level: AlertLevel;
  text: string;
  href?: string;
};

const LEVEL: Record<
  AlertLevel,
  { icon: LucideIcon; className: string }
> = {
  info: { icon: InfoIcon, className: "bg-secondary text-foreground" },
  warning: {
    icon: AlertTriangleIcon,
    className: "bg-warning/10 text-warning",
  },
  error: { icon: AlertCircleIcon, className: "bg-error/10 text-error" },
};

export function AlertsStrip({ alerts }: { alerts: DashboardAlert[] }) {
  const hidden = usePrivacyHidden();
  if (alerts.length === 0) return null;

  return (
    <div className="space-y-2">
      {alerts.map((alert, i) => {
        const meta = LEVEL[alert.level];
        const Icon = meta.icon;
        const body = (
          <div
            className={cn(
              "flex items-center gap-2 rounded-xl px-3 py-2 text-sm",
              meta.className,
            )}
          >
            <Icon className="size-4 shrink-0" aria-hidden />
            <span className="flex-1">
              {hidden ? maskAmountsInText(alert.text) : alert.text}
            </span>
          </div>
        );
        return alert.href ? (
          <Link key={i} href={alert.href} className="block">
            {body}
          </Link>
        ) : (
          <div key={i}>{body}</div>
        );
      })}
    </div>
  );
}
