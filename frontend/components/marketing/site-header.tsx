import Link from "next/link";

import { NuadyxLogo } from "@/components/brand/nuadyx-logo";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ui/theme-toggle";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 px-4 py-4 md:px-6">
      <div className="glass-panel mx-auto flex max-w-7xl items-center justify-between gap-3 overflow-hidden rounded-[1.8rem] px-4 py-3 md:px-5">
        <Link href="/" className="min-w-0 shrink">
          <span className="inline-flex min-w-0 max-w-[13.5rem] sm:max-w-none">
            <NuadyxLogo priority showText textClassName="min-w-0" />
          </span>
        </Link>

        <nav className="hidden items-center gap-6 text-sm text-[var(--foreground-muted)] lg:flex">
          <Link href="/annuaire" className="hover:text-[var(--foreground)]">
            Trouver un praticien
          </Link>
          <Link href="/favoris" className="hover:text-[var(--foreground)]">
            Mes favoris
          </Link>
          <a href="#pourquoi-rejoindre" className="hover:text-[var(--foreground)]">
            Pourquoi rejoindre NUADYX
          </a>
          <a href="#lancement" className="hover:text-[var(--foreground)]">
            Rejoindre l’annuaire
          </a>
          <a href="#lancement" className="hover:text-[var(--foreground)]">
            Gratuit pendant le lancement
          </a>
        </nav>

        <div className="flex shrink-0 items-center gap-2">
          <ThemeToggle compact />
          <Link href="/inscription" className="hidden md:inline-flex">
            <Button size="md" className="whitespace-nowrap">
              Créer ma page praticien
            </Button>
          </Link>
          <Link href="/login">
            <Button variant="secondary" size="md" className="whitespace-nowrap">
              Se connecter
            </Button>
          </Link>
        </div>
      </div>
    </header>
  );
}
