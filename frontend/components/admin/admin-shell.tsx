"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { NuadyxLogo } from "@/components/brand/nuadyx-logo";
import { Card } from "@/components/ui/card";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/ops", label: "Cockpit business", description: "Acquisition, annuaire, villes" },
  {
    href: "/admin/moderation",
    label: "Modération",
    description: "Signalements, risques, sanctions",
  },
  {
    href: "/admin/support",
    label: "Support",
    description: "Messages plateforme, annonces, suivi utilisateurs",
  },
  {
    href: "/admin/analytics",
    label: "Analytics",
    description: "KPI, conversions, volumes réels",
  },
];

export function AdminShell({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  const pathname = usePathname();

  return (
    <main className="min-h-screen px-4 py-4 md:px-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <Card className="rounded-[2rem] p-5 md:p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <NuadyxLogo showText compact />
              <p className="mt-4 text-xs uppercase tracking-[0.32em] text-[var(--primary)]/80">
                Admin NUADYX
              </p>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[var(--foreground)] md:text-4xl">
                {title}
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--foreground-muted)]">
                {description}
              </p>
            </div>
            <ThemeToggle />
          </div>

          <nav className="mt-6 grid gap-3 lg:grid-cols-4">
            {NAV_ITEMS.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "rounded-[1.4rem] border px-4 py-4 transition",
                    active
                      ? "border-[var(--primary)] bg-[var(--primary)]/8"
                      : "border-[var(--border)] bg-[var(--background-soft)] hover:border-[var(--border-strong)]"
                  )}
                >
                  <p className="font-medium text-[var(--foreground)]">{item.label}</p>
                  <p className="mt-2 text-sm leading-6 text-[var(--foreground-muted)]">
                    {item.description}
                  </p>
                </Link>
              );
            })}
          </nav>
        </Card>

        {children}
      </div>
    </main>
  );
}
