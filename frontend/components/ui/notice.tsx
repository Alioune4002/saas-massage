import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type NoticeProps = {
  tone?: "error" | "info" | "success";
  children: ReactNode;
  className?: string;
};

const toneStyles = {
  error: "border-[color:var(--danger)]/26 bg-[color:var(--danger)]/10 text-[color:var(--danger)]",
  info: "border-[color:var(--accent)]/22 bg-[color:var(--accent)]/10 text-[color:var(--accent)]",
  success: "border-[color:var(--success)]/24 bg-[color:var(--success)]/10 text-[color:var(--success)]",
};

export function Notice({
  tone = "info",
  children,
  className,
}: NoticeProps) {
  return (
    <div
      className={cn(
        "rounded-[1.25rem] border px-4 py-3 text-sm",
        toneStyles[tone],
        className
      )}
    >
      {children}
    </div>
  );
}
