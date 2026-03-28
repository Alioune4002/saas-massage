"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { getAdminDashboardOverview, type AdminDashboardOverview } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Notice } from "@/components/ui/notice";
import { Skeleton } from "@/components/ui/skeleton";

function MiniBarChart({
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

export function DashboardGlobal() {
  const [data, setData] = useState<AdminDashboardOverview | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const overview = await getAdminDashboardOverview();
        if (active) {
          setData(overview);
          setError("");
        }
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : "Impossible de charger le dashboard admin.");
        }
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, []);

  if (!data && !error) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-24 rounded-[2rem]" />
        <Skeleton className="h-[22rem] rounded-[2rem]" />
      </div>
    );
  }

  const widgets = data?.widgets;

  return (
    <div className="space-y-6 overflow-x-clip">
      {error ? <Notice tone="error">{error}</Notice> : null}

      {widgets ? (
        <>
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[
              ["Praticiens", widgets.practitioners_total],
              ["Nouveaux inscrits aujourd’hui", widgets.new_signups_day],
              ["Nouveaux inscrits semaine", widgets.new_signups_week],
              ["Réservations totales", widgets.bookings_total],
              ["Réservations semaine", widgets.bookings_last_week],
              ["Revenus capturés", `${widgets.revenue_total_eur} €`],
              ["Incidents ouverts", widgets.open_incidents],
              ["Villes en croissance", widgets.growing_cities],
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
            <Card className="rounded-[1.8rem] p-5 md:p-6">
              <h2 className="text-xl font-semibold text-[var(--foreground)]">Vision instantanée</h2>
              <div className="mt-5 space-y-4 text-sm leading-7">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[var(--foreground-muted)]">Conversion visite → réservation</span>
                  <span className="font-medium text-[var(--foreground)]">
                    {widgets.conversion_visit_to_booking}%
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[var(--foreground-muted)]">Revenus 30 jours</span>
                  <span className="font-medium text-[var(--foreground)]">
                    {widgets.revenue_last_month_eur} €
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[var(--foreground-muted)]">Praticiens activés</span>
                  <span className="font-medium text-[var(--foreground)]">
                    {widgets.activated_practitioners}
                  </span>
                </div>
              </div>
            </Card>

            <Card className="rounded-[1.8rem] p-5 md:p-6 xl:col-span-2">
              <h2 className="text-xl font-semibold text-[var(--foreground)]">Villes en croissance</h2>
              <div className="mt-5 grid gap-3 lg:grid-cols-2">
                {data?.top_cities.map((city) => (
                  <div
                    key={city.city_slug}
                    className="rounded-[1.4rem] border border-[var(--border)] bg-[var(--background-soft)] p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="break-words font-medium text-[var(--foreground)]">{city.city_label}</p>
                      <p className="text-sm text-[var(--foreground-muted)]">
                        {city.coverage_percent}% · {city.active_profiles}/{city.objective_profiles_total}
                      </p>
                    </div>
                    <p className="mt-2 break-words text-sm text-[var(--foreground-muted)]">
                      {city.claimed_profiles} revendiqués · {city.active_profiles} actifs
                    </p>
                    <p className="mt-3 break-words text-sm leading-6 text-[var(--foreground-muted)]">
                      {city.recommended_action}
                    </p>
                  </div>
                ))}
              </div>
            </Card>
          </section>

          <section className="grid gap-6 xl:grid-cols-3">
            <MiniBarChart title="Évolution trafic" points={data.charts.traffic} />
            <MiniBarChart title="Évolution réservations" points={data.charts.bookings} />
            <MiniBarChart title="Activation praticiens" points={data.charts.activation} />
          </section>

          <section className="grid gap-6 xl:grid-cols-2">
            <Card className="rounded-[1.8rem] p-5 md:p-6">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-xl font-semibold text-[var(--foreground)]">Top profils</h2>
                <Link href="/admin/ranking" className="text-sm text-[var(--primary)]">
                  Voir le classement
                </Link>
              </div>
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
                        {profile.average_rating}/5 · {profile.bookings_count} réservations
                      </p>
                    </div>
                    <p className="mt-2 break-words text-sm text-[var(--foreground-muted)]">
                      {profile.city} · {profile.is_public ? "profil public" : "profil privé"}
                    </p>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="rounded-[1.8rem] p-5 md:p-6">
              <h2 className="text-xl font-semibold text-[var(--foreground)]">Raccourcis opérateur</h2>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {[
                  ["/admin/users", "Gérer les comptes"],
                  ["/admin/moderation", "Traiter les signalements"],
                  ["/admin/campaigns", "Lancer une campagne"],
                  ["/ops", "Piloter les villes"],
                ].map(([href, label]) => (
                  <Link
                    key={href}
                    href={href}
                    className="rounded-[1.3rem] border border-[var(--border)] bg-[var(--background-soft)] px-4 py-4 text-sm font-medium text-[var(--foreground)] transition hover:border-[var(--border-strong)]"
                  >
                    {label}
                  </Link>
                ))}
              </div>
            </Card>
          </section>
        </>
      ) : null}
    </div>
  );
}

