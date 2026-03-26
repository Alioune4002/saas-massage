"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { NuadyxLogo } from "@/components/brand/nuadyx-logo";
import { LegalLinks } from "@/components/legal/legal-links";

export function SiteFooter() {
  const pathname = usePathname();

  if (pathname !== "/") {
    return null;
  }

  return (
    <footer className="border-t border-[var(--border)] bg-[var(--background-soft)] px-4 py-10 text-[var(--foreground)] md:px-6">
      <div className="mx-auto grid max-w-7xl gap-8">
        <div className="space-y-4">
          <NuadyxLogo showText compact />
          <p className="max-w-2xl text-sm leading-7 text-[var(--foreground-muted)]">
            NUADYX aide les professionnels du massage et du bien-être à
            présenter leur activité, ouvrir leurs créneaux et recevoir leurs
            demandes de rendez-vous dans un cadre clair et rassurant.
          </p>
        </div>

        <div>
          <p className="text-sm font-semibold text-[var(--foreground)]">
            Liens utiles
          </p>
          <LegalLinks className="mt-3" />
        </div>

        <div>
          <p className="text-sm font-semibold text-[var(--foreground)]">
            Navigation
          </p>
          <div className="mt-3 space-y-2 text-sm text-[var(--foreground-muted)]">
            <Link
              href="/trouver-un-praticien"
              className="block transition hover:text-[var(--foreground)]"
            >
              Trouver un praticien
            </Link>
            <Link
              href="/inscription"
              className="block transition hover:text-[var(--foreground)]"
            >
              Créer mon espace
            </Link>
            <Link
              href="/login"
              className="block transition hover:text-[var(--foreground)]"
            >
              Se connecter
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
