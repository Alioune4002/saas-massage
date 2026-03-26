"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { DirectoryListingGrid } from "@/components/directory/directory-listing-grid";
import { LocationAutosuggest } from "@/components/directory/location-autosuggest";
import { LaunchInterestForm } from "@/components/marketing/launch-interest-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FieldWrapper, Input } from "@/components/ui/field";
import { Notice } from "@/components/ui/notice";
import { getPublicDirectoryListings, type DirectoryListing } from "@/lib/api";

type DirectoryBrowserPageProps = {
  title: string;
  description: string;
  city?: string;
  locationType?: string;
  locationSlug?: string;
  locationLabel?: string;
};

export function DirectoryBrowserPage({
  title,
  description,
  city,
  locationType,
  locationSlug,
  locationLabel,
}: DirectoryBrowserPageProps) {
  const [items, setItems] = useState<DirectoryListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        setLoading(true);
        const data = await getPublicDirectoryListings({
          city,
          q: query || undefined,
          locationType,
          locationSlug,
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
        setError(err instanceof Error ? err.message : "Impossible de charger l’annuaire.");
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
  }, [city, locationSlug, locationType, query]);

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 md:px-6 md:py-10">
      <section className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <Card className="rounded-[1.9rem] p-6 md:p-8">
          <Badge tone="info">Annuaire NUADYX</Badge>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight text-[var(--foreground)] md:text-5xl">
            {title}
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-[var(--foreground-muted)]">
            {description}
          </p>
          <div className="mt-6 max-w-xl">
            <div className="grid gap-4">
              <LocationAutosuggest
                defaultValue={locationLabel || city || ""}
                hint="Ville, code postal, département ou région"
              />
              <FieldWrapper
                label="Affiner la recherche"
                hint="Nom, spécialité ou mot-clé"
              >
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Ex. relaxation, drainage, cabinet..."
                />
              </FieldWrapper>
            </div>
          </div>
        </Card>

        <Card className="rounded-[1.9rem] p-6 md:p-8">
          <p className="text-xs uppercase tracking-[0.32em] text-[var(--primary)]/80">
            Praticien
          </p>
          <h2 className="mt-4 text-3xl font-semibold text-[var(--foreground)]">
            Rejoindre l’annuaire gratuitement
          </h2>
          <p className="mt-4 text-sm leading-7 text-[var(--foreground-muted)]">
            Créez votre page praticien, présentez vos soins et commencez à recevoir
            des demandes de rendez-vous sans promesse trompeuse ni faux signaux d’activité.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Link href="/inscription">
              <Button size="lg">Créer ma page praticien</Button>
            </Link>
            <Link href="/revendiquer">
              <Button size="lg" variant="secondary">
                Revendiquer une fiche existante
              </Button>
            </Link>
          </div>
        </Card>
      </section>

      <section className="mt-8">
        {error ? <Notice tone="error">{error}</Notice> : null}
        <DirectoryListingGrid items={items} loading={loading} />
      </section>

      <section className="mt-8 grid gap-4 xl:grid-cols-2">
        <LaunchInterestForm
          kind="suggest_practitioner"
          title="Suggérer un praticien"
          description="Conseillez un praticien à ajouter à l’annuaire. La suggestion part en revue interne avant toute action."
        />
        <LaunchInterestForm
          kind="recommend_masseur"
          title="Recommander mon masseur"
          description="Aidez-nous à mieux couvrir votre ville sans créer automatiquement de fiche publique."
          practitionerLabel="Nom du masseur recommandé"
        />
      </section>
    </main>
  );
}
