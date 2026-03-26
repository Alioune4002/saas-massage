"use client";

import { useEffect, useState } from "react";

import { getAdminAnalyticsOverview, type AdminAnalyticsOverview } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Notice } from "@/components/ui/notice";
import { Skeleton } from "@/components/ui/skeleton";

export function AnalyticsDashboard() {
  const [data, setData] = useState<AdminAnalyticsOverview | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const overview = await getAdminAnalyticsOverview();
        if (active) {
          setData(overview);
          setError("");
        }
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : "Impossible de charger les analytics.");
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
        <Skeleton className="h-[28rem] rounded-[2rem]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error ? <Notice tone="error">{error}</Notice> : null}

      {data ? (
        <>
          <section className="grid gap-4 md:grid-cols-4">
            {[
              ["Utilisateurs", data.kpis.users_total],
              ["Praticiens", data.kpis.practitioners_total],
              ["Profils publics", data.kpis.public_profiles_total],
              ["Réservations", data.kpis.bookings_total],
              ["Claims approuvés", data.kpis.claims_approved_total],
              ["Suggestions", data.kpis.suggestions_total],
              ["Campagnes", data.kpis.campaigns_total],
              ["Villes pilotées", data.kpis.city_plans_total],
            ].map(([label, value]) => (
              <Card key={String(label)} className="rounded-[1.6rem] p-5">
                <p className="text-sm text-[var(--foreground-muted)]">{label}</p>
                <p className="mt-2 text-3xl font-semibold text-[var(--foreground)]">{String(value)}</p>
              </Card>
            ))}
          </section>

          <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
            <Card className="rounded-[1.8rem] p-6">
              <h2 className="text-2xl font-semibold text-[var(--foreground)]">Ratios disponibles</h2>
              <div className="mt-5 space-y-4 text-sm leading-7">
                {Object.entries(data.ratios).map(([key, value]) => (
                  <div key={key} className="flex items-center justify-between gap-3">
                    <span className="text-[var(--foreground-muted)]">{key}</span>
                    <span className="font-medium text-[var(--foreground)]">{value}%</span>
                  </div>
                ))}
              </div>
              <div className="mt-6 space-y-3 rounded-[1.4rem] border border-[var(--border)] bg-[var(--background-soft)] p-4 text-sm leading-7 text-[var(--foreground-muted)]">
                {Object.entries(data.tracking_notes).map(([key, value]) => (
                  <p key={key}>
                    <span className="font-medium text-[var(--foreground)]">{key}</span>
                    {" · "}
                    {value}
                  </p>
                ))}
              </div>
            </Card>

            <Card className="rounded-[1.8rem] p-6">
              <h2 className="text-2xl font-semibold text-[var(--foreground)]">Villes qui performent</h2>
              <div className="mt-5 space-y-3">
                {data.top_cities.map((city) => (
                  <div
                    key={city.city_slug}
                    className="rounded-[1.4rem] border border-[var(--border)] bg-[var(--background-soft)] p-4"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-medium text-[var(--foreground)]">{city.city_label}</p>
                      <p className="text-sm text-[var(--foreground-muted)]">{city.coverage_percent}%</p>
                    </div>
                    <p className="mt-2 text-sm text-[var(--foreground-muted)]">
                      {city.claimed_profiles} revendiqués · {city.active_profiles} actifs · priorité{" "}
                      {city.priority_level}
                    </p>
                    <p className="mt-3 text-sm leading-6 text-[var(--foreground-muted)]">
                      {city.recommended_action}
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
