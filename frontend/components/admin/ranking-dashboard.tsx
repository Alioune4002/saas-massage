"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";

import {
  getAdminRanking,
  updateAdminRankingBoost,
  type AdminRankingRow,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FieldWrapper, Input } from "@/components/ui/field";
import { Notice } from "@/components/ui/notice";
import { Skeleton } from "@/components/ui/skeleton";

export function RankingDashboard() {
  const [rows, setRows] = useState<AdminRankingRow[]>([]);
  const [query, setQuery] = useState("");
  const [city, setCity] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);

  async function load(nextFilters?: { q?: string; city?: string }) {
    const response = await getAdminRanking(nextFilters);
    setRows(response.results);
  }

  useEffect(() => {
    let active = true;
    async function bootstrap() {
      try {
        setLoading(true);
        await load();
        if (active) {
          setError("");
        }
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : "Impossible de charger le classement.");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }
    void bootstrap();
    return () => {
      active = false;
    };
  }, []);

  async function handleFilterSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      await load({ q: query || undefined, city: city || undefined });
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Filtrage impossible.");
    }
  }

  async function handleBoostUpdate(profileId: string, value: number) {
    try {
      await updateAdminRankingBoost(profileId, value);
      setNotice("Boost de visibilité mis à jour.");
      setError("");
      await load({ q: query || undefined, city: city || undefined });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de mettre à jour le boost.");
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-24 rounded-[2rem]" />
        <Skeleton className="h-[28rem] rounded-[2rem]" />
      </div>
    );
  }

  return (
    <div className="space-y-6 overflow-x-clip">
      {error ? <Notice tone="error">{error}</Notice> : null}
      {notice ? <Notice tone="success">{notice}</Notice> : null}

      <Card className="rounded-[1.8rem] p-5 md:p-6">
        <form onSubmit={handleFilterSubmit} className="grid gap-4 sm:grid-cols-2 xl:grid-cols-[1fr_240px_auto]">
          <FieldWrapper label="Recherche">
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="praticien, email, slug"
            />
          </FieldWrapper>
          <FieldWrapper label="Ville">
            <Input
              value={city}
              onChange={(event) => setCity(event.target.value)}
              placeholder="ville"
            />
          </FieldWrapper>
          <div className="self-end">
            <Button type="submit" variant="secondary">Actualiser</Button>
          </div>
        </form>
      </Card>

      <div className="space-y-4">
        {rows.map((row) => (
          <Card key={row.id} className="rounded-[1.8rem] p-5 md:p-6">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="break-words text-xl font-semibold text-[var(--foreground)]">
                    {row.business_name}
                  </h2>
                  <span className="rounded-full bg-[var(--background-soft)] px-3 py-1 text-xs text-[var(--foreground-muted)]">
                    {row.city || "ville non renseignée"}
                  </span>
                  <span className="rounded-full bg-[var(--background-soft)] px-3 py-1 text-xs text-[var(--foreground-muted)]">
                    {row.is_public ? "public" : "privé"}
                  </span>
                </div>
                <div className="mt-4 grid gap-3 text-sm text-[var(--foreground-muted)] sm:grid-cols-2 xl:grid-cols-4">
                  <p>Visibilité : <span className="font-medium text-[var(--foreground)]">{row.profile_visibility_score}</span></p>
                  <p>Complétude : <span className="font-medium text-[var(--foreground)]">{row.profile_completeness_score}</span></p>
                  <p>Réservations : <span className="font-medium text-[var(--foreground)]">{row.ranking_signals.bookings_count}</span></p>
                  <p>Avis : <span className="font-medium text-[var(--foreground)]">{row.ranking_signals.reviews_count}</span></p>
                </div>
                <div className="mt-4 grid gap-3 text-sm text-[var(--foreground-muted)] sm:grid-cols-2 xl:grid-cols-4">
                  <p>Prestations : {row.ranking_signals.services_count}</p>
                  <p>Créneaux ouverts : {row.ranking_signals.open_slots_count}</p>
                  <p>Compte vérifié : {row.ranking_signals.verification_badge_status}</p>
                  <p>Signaux faibles : {row.ranking_signals.low_quality_signals}</p>
                </div>
              </div>

              <div className="w-full max-w-sm space-y-3">
                <FieldWrapper label="Boost manuel">
                  <Input
                    type="number"
                    defaultValue={row.manual_visibility_boost}
                    onBlur={(event) => {
                      const nextValue = Number(event.target.value);
                      if (Number.isFinite(nextValue) && nextValue !== row.manual_visibility_boost) {
                        void handleBoostUpdate(row.id, nextValue);
                      }
                    }}
                  />
                </FieldWrapper>
                <div className="flex flex-wrap gap-3">
                  <Link href={`/${row.slug}`} target="_blank">
                    <Button type="button" variant="secondary">Voir le profil</Button>
                  </Link>
                  <Link href="/admin/users">
                    <Button type="button" variant="ghost">Voir le compte</Button>
                  </Link>
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

