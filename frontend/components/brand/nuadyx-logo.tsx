"use client";

import Image from "next/image";

import { useTheme } from "@/components/providers/theme-provider";
import { cn } from "@/lib/utils";

type NuadyxLogoProps = {
  className?: string;
  compact?: boolean;
  priority?: boolean;
  showText?: boolean;
  textClassName?: string;
};

const FULL_LOGO_BY_THEME = {
  dark: "/images/logo-dark.svg",
  light: "/images/logo-light.svg",
} as const;

const ICON_SOURCE = "/images/icon.jpg";

export function NuadyxLogo({
  className,
  compact = false,
  priority = false,
  showText = false,
  textClassName = "",
}: NuadyxLogoProps) {
  const { theme } = useTheme();
  const source = compact ? ICON_SOURCE : FULL_LOGO_BY_THEME[theme];
  const dimensions = compact
    ? { width: 130, height: 120 }
    : theme === "dark"
      ? { width: 673, height: 659 }
      : { width: 622, height: 638 };

  return (
    <div className={cn("inline-flex shrink-0 items-center gap-3", className)}>
      <div
        className={cn(
          "relative overflow-hidden rounded-[1.2rem] shadow-[var(--shadow-md)]",
          compact ? "h-11 w-11" : "h-12 w-12 md:h-13 md:w-13"
        )}
      >
        <Image
          src={source}
          alt="NUADYX"
          width={dimensions.width}
          height={dimensions.height}
          priority={priority}
          className="h-full w-full object-contain"
        />
      </div>

      {showText ? (
        <div className={cn("min-w-0", textClassName)}>
          <div className="max-w-[8.75rem] text-[0.56rem] uppercase leading-[1.25] tracking-[0.12em] text-[var(--primary)]/90 sm:max-w-none sm:text-[0.72rem] sm:tracking-[0.28em]">
            Annuaire massage & bien-être
          </div>
          <div className="max-w-[8.75rem] truncate text-sm font-semibold tracking-[0.14em] text-[var(--foreground)] sm:max-w-none sm:text-lg sm:tracking-[0.28em]">
            NUADYX
          </div>
        </div>
      ) : null}
    </div>
  );
}
