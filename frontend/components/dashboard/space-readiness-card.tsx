import Link from "next/link";
import { CheckCircle2, Circle, ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import type { SpaceChecklistItem } from "@/lib/practitioner-space";
import { cn } from "@/lib/utils";

type SpaceReadinessCardProps = {
  items: SpaceChecklistItem[];
};

export function SpaceReadinessCard({ items }: SpaceReadinessCardProps) {
  const completedItems = items.filter((item) => item.completed).length;

  return (
    <Card>
      <CardHeader
        title="Rendre mon espace prêt à recevoir"
        subtitle={`${
          items.length - completedItems
        } point${items.length - completedItems > 1 ? "s" : ""} encore à finaliser pour être pleinement réservable.`}
      />

      <div className="mt-6 space-y-3">
        {items.map((item) => (
          <div
            key={item.key}
            className={cn(
              "rounded-[1.4rem] border px-4 py-4",
              item.completed
                ? "border-[color:var(--success)]/24 bg-[color:var(--success)]/10"
                : "border-[var(--border)] bg-[var(--surface-muted)]"
            )}
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="flex items-center gap-3">
                  {item.completed ? (
                    <CheckCircle2 className="h-5 w-5 shrink-0 text-[color:var(--success)]" />
                  ) : (
                    <Circle className="h-5 w-5 shrink-0 text-[var(--foreground-subtle)]" />
                  )}
                  <p className="text-sm font-semibold text-[var(--foreground)]">
                    {item.label}
                  </p>
                </div>
                <p className="mt-2 text-sm leading-6 text-[var(--foreground-muted)]">
                  {item.description}
                </p>
              </div>

              <Link href={item.href} className="shrink-0">
                <Button
                  variant={item.completed ? "secondary" : "primary"}
                  size="sm"
                  iconRight={<ArrowRight className="h-4 w-4" />}
                >
                  {item.ctaLabel}
                </Button>
              </Link>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
