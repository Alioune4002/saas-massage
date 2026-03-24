import Link from "next/link";

import { NuadyxLogo } from "@/components/brand/nuadyx-logo";

export function SiteFooter() {
  return (
    <footer className="border-t border-[var(--border)] bg-[var(--background-soft)] px-4 py-10 text-[var(--foreground)] md:px-6">
      <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-4">
          <NuadyxLogo showText compact />
          <p className="max-w-2xl text-sm leading-7 text-[var(--foreground-muted)]">
            NUADYX aide les professionnels du massage et du bien-être à
            présenter leur activité, ouvrir leurs créneaux et recevoir leurs
            demandes de rendez-vous dans un cadre clair et rassurant.
          </p>
        </div>

        <div className="grid gap-8 sm:grid-cols-2">
          <div>
            <p className="text-sm font-semibold text-[var(--foreground)]">
              Liens utiles
            </p>
            <div className="mt-3 space-y-2 text-sm text-[var(--foreground-muted)]">
              <Link
                href="/mentions-legales"
                className="block transition hover:text-[var(--foreground)]"
              >
                Mentions légales
              </Link>
              <Link
                href="/politique-confidentialite"
                className="block transition hover:text-[var(--foreground)]"
              >
                Politique de confidentialité
              </Link>
              <Link
                href="/cgv"
                className="block transition hover:text-[var(--foreground)]"
              >
                Conditions générales de vente
              </Link>
            </div>
          </div>

          <div>
            <p className="text-sm font-semibold text-[var(--foreground)]">
              Éditeur
            </p>
            <div className="mt-3 space-y-2 text-sm leading-6 text-[var(--foreground-muted)]">
              <p>ALIOUNE BADARA SECK</p>
              <p>SIREN 995 288 438</p>
              <p>SIRET 995 288 438 00014</p>
              <p>1 PLACE GUY ROPARTZ, 29000 QUIMPER</p>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
