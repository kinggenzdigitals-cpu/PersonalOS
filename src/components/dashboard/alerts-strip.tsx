"use client";

import Link from "next/link";
import { useState } from "react";
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
  const [expanded, setExpanded] = useState(false);
  if (alerts.length === 0) return null;
  const priority = { error: 0, warning: 1, info: 2 };
  const sorted = [...alerts].sort((a, b) => priority[a.level] - priority[b.level]);
  const visible = expanded ? sorted : sorted.slice(0, 3);

  return (
    <div className="space-y-2">
      {visible.map((alert, i) => {
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
      {alerts.length > 3 && (
        <button
          type="button"
          aria-expanded={expanded}
          onClick={() => setExpanded(!expanded)}
          className="min-h-11 rounded-lg px-3 text-sm font-medium underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {expanded ? "Show fewer alerts" : `Show ${alerts.length - 3} more alerts`}
        </button>
      )}
    </div>
  );
}
