"use client";

import { useCallback, useEffect, useState } from "react";
import { Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";

type BrowserInstallPromptEvent = Event & {
  prompt: () => void;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isStandaloneMode() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function InstallAppButton() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BrowserInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(isStandaloneMode());

  useEffect(() => {
    if (typeof window === "undefined") return;

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BrowserInstallPromptEvent);
    };

    const onAppInstalled = () => setInstalled(true);

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onAppInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onAppInstalled);
    };
  }, []);

  const installApp = useCallback(async () => {
    if (!deferredPrompt) return;
    setDeferredPrompt(null);
    deferredPrompt.prompt();
    const result = await deferredPrompt.userChoice;
    if (result.outcome === "accepted") {
      setInstalled(true);
    }
  }, [deferredPrompt]);

  if (installed) {
    return (
      <p className="text-center text-xs text-muted-foreground">
        App already installed.
      </p>
    );
  }

  return (
    <div className="space-y-1 text-center">
      <p className="text-center text-xs text-muted-foreground">
        Want faster access?
      </p>
      <Button
        variant="outline"
        size="sm"
        className="w-full"
        onClick={installApp}
        disabled={!deferredPrompt}
      >
        <Smartphone className="mr-2 size-4" aria-hidden />
        Install app
      </Button>
      {!deferredPrompt && (
        <p className="text-xs text-muted-foreground">
          On iPhone/iPad, use Safari → Share → Add to Home Screen.
        </p>
      )}
    </div>
  );
}
