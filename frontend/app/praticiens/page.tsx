/* eslint-disable @next/next/no-img-element */

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { MapPin, Search } from "lucide-react";

import { NuadyxLogo } from "@/components/brand/nuadyx-logo";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/field";
import { Notice } from "@/components/ui/notice";
import { Skeleton } from "@/components/ui/skeleton";
import {
  getPublicProfessionals,
  type PublicProfessional,
} from "@/lib/api";
import { getPublicProfileTheme } from "@/lib/public-profile";
import { getInitials } from "@/lib/utils";

export default function PractitionersPage() {
  const [items, setItems] = useState<PublicProfessional[]>([]);
  const [query, setQuery] = useState("");
  const [city, setCity] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load(filters?: { q?: string; city?: string }) {
    try {
      setLoading(true);
      const data = await getPublicProfessionals(filters);
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
    <main className="min-h-screen px-4 py-4 md:px-6">
      <div className="mx-auto max-w-7xl">
        <header className="glass-panel rounded-[1.8rem] px-4 py-3 md:px-5">
          <div className="flex items-center justify-between gap-4">
            <Link href="/">
              <NuadyxLogo priority />
            </Link>
            <div className="flex items-center gap-2">
              <ThemeToggle compact />
              <Link href="/login">
                <Button variant="secondary" size="md">
                  Espace praticien
                </Button>
              </Link>
            </div>
          </div>
        </header>

        <section className="mt-6 grid gap-6 lg:grid-cols-[0.88fr_1.12fr]">
          <Card className="rounded-[2rem]">
            <Badge tone="info">Découvrir les praticiens</Badge>
            <h1 className="mt-5 text-4xl font-semibold tracking-tight text-[var(--foreground)]">
              Trouver un praticien du massage et du bien-être
            </h1>
            <p className="mt-4 text-sm leading-7 text-[var(--foreground-muted)]">
              Une première base d’annuaire NUADYX pour découvrir les univers, les
              villes et les pages publiques réservables.
            </p>
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

        {error ? <Notice tone="error" className="mt-4">{error}</Notice> : null}

        <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {loading
            ? Array.from({ length: 6 }).map((_, index) => (
                <Skeleton key={index} className="h-80 rounded-[1.8rem]" />
              ))
            : items.map((item) => {
                const theme = getPublicProfileTheme(item.visual_theme);

                return (
                  <Card key={item.id} className="overflow-hidden rounded-[1.8rem] p-0">
                    <div className={`relative h-36 ${theme.heroGradient}`}>
                      {item.cover_photo_url ? (
                        <img
                          src={item.cover_photo_url}
                          alt={`Couverture de ${item.business_name}`}
                          className="absolute inset-0 h-full w-full object-cover"
                        />
                      ) : null}
                      <div className="absolute inset-0 bg-[linear-gradient(180deg,var(--hero-scrim),var(--hero-scrim-strong))]" />
                      <div className="relative flex h-full items-end justify-between p-5">
                        <div className="flex items-center gap-3 text-[var(--inverse-foreground)]">
                          <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-[1.25rem] border border-[var(--hero-card-border)] bg-[var(--hero-card-surface-strong)] text-lg font-semibold">
                            {item.profile_photo_url ? (
                              <img
                                src={item.profile_photo_url}
                                alt={item.business_name}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              getInitials(item.business_name)
                            )}
                          </div>
                          <div>
                            <p className="text-xs uppercase tracking-[0.22em] text-[var(--inverse-foreground-subtle)]">
                              {theme.label}
                            </p>
                            <p className="mt-1 text-lg font-semibold">
                              {item.business_name}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="p-5">
                      <div className="flex items-center gap-2 text-sm text-[var(--foreground-muted)]">
                        <MapPin className="h-4 w-4" />
                        {item.service_area || item.city || "Ville à préciser"}
                      </div>
                      <p className="mt-4 text-base font-medium text-[var(--foreground)]">
                        {item.public_headline ||
                          "Massage et bien-être sur rendez-vous"}
                      </p>
                      <p className="mt-3 text-sm leading-7 text-[var(--foreground-muted)]">
                        {item.bio ||
                          "Découvrez un univers de soin et une page publique prête à accueillir les réservations."}
                      </p>

                      <div className="mt-5 flex flex-wrap gap-2">
                        {item.specialties.slice(0, 3).map((specialty) => (
                          <Badge key={specialty} tone="info">
                            {specialty}
                          </Badge>
                        ))}
                      </div>

                      <Link href={`/${item.slug}`} className="mt-6 inline-flex w-full">
                        <Button size="lg" className="w-full">
                          Voir le profil public
                        </Button>
                      </Link>
                    </div>
                  </Card>
                );
              })}
        </section>

        {!loading && items.length === 0 ? (
          <Notice tone="info" className="mt-6">
            Aucun praticien visible ne correspond à cette recherche pour le moment.
          </Notice>
        ) : null}
      </div>
    </main>
  );
}
