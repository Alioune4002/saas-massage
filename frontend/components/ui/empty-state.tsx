import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export function EmptyState({
  eyebrow,
  title,
  description,
  actionLabel,
  onAction,
  icon,
}: {
  eyebrow: string;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  icon?: ReactNode;
}) {
  return (
    <Card className="soft-grid flex flex-col items-start gap-4 rounded-[2rem] border-dashed">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] text-[var(--primary)]">
        {icon}
      </div>
      <div>
        <p className="text-xs uppercase tracking-[0.28em] text-[var(--primary)]/80">
          {eyebrow}
        </p>
        <h3 className="mt-3 text-2xl font-semibold text-[var(--foreground)]">{title}</h3>
        <p className="mt-3 max-w-xl text-sm leading-6 text-[var(--foreground-muted)]">
          {description}
        </p>
      </div>
      {actionLabel && onAction ? (
        <Button onClick={onAction}>{actionLabel}</Button>
      ) : null}
    </Card>
  );
}
