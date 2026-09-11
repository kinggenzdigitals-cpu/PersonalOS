"use client";

import * as React from "react";
import Image from "next/image";
import { KeyRoundIcon, LinkIcon, Loader2Icon, ShieldCheckIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { getSiteURL } from "@/lib/site";
import { friendlyAuthError } from "@/lib/auth-errors";

type Identity = {
  id?: string;
  provider?: string;
  identity_data?: { email?: string; email_verified?: boolean } | null;
};

export function SignInMethodsCard() {
  const [loading, setLoading] = React.useState(true);
  const [linking, setLinking] = React.useState(false);
  const [providers, setProviders] = React.useState<string[]>([]);

  React.useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const supabase = createClient();
        const [{ data: userData }, { data: identitiesData }] = await Promise.all([
          supabase.auth.getUser(),
          supabase.auth.getUserIdentities(),
        ]);
        const fromAppMetadata = Array.isArray(userData.user?.app_metadata?.providers)
          ? (userData.user.app_metadata.providers as unknown[])
              .filter((value): value is string => typeof value === "string")
          : [];
        const fromIdentities = ((identitiesData?.identities ?? []) as Identity[])
          .map((identity) => identity.provider)
          .filter((value): value is string => Boolean(value));
        if (alive) setProviders(Array.from(new Set([...fromAppMetadata, ...fromIdentities])));
      } catch {
        if (alive) setProviders([]);
      } finally {
        if (alive) setLoading(false);
      }
    }
    void load();
    return () => {
      alive = false;
    };
  }, []);

  const hasGoogle = providers.includes("google");
  const hasEmail = providers.includes("email");

  async function connectGoogle() {
    setLinking(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.linkIdentity({
        provider: "google",
        options: {
          redirectTo: `${getSiteURL()}/auth/callback?next=${encodeURIComponent("/account")}`,
          queryParams: { prompt: "select_account" },
        },
      });
      if (error) {
        toast.error(friendlyAuthError(error.message));
        setLinking(false);
      }
    } catch {
      toast.error(friendlyAuthError("Failed to fetch"));
      setLinking(false);
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-soft">
      <div className="space-y-1">
        <p className="flex items-center gap-2 text-sm font-medium">
          <ShieldCheckIcon className="size-4" aria-hidden /> Sign-in methods
        </p>
        <p className="text-xs text-muted-foreground">
          Connect Google and a Finance Tracker password to the same account. Google passwords are never visible to this app.
        </p>
      </div>

      <div className="mt-4 space-y-2 text-sm">
        <MethodRow
          icon={<Image src="/google-signin-g.svg" width={18} height={18} alt="" aria-hidden />}
          label="Google"
          value={loading ? "Checking…" : hasGoogle ? "Connected" : "Not connected"}
        />
        <MethodRow
          icon={<KeyRoundIcon className="size-4" aria-hidden />}
          label="Email password"
          value={loading ? "Checking…" : hasEmail ? "Available" : "Use Set password to enable"}
        />
      </div>

      {!loading && !hasGoogle && (
        <Button type="button" variant="outline" className="mt-4 w-full" onClick={connectGoogle} disabled={linking}>
          {linking ? <Loader2Icon className="size-4 animate-spin" aria-hidden /> : <LinkIcon className="size-4" aria-hidden />}
          Connect Google to this account
        </Button>
      )}
    </div>
  );
}

function MethodRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg bg-secondary/50 px-3 py-2">
      <span className="flex items-center gap-2">
        {icon}
        {label}
      </span>
      <span className="text-xs text-muted-foreground">{value}</span>
    </div>
  );
}
