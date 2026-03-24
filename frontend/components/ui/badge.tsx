import type { HTMLAttributes } from "react";

import { cn } from "@/lib/utils";

const toneClasses = {
  neutral: "border-[var(--border)] bg-[var(--surface-muted)] text-[var(--foreground-muted)]",
  success: "border-[color:var(--success)]/30 bg-[color:var(--success)]/12 text-[color:var(--success)]",
  warning: "border-[color:var(--warning)]/30 bg-[color:var(--warning)]/12 text-[color:var(--warning)]",
  danger: "border-[color:var(--danger)]/28 bg-[color:var(--danger)]/10 text-[color:var(--danger)]",
  info: "border-[color:var(--accent)]/24 bg-[color:var(--accent)]/10 text-[color:var(--accent)]",
};

type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  tone?: keyof typeof toneClasses;
};

export function Badge({
  className,
  tone = "neutral",
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium",
        toneClasses[tone],
        className
      )}
      {...props}
    />
  );
}
