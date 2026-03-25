"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";

import { SiteHeader } from "@/components/marketing/site-header";
import { DirectoryListingGrid } from "@/components/directory/directory-listing-grid";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/field";
import { Notice } from "@/components/ui/notice";
import { getPublicDirectoryListings, type DirectoryListing } from "@/lib/api";

export default function PractitionersPage() {
  const [items, setItems] = useState<DirectoryListing[]>([]);
  const [query, setQuery] = useState("");
  const [city, setCity] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load(filters?: { q?: string; city?: string }) {
    try {
      setLoading(true);
      const data = await getPublicDirectoryListings(filters);
      setItems(data);
      setError("");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Impossible de charger les praticiens."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  return (
    <main className="min-h-screen px-4 pb-12 pt-4 md:px-6">
      <SiteHeader />

      <div className="mx-auto mt-6 max-w-7xl space-y-6">
        <section className="grid gap-6 lg:grid-cols-[0.88fr_1.12fr]">
          <Card className="rounded-[2rem]">
            <Badge tone="info">Annuaire NUADYX</Badge>
            <h1 className="mt-5 text-4xl font-semibold tracking-tight text-[var(--foreground)]">
              Trouver un praticien du massage et du bien-être
            </h1>
            <p className="mt-4 text-sm leading-7 text-[var(--foreground-muted)]">
              Découvrez les pages praticiens déjà visibles, les fiches à compléter
              et les premiers profils mis en avant pendant le lancement.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link href="/inscription">
                <Button size="lg">Créer ma page praticien</Button>
              </Link>
              <Link href="/massage-quimper">
                <Button variant="secondary" size="lg">
                  Explorer par ville
                </Button>
              </Link>
            </div>
          </Card>

          <Card className="rounded-[2rem]">
            <div className="grid gap-4 md:grid-cols-[1fr_0.8fr_auto]">
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Nom du praticien"
              />
              <Input
                value={city}
                onChange={(event) => setCity(event.target.value)}
                placeholder="Ville"
              />
              <Button
                size="lg"
                className="w-full md:w-auto"
                iconLeft={<Search className="h-4 w-4" />}
                onClick={() => void load({ q: query, city })}
              >
                Rechercher
              </Button>
            </div>
          </Card>
        </section>

        {error ? <Notice tone="error">{error}</Notice> : null}

        <section>
          <DirectoryListingGrid items={items} loading={loading} />
        </section>
      </div>
    </main>
  );
}
