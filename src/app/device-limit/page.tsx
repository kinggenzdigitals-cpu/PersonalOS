import Link from "next/link";
import type { Metadata } from "next";
import { ShieldAlertIcon } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { listCurrentUserDevices, MAX_ACTIVE_DEVICES } from "@/lib/devices";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DeviceList } from "@/components/account/device-list";

export const metadata: Metadata = { title: "Device limit" };

export default async function DeviceLimitPage() {
  await requireUser();
  const devices = await listCurrentUserDevices();

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col justify-center px-4 py-10">
      <Card className="shadow-card">
        <CardContent className="space-y-5 pt-6">
          <div className="space-y-2 text-center">
            <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-warning/10 text-warning">
              <ShieldAlertIcon className="size-6" />
            </span>
            <h1 className="font-display text-2xl tracking-tight">Device limit reached</h1>
            <p className="text-sm text-muted-foreground">
              Each account can stay signed in on up to {MAX_ACTIVE_DEVICES} active devices. Remove an old device, then continue signing in here.
            </p>
          </div>

          <DeviceList devices={devices} />

          <Button asChild className="w-full">
            <Link href="/api/devices/register">Continue sign in</Link>
          </Button>
          <form action="/auth/signout" method="post">
            <Button variant="outline" type="submit" className="w-full">
              Sign out instead
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}