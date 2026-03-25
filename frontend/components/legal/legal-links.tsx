"use client";

import Link from "next/link";

import { LEGAL_LINKS } from "@/content/legal-documents";
import { COOKIE_PREFERENCES_EVENT } from "@/lib/cookie-consent";

export function LegalLinks({
  compact = false,
  className = "",
}: {
  compact?: boolean;
  className?: string;
}) {
  return (
    <div
      className={`flex flex-wrap gap-x-4 gap-y-2 text-sm text-[var(--foreground-muted)] ${className}`.trim()}
    >
      {LEGAL_LINKS.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className={compact ? "transition hover:text-[var(--foreground)]" : "transition hover:text-[var(--foreground)]"}
        >
          {link.label}
        </Link>
      ))}
      <button
        type="button"
        className="text-left transition hover:text-[var(--foreground)]"
        onClick={() => window.dispatchEvent(new Event(COOKIE_PREFERENCES_EVENT))}
      >
        Gérer mes cookies
      </button>
    </div>
  );
}
