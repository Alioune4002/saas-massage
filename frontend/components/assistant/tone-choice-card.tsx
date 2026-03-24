"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type ToneChoiceCardProps = {
  label: string;
  description: string;
  selected: boolean;
  onSelect: () => void;
};

export function ToneChoiceCard({
  label,
  description,
  selected,
  onSelect,
}: ToneChoiceCardProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "w-full rounded-[1.5rem] border p-4 text-left",
        selected
          ? "border-[var(--primary)]/40 bg-[var(--surface-muted)]"
          : "border-[var(--border)] bg-[var(--background-soft)]"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-base font-semibold text-[var(--foreground)]">{label}</p>
          <p className="mt-2 text-sm leading-6 text-[var(--foreground-muted)]">
            {description}
          </p>
        </div>
        {selected ? <Badge tone="success">Actif</Badge> : null}
      </div>
    </button>
  );
}
