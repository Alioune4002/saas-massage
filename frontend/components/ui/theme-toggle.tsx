"use client";

import { MoonStar, SunMedium } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useTheme } from "@/components/providers/theme-provider";

export function ThemeToggle({
  compact = false,
}: {
  compact?: boolean;
}) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <Button
      variant="secondary"
      size="md"
      className={compact ? "h-11 w-11 rounded-2xl px-0" : undefined}
      onClick={toggleTheme}
      aria-label={isDark ? "Activer le mode clair" : "Activer le mode sombre"}
      iconLeft={
        isDark ? (
          <SunMedium className="h-4.5 w-4.5" />
        ) : (
          <MoonStar className="h-4.5 w-4.5" />
        )
      }
    >
      {compact ? null : isDark ? "Mode clair" : "Mode sombre"}
    </Button>
  );
}
