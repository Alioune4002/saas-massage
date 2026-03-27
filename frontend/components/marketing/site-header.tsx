import Link from "next/link";

import { NuadyxLogo } from "@/components/brand/nuadyx-logo";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ui/theme-toggle";

export function SiteHeader({
  mode = "practitioner",
}: {
  mode?: "practitioner" | "client";
}) {
  const primaryHref = mode === "client" ? "/annuaire" : "/inscription";
  const primaryLabel = mode === "client" ? "Voir l’annuaire" : "Créer ma page";
  const switchHref = mode === "client" ? "/" : "/trouver-un-praticien";
  const switchLabel = mode === "client" ? "Je suis praticien" : "Trouver un praticien";
  const secondaryLinks =
    mode === "practitioner"
      ? [
          { href: "#pourquoi-rejoindre", label: "Pourquoi rejoindre NUADYX" },
          { href: "#comment-ca-marche", label: "Comment ça marche" },
          { href: "#lancement", label: "Gratuit pendant le lancement" },
        ]
      : [
          { href: "#recherche-locale", label: "Recherche locale" },
          { href: "#recommander", label: "Recommander un praticien" },
        ];

  return (
    <header className="sticky top-0 z-30 px-4 py-4 md:px-6">
      <div className="glass-panel mx-auto max-w-7xl overflow-hidden rounded-[1.8rem] px-4 py-3 md:px-5">
        <div className="flex items-start justify-between gap-3">
          <Link href="/" className="min-w-0 shrink">
            <span className="inline-flex min-w-0 max-w-[11rem] sm:max-w-[13rem] md:max-w-[16rem]">
              <NuadyxLogo priority showText textClassName="min-w-0" />
            </span>
          </Link>

          <div className="flex shrink-0 items-center gap-2">
            <ThemeToggle compact />
            <Link href="/login" className="hidden sm:inline-flex">
              <Button variant="secondary" size="sm" className="whitespace-nowrap px-3">
                Se connecter
              </Button>
            </Link>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-[var(--border)]/70 pt-3">
          <Link href={switchHref}>
            <Button variant="ghost" size="sm" className="whitespace-nowrap">
              {switchLabel}
            </Button>
          </Link>
          <Link href="/annuaire">
            <Button
              variant={mode === "client" ? "secondary" : "ghost"}
              size="sm"
              className="whitespace-nowrap"
            >
              Parcourir l’annuaire
            </Button>
          </Link>
          <Link href="/favoris">
            <Button variant="ghost" size="sm" className="whitespace-nowrap">
              Mes favoris
            </Button>
          </Link>
          <Link href={primaryHref}>
            <Button size="sm" className="whitespace-nowrap">
              {primaryLabel}
            </Button>
          </Link>
          <Link href="/login" className="sm:hidden">
            <Button variant="secondary" size="sm" className="whitespace-nowrap">
              Se connecter
            </Button>
          </Link>

          <div className="hidden flex-wrap items-center gap-2 lg:flex">
            {secondaryLinks.map((item) => (
              <a
                key={item.label}
                href={item.href}
                className="rounded-full px-3 py-2 text-sm text-[var(--foreground-muted)] transition hover:bg-[var(--surface-muted)] hover:text-[var(--foreground)]"
              >
                {item.label}
              </a>
            ))}
          </div>
        </div>
      </div>
    </header>
  );
}
