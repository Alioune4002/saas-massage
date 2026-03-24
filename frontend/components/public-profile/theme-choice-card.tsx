import { Check } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { PublicProfileTheme } from "@/lib/public-profile";

type ThemeChoiceCardProps = {
  theme: PublicProfileTheme;
  selected: boolean;
  onSelect: () => void;
};

export function ThemeChoiceCard({
  theme,
  selected,
  onSelect,
}: ThemeChoiceCardProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "rounded-[1.45rem] border p-4 text-left",
        selected
          ? "border-[var(--primary)]/38 bg-[var(--surface-muted)]"
          : "border-[var(--border)] bg-[var(--background-soft)]"
      )}
    >
      <div
        className={cn(
          "h-28 rounded-[1.1rem] border border-[var(--border)] bg-gradient-to-br",
          theme.spotlightClassName
        )}
      />
      <div className="mt-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-base font-semibold text-[var(--foreground)]">
            {theme.label}
          </p>
          <p className="mt-1 text-sm leading-6 text-[var(--foreground-muted)]">
            {theme.description}
          </p>
        </div>
        {selected ? (
          <Badge tone="success" className="shrink-0">
            <Check className="mr-1 h-3.5 w-3.5" />
            Actif
          </Badge>
        ) : null}
      </div>
    </button>
  );
}
