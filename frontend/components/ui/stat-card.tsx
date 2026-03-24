import type { ReactNode } from "react";

import { Card } from "@/components/ui/card";

export function StatCard({
  label,
  value,
  hint,
  icon,
}: {
  label: string;
  value: string;
  hint: string;
  icon: ReactNode;
}) {
  return (
    <Card className="relative overflow-hidden">
      <div className="absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(143,242,203,0.45),transparent)]" />
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-[var(--foreground-subtle)]">{label}</p>
          <p className="mt-4 text-3xl font-semibold tracking-tight text-[var(--foreground)]">
            {value}
          </p>
          <p className="mt-3 text-sm leading-6 text-[var(--foreground-muted)]">{hint}</p>
        </div>
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] text-[var(--primary)]">
          {icon}
        </div>
      </div>
    </Card>
  );
}
