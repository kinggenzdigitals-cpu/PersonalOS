import Link from "next/link";
import { LockIcon, SparklesIcon, CheckIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

/**
 * Full-screen "this is a Pro feature" gate. Rendered in place of a locked
 * feature for Free-plan users. Links to Settings where the upgrade flow lives.
 */
export function ProGate({
  title,
  description,
  bullets = [],
}: {
  title: string;
  description: string;
  bullets?: string[];
}) {
  return (
    <Card className="shadow-card">
      <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
        <span className="grid size-12 place-items-center rounded-full bg-brand/15 text-brand">
          <LockIcon className="size-6" />
        </span>
        <div className="space-y-1.5">
          <span className="inline-block rounded-full bg-brand px-2.5 py-0.5 text-xs font-medium text-primary-foreground">
            Pro
          </span>
          <h2 className="font-display text-xl">{title}</h2>
          <p className="mx-auto max-w-sm text-sm text-muted-foreground">
            {description}
          </p>
        </div>

        {bullets.length > 0 && (
          <ul className="mx-auto space-y-2 text-left text-sm">
            {bullets.map((b) => (
              <li key={b} className="flex items-start gap-2.5">
                <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-success/15 text-success">
                  <CheckIcon className="size-3.5" />
                </span>
                {b}
              </li>
            ))}
          </ul>
        )}

        <Button asChild className="mt-1">
          <Link href="/settings">
            <SparklesIcon className="size-4" /> Upgrade to Pro
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
