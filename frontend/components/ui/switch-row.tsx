"use client";

import { cn } from "@/lib/utils";

type SwitchRowProps = {
  label: string;
  description: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
};

export function SwitchRow({
  label,
  description,
  checked,
  onCheckedChange,
}: SwitchRowProps) {
  return (
    <button
      type="button"
      onClick={() => onCheckedChange(!checked)}
      className="flex w-full items-center justify-between gap-4 rounded-[1.35rem] border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-4 text-left"
      aria-pressed={checked}
    >
      <div>
        <p className="text-sm font-medium text-[var(--foreground)]">{label}</p>
        <p className="mt-1 text-sm leading-6 text-[var(--foreground-muted)]">
          {description}
        </p>
      </div>
      <span
        className={cn(
          "relative inline-flex h-7 w-12 shrink-0 rounded-full border transition-colors",
          checked
            ? "border-[var(--primary)]/45 bg-[var(--primary)]/24"
            : "border-[var(--border)] bg-[var(--background-soft)]"
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 h-5.5 w-5.5 rounded-full transition-transform",
            checked
              ? "translate-x-[1.35rem] bg-[var(--primary)]"
              : "translate-x-0.5 bg-[var(--foreground-subtle)]"
          )}
        />
      </span>
    </button>
  );
}
