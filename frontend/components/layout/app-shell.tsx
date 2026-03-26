"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  Bot,
  BookOpenCheck,
  CalendarClock,
  Globe2,
  LayoutDashboard,
  LogOut,
  Menu,
  Sparkles,
  Star,
  WalletCards,
  X,
} from "lucide-react";

import { NuadyxLogo } from "@/components/brand/nuadyx-logo";
import { useBackendStatus } from "@/components/providers/backend-status-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { Skeleton } from "@/components/ui/skeleton";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { useAuthSession } from "@/hooks/use-auth-session";
import { getBookings } from "@/lib/api";
import { fadeInUp } from "@/lib/motion";
import { BOOKINGS_UPDATED_EVENT } from "@/lib/practitioner-space";
import { cn, getInitials, getUserDisplayName } from "@/lib/utils";

const navigation = [
  {
    href: "/dashboard",
    label: "Vue d’ensemble",
    description: "Piloter l’activité au quotidien",
    icon: LayoutDashboard,
  },
  {
    href: "/services",
    label: "Mes prestations",
    description: "Prestations, durées et infos utiles",
    icon: Sparkles,
  },
  {
    href: "/availabilities",
    label: "Agenda",
    description: "Créneaux, rendez-vous et planning",
    icon: CalendarClock,
  },
  {
    href: "/bookings",
    label: "Réservations clients",
    description: "Demandes et suivi client",
    icon: BookOpenCheck,
  },
  {
    href: "/contacts",
    label: "Contacts / Clients",
    description: "Segments, notes privées et suivi relation",
    icon: Star,
  },
  {
    href: "/profil-public",
    label: "Mon profil public",
    description: "Page vitrine et réservation",
    icon: Globe2,
  },
  {
    href: "/payments",
    label: "Règlements",
    description: "Encaissements, versements et compte paiement",
    icon: WalletCards,
  },
  {
    href: "/reviews",
    label: "Avis clients",
    description: "Invitations, avis et clients de confiance",
    icon: Sparkles,
  },
  {
    href: "/assistant",
    label: "Mon assistant",
    description: "Réponses, consignes et ton métier",
    icon: Bot,
  },
];

const pageDescriptions: Record<string, string> = {
  "/dashboard": "Pilote ton activité de massage et de bien-être avec une lecture claire et rassurante.",
  "/services": "Présente tes prestations avec des durées lisibles et une page praticien claire.",
  "/availabilities": "Garde une lecture claire de la journée, des créneaux ouverts, des plages bloquées et des rendez-vous à venir.",
  "/bookings": "Retrouve les réservations clients et les décisions importantes au même endroit.",
  "/contacts": "Classe les clients, retrouve les habitués et garde des notes privées utiles pour ton suivi.",
  "/profil-public": "Prépare la page publique réservable qui présente ton univers et tes prestations.",
  "/payments": "Pilote les règlements, les acomptes, les versements à venir et la connexion de ton compte de paiement.",
  "/reviews": "Invite d'anciens clients, recueille des avis vérifiés et identifie tes clients de confiance.",
  "/assistant": "Prépare les réponses que ton assistant donnera plus tard à partir de ton activité, de tes prestations et de ton cadre d’accueil.",
};

function AppShellLoading() {
  return (
    <div className="min-h-screen px-4 py-4 text-[var(--foreground)] md:px-6">
      <div className="mx-auto flex max-w-[1600px] gap-4">
        <div className="glass-panel hidden w-[280px] rounded-[2rem] p-6 lg:block">
          <Skeleton className="h-12 w-44 rounded-2xl" />
          <div className="mt-8 space-y-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-16 w-full rounded-[1.5rem]" />
            ))}
          </div>
        </div>

        <div className="min-w-0 flex-1 space-y-4">
          <div className="glass-panel rounded-[2rem] p-5">
            <div className="flex items-center justify-between gap-4">
              <Skeleton className="h-12 w-48 rounded-2xl" />
              <Skeleton className="h-12 w-40 rounded-2xl" />
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-40 rounded-[1.75rem]" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading, error, logout } = useAuthSession();
  const { backendUnavailable } = useBackendStatus();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  useEffect(() => {
    if (!loading && user && !user.onboarding_completed) {
      router.replace("/bienvenue");
    }
  }, [loading, router, user]);

  useEffect(() => {
    if (!user?.onboarding_completed) {
      return;
    }

    let active = true;

    async function loadPendingBookings() {
      try {
        const pendingBookings = await getBookings("pending");
        if (active) {
          setPendingCount(pendingBookings.length);
        }
      } catch {
        if (active) {
          setPendingCount(0);
        }
      }
    }

    void loadPendingBookings();
    const intervalId = window.setInterval(loadPendingBookings, 45000);
    const handleBookingsUpdated = () => {
      void loadPendingBookings();
    };
    window.addEventListener(BOOKINGS_UPDATED_EVENT, handleBookingsUpdated);

    return () => {
      active = false;
      window.clearInterval(intervalId);
      window.removeEventListener(BOOKINGS_UPDATED_EVENT, handleBookingsUpdated);
    };
  }, [pathname, user]);

  if (loading) {
    return <AppShellLoading />;
  }

  if (!user || !user.onboarding_completed) {
    return null;
  }

  const currentItem =
    navigation.find((item) => item.href === pathname) ?? navigation[0];
  const displayName = getUserDisplayName(user);

  return (
    <div className="min-h-screen px-3 py-3 text-[var(--foreground)] md:px-5 md:py-5">
      <div className="mx-auto flex min-h-[calc(100vh-1.5rem)] max-w-[1600px] gap-4">
        <aside className="glass-panel hidden w-[290px] shrink-0 rounded-[2rem] p-5 lg:flex lg:flex-col">
          <NuadyxLogo className="mb-10 h-20 w-20" priority />

          <nav className="space-y-2">
            {navigation.map((item) => {
              const Icon = item.icon;
              const active = pathname === item.href;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    "group flex items-start gap-3 rounded-[1.4rem] px-4 py-3.5",
                    active
                      ? "bg-[var(--surface-muted)] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]"
                      : "hover:bg-[var(--surface-muted)]"
                  )}
                >
                  <div
                    className={cn(
                      "mt-0.5 flex h-10 w-10 items-center justify-center rounded-2xl border",
                      active
                        ? "border-[var(--primary)]/35 bg-[var(--primary)]/12 text-[var(--primary)]"
                        : "border-[var(--border)] bg-[var(--surface-muted)] text-[var(--foreground-subtle)]"
                    )}
                  >
                    <Icon className="h-4.5 w-4.5" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 font-medium text-[var(--foreground)]">
                      <span>{item.label}</span>
                      {item.href === "/bookings" && pendingCount > 0 ? (
                        <Badge tone="warning" className="shrink-0">
                          {pendingCount}
                        </Badge>
                      ) : null}
                    </div>
                    <div className="mt-1 text-sm leading-5 text-[var(--foreground-subtle)]">
                      {item.description}
                    </div>
                  </div>
                </Link>
              );
            })}
          </nav>

          <div className="mt-auto rounded-[1.6rem] border border-[var(--border)] bg-[var(--surface-muted)] p-4">
            <Badge tone="success">Base praticien active</Badge>
            <p className="mt-4 text-base font-semibold text-[var(--foreground)]">
              Une base simple pour votre activité
            </p>
            <p className="mt-2 text-sm leading-6 text-[var(--foreground-subtle)]">
              Un espace clair pour gérer vos prestations, vos réservations, votre
              profil public et vos réponses aux clients.
            </p>
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          <header className="glass-panel sticky top-3 z-30 mb-4 rounded-[2rem] px-4 py-4 md:px-6">
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <Button
                  variant="secondary"
                  size="md"
                  className="h-11 w-11 rounded-2xl px-0 lg:hidden"
                  onClick={() => setMobileOpen(true)}
                  aria-label="Ouvrir la navigation"
                >
                  <Menu className="h-5 w-5" />
                </Button>

                <NuadyxLogo compact className="h-10 w-10 md:h-11 md:w-11" />

                <div className="min-w-0">
                  <p className="text-[0.72rem] uppercase tracking-[0.3em] text-[var(--primary)]/80">
                    Espace praticien
                  </p>
                  <h1 className="truncate text-lg font-semibold text-[var(--foreground)] md:text-xl">
                    {currentItem.label}
                  </h1>
                  <p className="hidden text-sm text-[var(--foreground-muted)] md:block">
                    {pageDescriptions[pathname] ?? currentItem.description}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 md:gap-3">
                <ThemeToggle compact />
                <Badge tone="info" className="hidden md:inline-flex">
                  Espace praticien
                </Badge>
                <div className="hidden rounded-[1.3rem] border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2 md:flex md:items-center md:gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,rgba(143,242,203,0.18),rgba(124,156,255,0.18))] text-sm font-semibold text-[var(--foreground)]">
                    {getInitials(displayName)}
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-[var(--foreground)]">
                      {displayName}
                    </div>
                    <div className="truncate text-xs uppercase tracking-[0.18em] text-[var(--foreground-subtle)]">
                      {user.role}
                    </div>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="md"
                  className="h-11 w-11 rounded-2xl px-0 md:h-11 md:w-auto md:px-4"
                  onClick={logout}
                >
                  <LogOut className="h-4.5 w-4.5" />
                  <span className="hidden md:inline">Déconnexion</span>
                </Button>
              </div>
            </div>

            {error ? (
              <div className="mt-4 rounded-[1.15rem] border border-[color:var(--danger)]/26 bg-[color:var(--danger)]/10 px-4 py-3 text-sm text-[color:var(--danger)]">
                {error}
              </div>
            ) : null}

            {backendUnavailable ? (
              <Notice className="mt-4">
                L’espace praticien reste consultable en lecture seule si des
                données sont déjà chargées. Les actions sécurisées comme la
                connexion, les mises à jour, les réservations ou les règlements
                reprendront dès que le service sera revenu.
              </Notice>
            ) : null}
          </header>

          <motion.main
            key={pathname}
            initial={fadeInUp.initial}
            animate={fadeInUp.animate}
            transition={fadeInUp.transition}
            className="pb-8"
          >
            {children}
          </motion.main>
        </div>
      </div>

      <AnimatePresence>
        {mobileOpen ? (
          <>
            <motion.button
              aria-label="Fermer la navigation"
              className="fixed inset-0 z-40 bg-[var(--drawer-overlay)] backdrop-blur-sm lg:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileOpen(false)}
            />
            <motion.aside
              className="glass-panel fixed inset-y-3 left-3 z-50 flex w-[min(85vw,22rem)] flex-col rounded-[2rem] p-5 lg:hidden"
              initial={{ x: -30, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -24, opacity: 0 }}
              transition={{ duration: 0.24, ease: "easeOut" }}
            >
              <div className="flex items-center justify-between gap-3">
                <NuadyxLogo className="h-16 w-16" priority />
                <div className="flex items-center gap-2">
                  <ThemeToggle compact />
                  <Button
                    variant="secondary"
                    size="md"
                    className="h-11 w-11 rounded-2xl px-0"
                    onClick={() => setMobileOpen(false)}
                    aria-label="Fermer la navigation"
                  >
                    <X className="h-5 w-5" />
                  </Button>
                </div>
              </div>

              <div className="mt-8 flex-1 space-y-2 overflow-y-auto pr-1">
                {navigation.map((item) => {
                  const Icon = item.icon;
                  const active = pathname === item.href;

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileOpen(false)}
                      className={cn(
                        "flex items-start gap-3 rounded-[1.4rem] px-4 py-3.5",
                        active
                          ? "bg-[var(--surface-muted)]"
                          : "hover:bg-[var(--surface-muted)]"
                      )}
                    >
                      <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] text-[var(--foreground-muted)]">
                        <Icon className="h-4.5 w-4.5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 font-medium text-[var(--foreground)]">
                          <span>{item.label}</span>
                          {item.href === "/bookings" && pendingCount > 0 ? (
                            <Badge tone="warning" className="shrink-0">
                              {pendingCount}
                            </Badge>
                          ) : null}
                        </div>
                        <div className="mt-1 text-sm leading-5 text-[var(--foreground-subtle)]">
                          {item.description}
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>

              <div className="mt-6 rounded-[1.5rem] border border-[var(--border)] bg-[var(--surface-muted)] p-4">
                <p className="text-sm font-semibold text-[var(--foreground)]">{displayName}</p>
                <p className="mt-1 text-xs uppercase tracking-[0.2em] text-[var(--foreground-subtle)]">
                  {user.role}
                </p>
              </div>
            </motion.aside>
          </>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
