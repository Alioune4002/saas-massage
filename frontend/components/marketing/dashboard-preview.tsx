import { CalendarClock, Sparkles, WalletCards } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

const mockStats = [
  { label: "Services actifs", value: "12", icon: Sparkles },
  { label: "Créneaux ouverts", value: "28", icon: CalendarClock },
  { label: "CA confirmé", value: "3 240 €", icon: WalletCards },
];

export function DashboardPreview() {
  return (
    <Card className="relative overflow-hidden rounded-[2rem] p-5 md:p-6">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(124,156,255,0.16),transparent_26%),radial-gradient(circle_at_bottom_left,rgba(143,242,203,0.14),transparent_24%)]" />
      <div className="relative">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-[0.26em] text-[var(--primary)]/80">
              Interface pro
            </p>
            <h3 className="mt-2 text-2xl font-semibold text-[var(--foreground)]">
              Tableau de bord NUADYX
            </h3>
          </div>
          <Badge tone="success">Mobile et ordinateur</Badge>
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-3">
          {mockStats.map((item) => (
            <div
              key={item.label}
              className="rounded-[1.4rem] border border-[var(--border)] bg-[var(--surface-muted)] p-4"
            >
              <div className="flex items-center justify-between gap-3">
                <p className="min-w-0 text-sm text-[var(--foreground-subtle)]">
                  {item.label}
                </p>
                <item.icon className="h-4.5 w-4.5 text-[var(--primary)]" />
              </div>
              <p className="mt-4 text-2xl font-semibold text-[var(--foreground)]">
                {item.value}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-[1.5rem] border border-[var(--border)] bg-[var(--background-soft)] p-4">
            <div className="flex items-center justify-between gap-3">
              <h4 className="text-base font-semibold text-[var(--foreground)]">
                Réservations du jour
              </h4>
              <Badge tone="info">5 demandes</Badge>
            </div>
            <div className="mt-4 space-y-3">
              {[
                ["09:30", "Massage Signature 60 min", "Confirmée"],
                ["11:00", "Drainage bien-être", "En attente"],
                ["14:30", "Massage deep tissue", "Confirmée"],
              ].map(([time, title, status]) => (
                <div
                  key={`${time}-${title}`}
                  className="flex items-center justify-between gap-4 rounded-[1.2rem] border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[var(--foreground)]">
                      {title}
                    </p>
                    <p className="mt-1 text-xs uppercase tracking-[0.2em] text-[var(--foreground-subtle)]">
                      {time}
                    </p>
                  </div>
                  <Badge tone={status === "Confirmée" ? "success" : "warning"}>
                    {status}
                  </Badge>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[1.5rem] border border-[var(--border)] bg-[var(--surface-muted)] p-4">
            <h4 className="text-base font-semibold text-[var(--foreground)]">
              Planning fluide
            </h4>
            <div className="mt-4 space-y-3">
              {[
                ["Lundi", "08:00", "16:00"],
                ["Mardi", "10:00", "19:00"],
                ["Jeudi", "09:30", "18:30"],
              ].map(([day, start, end]) => (
                <div
                  key={day}
                  className="rounded-[1.2rem] border border-[var(--border)] bg-[var(--background-soft)] px-4 py-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-medium text-[var(--foreground)]">{day}</p>
                    <p className="text-sm text-[var(--foreground-muted)]">
                      {start} → {end}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
