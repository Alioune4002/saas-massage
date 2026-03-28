"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";

import { getAdminAnalyticsOverview, type AdminAnalyticsOverview } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { FieldWrapper, Input, Select } from "@/components/ui/field";
import { Notice } from "@/components/ui/notice";
import { Skeleton } from "@/components/ui/skeleton";

function AnalyticsBars({
  title,
  points,
}: {
  title: string;
  points: Array<{ date: string; value: number }>;
}) {
  const maxValue = Math.max(...points.map((point) => point.value), 1);

  return (
    <Card className="min-w-0 rounded-[1.8rem] p-5 md:p-6">
      <h2 className="text-xl font-semibold text-[var(--foreground)]">{title}</h2>
      <div className="mt-5 grid grid-cols-7 gap-2 sm:grid-cols-10 lg:grid-cols-14">
        {points.map((point) => (
          <div key={`${title}-${point.date}`} className="min-w-0">
            <div className="flex h-36 items-end rounded-[1rem] bg-[var(--background-soft)] px-1.5 py-2">
              <div
                className="w-full rounded-full bg-[var(--primary)]/75"
                style={{ height: `${Math.max((point.value / maxValue) * 100, point.value ? 10 : 4)}%` }}
                title={`${point.date}: ${point.value}`}
              />
            </div>
            <p className="mt-2 truncate text-center text-[11px] text-[var(--foreground-muted)]">
              {point.date}
            </p>
          </div>
        ))}
      </div>
    </Card>
  );
}

export function AnalyticsDashboard() {
  const [data, setData] = useState<AdminAnalyticsOverview | null>(null);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState({
    city: "",
    visitor_type: "",
    days: "30",
  });

  const load = useCallback(async (currentFilters = filters) => {
    const overview = await getAdminAnalyticsOverview({
      city: currentFilters.city || undefined,
      visitor_type:
        (currentFilters.visitor_type as "anonymous" | "professional" | "admin") ||
        undefined,
      days: Number(currentFilters.days || 30),
    });
    setData(overview);
  }, [filters]);

  useEffect(() => {
    let active = true;
    async function bootstrap() {
      try {
        await load();
        if (active) {
          setError("");
        }
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : "Impossible de charger les analytics.");
        }
      }
    }
    void bootstrap();
    return () => {
      active = false;
    };
  }, [load]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      await load();
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de filtrer les analytics.");
    }
  }

  if (!data && !error) {
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

      <Card className="rounded-[1.8rem] p-5 md:p-6">
        <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2 xl:grid-cols-[1fr_220px_180px_auto]">
          <FieldWrapper label="Ville">
            <Input
              value={filters.city}
              onChange={(event) => setFilters((current) => ({ ...current, city: event.target.value }))}
              placeholder="ville"
            />
          </FieldWrapper>
          <FieldWrapper label="Type visiteur">
            <Select
              value={filters.visitor_type}
              onChange={(event) =>
                setFilters((current) => ({ ...current, visitor_type: event.target.value }))
              }
            >
              <option value="">Tous</option>
              <option value="anonymous">anonymous</option>
              <option value="professional">professional</option>
              <option value="admin">admin</option>
            </Select>
          </FieldWrapper>
          <FieldWrapper label="Fenêtre">
            <Select
              value={filters.days}
              onChange={(event) => setFilters((current) => ({ ...current, days: event.target.value }))}
            >
              <option value="14">14 jours</option>
              <option value="30">30 jours</option>
              <option value="90">90 jours</option>
            </Select>
          </FieldWrapper>
          <div className="self-end">
            <button
              type="submit"
              className="rounded-[1.2rem] bg-[var(--primary)] px-4 py-3 text-sm font-medium text-white"
            >
              Appliquer
            </button>
          </div>
        </form>
      </Card>

      {data ? (
        <>
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[
              ["Trafic suivi", data.kpis.pageviews_total],
              ["Réservations", data.kpis.bookings_total],
              ["Claims approuvés", data.kpis.claims_approved_total],
              ["Praticiens", data.kpis.practitioners_total],
              ["Profils publics", data.kpis.public_profiles_total],
              ["Campagnes", data.kpis.campaigns_total],
              ["Villes pilotées", data.kpis.city_plans_total],
              ["Utilisateurs", data.kpis.users_total],
            ].map(([label, value]) => (
              <Card key={String(label)} className="rounded-[1.6rem] p-5">
                <p className="text-sm text-[var(--foreground-muted)]">{label}</p>
                <p className="mt-2 break-words text-3xl font-semibold text-[var(--foreground)]">
                  {String(value)}
                </p>
              </Card>
            ))}
          </section>

          <section className="grid gap-6 xl:grid-cols-3">
            <AnalyticsBars title="Trafic" points={data.charts.traffic} />
            <AnalyticsBars title="Réservations" points={data.charts.bookings} />
            <AnalyticsBars title="Activation" points={data.charts.activation} />
          </section>

          <section className="grid gap-6 xl:grid-cols-2">
            <Card className="rounded-[1.8rem] p-5 md:p-6">
              <h2 className="text-2xl font-semibold text-[var(--foreground)]">Conversions</h2>
              <div className="mt-5 space-y-4 text-sm leading-7">
                {Object.entries(data.ratios).map(([key, value]) => (
                  <div key={key} className="flex flex-wrap items-center justify-between gap-3">
                    <span className="break-words text-[var(--foreground-muted)]">{key}</span>
                    <span className="font-medium text-[var(--foreground)]">{value}%</span>
                  </div>
                ))}
              </div>
              <div className="mt-6 space-y-3 rounded-[1.4rem] border border-[var(--border)] bg-[var(--background-soft)] p-4 text-sm leading-7 text-[var(--foreground-muted)]">
                {Object.entries(data.tracking_notes).map(([key, value]) => (
                  <p key={key} className="break-words">
                    <span className="font-medium text-[var(--foreground)]">{key}</span>
                    {" · "}
                    {value}
                  </p>
                ))}
              </div>
            </Card>

            <Card className="rounded-[1.8rem] p-5 md:p-6">
              <h2 className="text-2xl font-semibold text-[var(--foreground)]">Trafic par ville</h2>
              <div className="mt-5 space-y-3">
                {data.traffic_by_city.map((city) => (
                  <div
                    key={city.city_slug}
                    className="rounded-[1.3rem] border border-[var(--border)] bg-[var(--background-soft)] p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="break-words font-medium text-[var(--foreground)]">
                        {city.city_label}
                      </p>
                      <p className="text-sm text-[var(--foreground-muted)]">
                        {city.pageviews} visites
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </section>

          <section className="grid gap-6 xl:grid-cols-2">
            <Card className="rounded-[1.8rem] p-5 md:p-6">
              <h2 className="text-2xl font-semibold text-[var(--foreground)]">Top villes</h2>
              <div className="mt-5 space-y-3">
                {data.top_cities.map((city) => (
                  <div
                    key={city.city_slug}
                    className="rounded-[1.3rem] border border-[var(--border)] bg-[var(--background-soft)] p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="break-words font-medium text-[var(--foreground)]">
                        {city.city_label}
                      </p>
                      <p className="text-sm text-[var(--foreground-muted)]">
                        {city.coverage_percent}%
                      </p>
                    </div>
                    <p className="mt-2 break-words text-sm text-[var(--foreground-muted)]">
                      {city.claimed_profiles} revendiqués · {city.active_profiles} actifs
                    </p>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="rounded-[1.8rem] p-5 md:p-6">
              <h2 className="text-2xl font-semibold text-[var(--foreground)]">Top profils</h2>
              <div className="mt-5 space-y-3">
                {data.top_profiles.map((profile) => (
                  <div
                    key={profile.id}
                    className="rounded-[1.3rem] border border-[var(--border)] bg-[var(--background-soft)] p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="break-words font-medium text-[var(--foreground)]">
                        {profile.name}
                      </p>
                      <p className="text-sm text-[var(--foreground-muted)]">
                        {profile.average_rating}/5
                      </p>
                    </div>
                    <p className="mt-2 break-words text-sm text-[var(--foreground-muted)]">
                      {profile.city} · {profile.bookings_count} réservations
                    </p>
                  </div>
                ))}
              </div>
            </Card>
          </section>
        </>
      ) : null}
    </div>
  );
}
