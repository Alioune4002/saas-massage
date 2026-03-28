"use client";

import { useEffect, useState } from "react";

import {
  getAdminPlatformSettings,
  type AdminPlatformSettingsSnapshot,
} from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Notice } from "@/components/ui/notice";
import { Skeleton } from "@/components/ui/skeleton";

function renderEntry(label: string, value: string | number | boolean) {
  return (
    <div key={label} className="flex flex-wrap items-center justify-between gap-3">
      <span className="break-words text-[var(--foreground-muted)]">{label}</span>
      <span className="font-medium text-[var(--foreground)]">{String(value)}</span>
    </div>
  );
}

export function SettingsDashboard() {
  const [data, setData] = useState<AdminPlatformSettingsSnapshot | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const snapshot = await getAdminPlatformSettings();
        if (active) {
          setData(snapshot);
          setError("");
        }
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : "Impossible de charger les paramètres.");
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
    <div className="space-y-6 overflow-x-clip">
      {error ? <Notice tone="error">{error}</Notice> : null}

      {data ? (
        <section className="grid gap-6 xl:grid-cols-2">
          <Card className="rounded-[1.8rem] p-5 md:p-6">
            <h2 className="text-2xl font-semibold text-[var(--foreground)]">État plateforme</h2>
            <div className="mt-5 space-y-4 text-sm leading-7">
              {Object.entries(data.platform).map(([label, value]) => renderEntry(label, value))}
            </div>
          </Card>

          <Card className="rounded-[1.8rem] p-5 md:p-6">
            <h2 className="text-2xl font-semibold text-[var(--foreground)]">Règles par défaut</h2>
            <div className="mt-5 space-y-4 text-sm leading-7">
              {Object.entries(data.defaults).map(([label, value]) => renderEntry(label, value))}
            </div>
          </Card>

          <Card className="rounded-[1.8rem] p-5 md:p-6">
            <h2 className="text-2xl font-semibold text-[var(--foreground)]">Support</h2>
            <div className="mt-5 space-y-4 text-sm leading-7">
              {Object.entries(data.support).map(([label, value]) => renderEntry(label, value))}
            </div>
          </Card>

          <Card className="rounded-[1.8rem] p-5 md:p-6">
            <h2 className="text-2xl font-semibold text-[var(--foreground)]">Sécurité & garde-fous</h2>
            <div className="mt-5 space-y-4 text-sm leading-7">
              {Object.entries(data.safety).map(([label, value]) => renderEntry(label, value))}
            </div>
          </Card>
        </section>
      ) : null}
    </div>
  );
}

