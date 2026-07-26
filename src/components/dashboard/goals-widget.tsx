import Link from "next/link";
import { TargetIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Money } from "@/components/ui/money";

/** Compact savings-goal progress for the Today dashboard. Hidden if no goals. */
export async function GoalsWidget({ currency }: { currency: string }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("savings_goals")
    .select("target_amount, saved_amount")
    .eq("user_id", user.id);
  if (error || !data || data.length === 0) return null;

  const target = data.reduce((s, g) => s + Number(g.target_amount), 0);
  const saved = data.reduce((s, g) => s + Number(g.saved_amount), 0);
  const pct = target > 0 ? Math.round((saved / target) * 100) : 0;

  return (
    <Link href="/money/goals" className="block">
      <Card className="shadow-card transition-colors hover:bg-secondary/40">
        <CardContent className="space-y-2 pt-6">
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-1.5 font-medium">
              <TargetIcon className="size-4 text-accent-brand" /> Savings goals
            </span>
            <span className="tnum text-muted-foreground">{pct}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full rounded-full bg-accent-brand"
              style={{ width: `${Math.min(100, pct)}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            <Money value={saved} currency={currency} /> of{" "}
            <Money value={target} currency={currency} /> saved
          </p>
        </CardContent>
      </Card>
    </Link>
  );
}
