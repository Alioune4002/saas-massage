import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";

import { cn } from "@/lib/utils";

type FieldWrapperProps = {
  label: string;
  hint?: string;
  children: ReactNode;
};

export function FieldWrapper({ label, hint, children }: FieldWrapperProps) {
  return (
    <label className="block space-y-2">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-[var(--foreground)]">{label}</span>
        {hint ? (
          <span className="text-xs text-[var(--foreground-subtle)]">{hint}</span>
        ) : null}
      </div>
      {children}
    </label>
  );
}

const fieldClassName =
  "w-full rounded-[1.15rem] border border-[var(--border)] bg-[var(--background-soft)] px-4 py-3 text-sm text-[var(--foreground)] shadow-[var(--field-shadow)] outline-none placeholder:text-[var(--foreground-subtle)] focus:border-[var(--border-strong)] focus:bg-[var(--surface-strong)]";

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(fieldClassName, props.className)} {...props} />;
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(fieldClassName, "min-h-[120px] resize-y", props.className)}
      {...props}
    />
  );
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(fieldClassName, "appearance-none pr-10", props.className)}
      {...props}
    />
  );
}
