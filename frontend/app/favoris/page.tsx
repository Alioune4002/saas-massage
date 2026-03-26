"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { SiteHeader } from "@/components/marketing/site-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Notice } from "@/components/ui/notice";
import { Skeleton } from "@/components/ui/skeleton";
import {
  getGuestFavorites,
  removeGuestFavorite,
  type FavoritePractitioner,
} from "@/lib/api";

export default function FavoritesPage() {
  const [items, setItems] = useState<FavoritePractitioner[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const result = await getGuestFavorites();
        if (!active) {
          return;
        }
        setItems(result.favorites);
        setError("");
      } catch (err) {
        if (!active) {
          return;
        }
        setError(err instanceof Error ? err.message : "Impossible de charger vos favoris.");
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
  }, []);

  async function handleRemove(slug: string) {
    await removeGuestFavorite(slug);
    setItems((current) => current.filter((item) => item.slug !== slug));
  }

  return (
    <main className="min-h-screen px-4 pb-12 pt-4 md:px-6">
      <SiteHeader />
      <div className="mx-auto mt-6 max-w-6xl">
        <Card className="rounded-[2rem]">
          <Badge tone="info">Mes favoris</Badge>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight text-[var(--foreground)]">
            Mes praticiens favoris
          </h1>
          <p className="mt-4 text-sm leading-7 text-[var(--foreground-muted)]">
            Retrouvez rapidement les praticiens que vous souhaitez recontacter ou réserver à nouveau.
          </p>
        </Card>

        {error ? <Notice tone="error" className="mt-6">{error}</Notice> : null}

        {loading ? (
          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <Skeleton key={index} className="h-64 rounded-[1.8rem]" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="mt-6">
            <Card className="rounded-[2rem] p-6">
              <p className="text-xs uppercase tracking-[0.26em] text-[var(--primary)]/80">
                Favoris
              </p>
              <h2 className="mt-4 text-2xl font-semibold text-[var(--foreground)]">
                Aucun praticien favori pour l’instant
              </h2>
              <p className="mt-3 text-sm leading-7 text-[var(--foreground-muted)]">
                Ajoutez un praticien depuis sa page publique pour le retrouver plus facilement et re-réserver plus tard.
              </p>
              <div className="mt-5">
                <Link href="/annuaire">
                  <Button>Parcourir l’annuaire</Button>
                </Link>
              </div>
            </Card>
          </div>
        ) : (
          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {items.map((item) => (
              <Card key={item.id} className="rounded-[1.8rem]">
                <p className="text-lg font-semibold text-[var(--foreground)]">{item.business_name}</p>
                <p className="mt-2 text-sm text-[var(--foreground-muted)]">
                  {item.city || "Ville à préciser"}
                </p>
                {item.public_headline ? (
                  <p className="mt-3 text-sm leading-7 text-[var(--foreground-muted)]">
                    {item.public_headline}
                  </p>
                ) : null}
                <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                  <Link href={`/praticiens/${item.slug}`} className="w-full">
                    <Button className="w-full">Voir la page</Button>
                  </Link>
                  <Button
                    variant="secondary"
                    className="w-full"
                    onClick={() => void handleRemove(item.slug)}
                  >
                    Retirer
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
