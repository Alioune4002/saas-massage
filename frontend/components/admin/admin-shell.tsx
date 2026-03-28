"use client";

import type { ReactNode } from "react";
import { useMemo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  LifeBuoy,
  Megaphone,
  ShieldAlert,
  SlidersHorizontal,
  Star,
  Users,
} from "lucide-react";

import { NuadyxLogo } from "@/components/brand/nuadyx-logo";
import { Card } from "@/components/ui/card";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { cn } from "@/lib/utils";

type NavItem = {
  href: string;
  label: string;
  description: string;
  icon: typeof Users;
  capability:
    | "dashboard"
    | "users"
    | "moderation"
    | "campaigns"
    | "analytics"
    | "support"
    | "ranking"
    | "settings";
};

const NAV_ITEMS: NavItem[] = [
  {
    href: "/admin",
    label: "Dashboard global",
    description: "Vue immédiate de la plateforme, des volumes et des villes actives.",
    icon: BarChart3,
    capability: "dashboard",
  },
  {
    href: "/admin/users",
    label: "Utilisateurs & praticiens",
    description: "Accès aux comptes, statuts, profils publics, incidents et revenus.",
    icon: Users,
    capability: "users",
  },
  {
    href: "/admin/moderation",
    label: "Modération",
    description: "Signalements, restrictions, sanctions et registre de risque.",
    icon: ShieldAlert,
    capability: "moderation",
  },
  {
    href: "/admin/campaigns",
    label: "Campagnes marketing",
    description: "Campagnes ville, email, acquisition et suivi des volumes.",
    icon: Megaphone,
    capability: "campaigns",
  },
  {
    href: "/admin/analytics",
    label: "Analytics",
    description: "Trafic, conversions, profils actifs, villes et performance.",
    icon: BarChart3,
    capability: "analytics",
  },
  {
    href: "/admin/support",
    label: "Support",
    description: "Messages in-app, annonces, suivi de lecture et conversations.",
    icon: LifeBuoy,
    capability: "support",
  },
  {
    href: "/admin/ranking",
    label: "Classement & visibilité",
    description: "Signaux de visibilité, scores et réglages de mise en avant.",
    icon: Star,
    capability: "ranking",
  },
  {
    href: "/admin/settings",
    label: "Paramètres plateforme",
    description: "État Stripe, règles de dépôt, flags et configuration produit.",
    icon: SlidersHorizontal,
    capability: "settings",
  },
];

function isActivePath(pathname: string, href: string) {
  if (href === "/admin") {
    return pathname === "/admin";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AdminShell({
  title,
  description,
  capabilities,
  adminIdentity,
  children,
}: {
  title: string;
  description: string;
  capabilities?: Record<string, boolean>;
  adminIdentity?: {
    email: string;
    adminRole: string;
    isSuperuser: boolean;
  };
  children: ReactNode;
}) {
  const pathname = usePathname();

  const visibleItems = useMemo(() => {
    if (!capabilities) {
      return NAV_ITEMS;
    }
    return NAV_ITEMS.filter((item) => capabilities[item.capability] !== false);
  }, [capabilities]);

  return (
    <main className="min-h-screen overflow-x-clip px-3 py-3 md:px-5 md:py-5">
      <div className="mx-auto grid max-w-[1600px] gap-5 xl:grid-cols-[280px_minmax(0,1fr)]">
        <Card className="self-start rounded-[2rem] p-4 md:p-5 xl:sticky xl:top-5">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <NuadyxLogo showText compact />
              <p className="mt-3 text-xs uppercase tracking-[0.32em] text-[var(--primary)]/80">
                Back-office NUADYX
              </p>
              <p className="mt-2 text-sm leading-6 text-[var(--foreground-muted)]">
                Centre de pilotage plateforme, acquisition, modération et support.
              </p>
              {adminIdentity ? (
                <div className="mt-4 rounded-[1.2rem] border border-[var(--border)] bg-[var(--background-soft)] px-3 py-3 text-sm text-[var(--foreground-muted)]">
                  <p className="break-words font-medium text-[var(--foreground)]">
                    {adminIdentity.email}
                  </p>
                  <p className="mt-1 break-words">
                    {adminIdentity.isSuperuser
                      ? "superuser"
                      : `admin_role · ${adminIdentity.adminRole || "admin"}`}
                  </p>
                </div>
              ) : null}
            </div>
            <ThemeToggle />
          </div>

          <nav className="mt-6 space-y-2">
            {visibleItems.map((item) => {
              const active = isActivePath(pathname, item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex min-w-0 items-start gap-3 rounded-[1.3rem] border px-4 py-3 transition",
                    active
                      ? "border-[var(--primary)] bg-[var(--primary)]/8"
                      : "border-[var(--border)] bg-[var(--background-soft)] hover:border-[var(--border-strong)]"
                  )}
                >
                  <span className="mt-0.5 shrink-0 rounded-full bg-[var(--background)] p-2 text-[var(--primary)] shadow-sm">
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block break-words font-medium text-[var(--foreground)]">
                      {item.label}
                    </span>
                    <span className="mt-1 block break-words text-sm leading-6 text-[var(--foreground-muted)]">
                      {item.description}
                    </span>
                  </span>
                </Link>
              );
            })}
          </nav>

          <div className="mt-6 grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
            <Link
              href="/ops"
              className="rounded-[1.2rem] border border-[var(--border)] bg-[var(--background-soft)] px-4 py-3 text-sm text-[var(--foreground)] transition hover:border-[var(--border-strong)]"
            >
              Acquisition annuaire
            </Link>
            <Link
              href="/dashboard"
              className="rounded-[1.2rem] border border-[var(--border)] bg-[var(--background-soft)] px-4 py-3 text-sm text-[var(--foreground)] transition hover:border-[var(--border-strong)]"
            >
              Retour espace praticien
            </Link>
          </div>
        </Card>

        <div className="min-w-0 space-y-5">
          <Card className="rounded-[2rem] p-5 md:p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <p className="text-xs uppercase tracking-[0.3em] text-[var(--primary)]/80">
                  Pilotage admin
                </p>
                <h1 className="mt-3 break-words text-3xl font-semibold tracking-tight text-[var(--foreground)] md:text-4xl">
                  {title}
                </h1>
                <p className="mt-3 max-w-4xl break-words text-sm leading-7 text-[var(--foreground-muted)]">
                  {description}
                </p>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 lg:min-w-[260px]">
                <Link
                  href="/admin/support"
                  className="rounded-[1.2rem] border border-[var(--border)] bg-[var(--background-soft)] px-4 py-3 text-sm text-[var(--foreground)] transition hover:border-[var(--border-strong)]"
                >
                  Messages plateforme
                </Link>
                <Link
                  href="/admin/ranking"
                  className="rounded-[1.2rem] border border-[var(--border)] bg-[var(--background-soft)] px-4 py-3 text-sm text-[var(--foreground)] transition hover:border-[var(--border-strong)]"
                >
                  Visibilité & scores
                </Link>
              </div>
            </div>
          </Card>

          {children}
        </div>
      </div>
    </main>
  );
}
