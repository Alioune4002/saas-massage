"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { SiteHeader } from "@/components/marketing/site-header";
import { DirectoryListingGrid } from "@/components/directory/directory-listing-grid";
import { LocationAutosuggest } from "@/components/directory/location-autosuggest";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Notice } from "@/components/ui/notice";
import { getDirectoryListings, type DirectoryListing } from "@/lib/api";
import { type DirectorySeoPageConfig } from "@/lib/directory";

type DirectorySeoPageProps = {
  config: DirectorySeoPageConfig;
};

export function DirectorySeoPage({ config }: DirectorySeoPageProps) {
  const [items, setItems] = useState<DirectoryListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const data = await getDirectoryListings({
          city: config.city,
          category: config.category,
        });
        if (!active) {
          return;
        }
        setItems(data);
        setError("");
      } catch (err) {
        if (!active) {
          return;
        }
        setError(
          err instanceof Error
            ? err.message
            : "Impossible de charger les praticiens pour cette page."
        );
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, [config.category, config.city]);

  return (
    <main className="min-h-screen px-4 pb-12 pt-4 md:px-6">
      <SiteHeader />

      <div className="mx-auto mt-6 max-w-7xl space-y-6">
        <section className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
          <Card className="rounded-[2rem]">
            <Badge tone="info">
              {config.kind === "city" ? "Page ville" : "Page catégorie"}
            </Badge>
            <div className="mt-4 text-sm text-[var(--foreground-subtle)]">
              <Link href="/annuaire" className="underline-offset-2 hover:underline">
                Annuaire
              </Link>
              <span className="mx-2">/</span>
              <span>{config.h1}</span>
            </div>
            <h1 className="mt-5 text-4xl font-semibold tracking-tight text-[var(--foreground)] md:text-5xl">
              {config.h1}
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-[var(--foreground-muted)] md:text-lg">
              {config.description}
            </p>
            <div className="mt-6 max-w-xl">
              <LocationAutosuggest
                defaultValue={config.city || ""}
                hint="Explorer une autre ville ou zone"
              />
            </div>
          </Card>

          <Card className="rounded-[2rem]">
            <p className="text-xs uppercase tracking-[0.26em] text-[var(--primary)]/80">
              Rejoindre l’annuaire
            </p>
            <h2 className="mt-3 text-2xl font-semibold text-[var(--foreground)]">
              Créer une page praticien gratuite pendant le lancement
            </h2>
            <p className="mt-3 text-sm leading-7 text-[var(--foreground-muted)]">
              Présentez vos soins, partagez votre lien et recevez des demandes de
              rendez-vous plus clairement, sans créer un site complet.
            </p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <Link href="/inscription" className="w-full">
                <Button size="lg" className="w-full">
                  Créer ma page praticien
                </Button>
              </Link>
              <Link href="/praticiens" className="w-full">
                <Button variant="secondary" size="lg" className="w-full">
                  Voir l’annuaire
                </Button>
              </Link>
            </div>
          </Card>
        </section>

        <section>
          {error ? <Notice tone="error">{error}</Notice> : null}
          <DirectoryListingGrid items={items} loading={loading} />
        </section>

        <section>
          <Card className="rounded-[2rem]">
            <p className="text-xs uppercase tracking-[0.26em] text-[var(--primary)]/80">
              Gratuit pendant le lancement
            </p>
            <h2 className="mt-3 text-2xl font-semibold text-[var(--foreground)]">
              Être visible dans l’annuaire dès maintenant
            </h2>
            <p className="mt-3 text-sm leading-7 text-[var(--foreground-muted)]">
              Les premiers praticiens inscrits peuvent prendre place plus tôt dans
              l’annuaire, tester leur page et poser les bases de leur visibilité
              locale.
            </p>
            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              <Link href="/inscription" className="w-full sm:w-auto">
                <Button size="lg" className="w-full sm:w-auto">
                  Rejoindre NUADYX gratuitement
                </Button>
              </Link>
            </div>
          </Card>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          {[
            "Une page praticien simple à partager",
            "Des demandes de rendez-vous plus lisibles",
            "Des avis et informations pratiques pour rassurer",
          ].map((point) => (
            <Card key={point} className="rounded-[1.7rem] p-5">
              <p className="text-sm font-medium leading-7 text-[var(--foreground)]">
                {point}
              </p>
            </Card>
          ))}
        </section>

        <section className="grid gap-4 lg:grid-cols-[1.08fr_0.92fr]">
          <Card className="rounded-[2rem]">
            <p className="text-xs uppercase tracking-[0.26em] text-[var(--primary)]/80">
              SEO local
            </p>
            <div className="mt-4 space-y-4 text-sm leading-7 text-[var(--foreground-muted)]">
              {config.seoParagraphs.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>
          </Card>

          <Card className="rounded-[2rem]">
            <p className="text-xs uppercase tracking-[0.26em] text-[var(--primary)]/80">
              Explorer aussi
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              {config.relatedLinks.map((link) => (
                <Link key={link.href} href={link.href}>
                  <Button variant="secondary" size="md">
                    {link.label}
                  </Button>
                </Link>
              ))}
            </div>
          </Card>
        </section>

        <section>
          <Card className="rounded-[2rem]">
            <p className="text-xs uppercase tracking-[0.26em] text-[var(--primary)]/80">
              FAQ
            </p>
            <div className="mt-4 space-y-4">
              {config.faq.map((item) => (
                <div
                  key={item.question}
                  className="rounded-[1.4rem] border border-[var(--border)] bg-[var(--background-soft)] p-4"
                >
                  <h2 className="text-base font-semibold text-[var(--foreground)]">
                    {item.question}
                  </h2>
                  <p className="mt-2 text-sm leading-7 text-[var(--foreground-muted)]">
                    {item.answer}
                  </p>
                </div>
              ))}
            </div>
          </Card>
        </section>
      </div>
    </main>
  );
}
