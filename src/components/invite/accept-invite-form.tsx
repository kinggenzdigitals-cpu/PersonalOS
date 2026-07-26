"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2Icon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/ui/password-input";
import { acceptInvitation } from "@/app/invite/[token]/actions";

export function AcceptInviteForm({ token }: { token: string }) {
  const router = useRouter();
  const [password, setPassword] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    setBusy(true);
    const res = await acceptInvitation(token, password);
    if (!res.ok) {
      setError(res.error);
      setBusy(false);
      return;
    }
    toast.success("Welcome! Your account is ready — please sign in.");
    router.replace("/login?accepted=1");
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <PasswordInput
        placeholder="Create a password"
        autoComplete="new-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
      />
      <PasswordInput
        placeholder="Confirm password"
        autoComplete="new-password"
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        required
      />
      {error && <p className="text-xs text-error">{error}</p>}
      <Button type="submit" className="w-full" disabled={busy}>
        {busy && <Loader2Icon className="size-4 animate-spin" aria-hidden />}
        Accept invitation
      </Button>
    </form>
  );
}
