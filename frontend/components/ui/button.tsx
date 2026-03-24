import type { ButtonHTMLAttributes, ReactNode } from "react";

import { cn } from "@/lib/utils";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  iconLeft?: ReactNode;
  iconRight?: ReactNode;
};

const variantClasses: Record<NonNullable<ButtonProps["variant"]>, string> = {
  primary:
    "bg-[linear-gradient(135deg,var(--primary),var(--accent))] text-[var(--primary-contrast)] shadow-[0_14px_30px_rgba(95,225,177,0.22)] hover:brightness-105",
  secondary:
    "border border-[var(--border)] bg-[var(--surface-muted)] text-[var(--foreground)] hover:border-[var(--border-strong)] hover:bg-[var(--background-soft)]",
  ghost:
    "text-[var(--foreground-muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--foreground)]",
  danger:
    "border border-[color:var(--danger)]/30 bg-[color:var(--danger)]/12 text-[color:var(--danger)] hover:bg-[color:var(--danger)]/18",
};

const sizeClasses: Record<NonNullable<ButtonProps["size"]>, string> = {
  sm: "h-10 rounded-2xl px-4 text-sm",
  md: "h-11 rounded-[1.1rem] px-4 text-sm",
  lg: "h-12 rounded-[1.25rem] px-5 text-sm",
};

export function Button({
  className,
  children,
  variant = "primary",
  size = "md",
  iconLeft,
  iconRight,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 whitespace-nowrap font-semibold outline-none ring-0",
        "disabled:translate-y-0 disabled:opacity-55",
        variantClasses[variant],
        sizeClasses[size],
        className
      )}
      {...props}
    >
      {iconLeft}
      {children}
      {iconRight}
    </button>
  );
}
