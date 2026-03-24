import Link from "next/link";

import { NuadyxLogo } from "@/components/brand/nuadyx-logo";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ui/theme-toggle";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 px-4 py-4 md:px-6">
      <div className="glass-panel mx-auto flex max-w-7xl items-center justify-between gap-4 rounded-[1.8rem] px-4 py-3 md:px-5">
        <Link href="/" className="shrink-0">
          <NuadyxLogo showText priority />
        </Link>

        <nav className="hidden items-center gap-6 text-sm text-[var(--foreground-muted)] lg:flex">
          <Link href="/praticiens" className="hover:text-[var(--foreground)]">
            Praticiens
          </Link>
          <a href="#benefices" className="hover:text-[var(--foreground)]">
            Fonctionnalités
          </a>
          <a href="#pour-qui" className="hover:text-[var(--foreground)]">
            Pour qui
          </a>
          <a href="#pricing" className="hover:text-[var(--foreground)]">
            Tarification
          </a>
        </nav>

        <div className="flex items-center gap-2">
          <ThemeToggle compact />
          <Link href="/inscription" className="hidden sm:inline-flex">
            <Button size="md">Créer mon espace</Button>
          </Link>
          <Link href="/login">
            <Button variant="secondary" size="md">
              Se connecter
            </Button>
          </Link>
        </div>
      </div>
    </header>
  );
}
