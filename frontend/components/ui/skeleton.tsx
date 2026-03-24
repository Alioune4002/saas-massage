import { cn } from "@/lib/utils";

export function Skeleton({
  className,
}: {
  className?: string;
}) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-2xl bg-[linear-gradient(90deg,var(--surface-muted),var(--background-soft),var(--surface-muted))]",
        className
      )}
    />
  );
}
