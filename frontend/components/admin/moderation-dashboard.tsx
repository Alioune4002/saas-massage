"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";

import {
  decideAdminModerationIncident,
  getAdminModerationIncident,
  getAdminModerationIncidents,
  getAdminModerationOverview,
  getAdminModerationRestrictions,
  getAdminModerationRiskEntries,
  updateAdminModerationIncident,
  type ModerationIncidentRecord,
  type ModerationOverview,
  type RestrictionRecord,
  type RiskEntryRecord,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FieldWrapper, Input, Select, Textarea } from "@/components/ui/field";
import { Notice } from "@/components/ui/notice";
import { Skeleton } from "@/components/ui/skeleton";

export function ModerationDashboard() {
  const [overview, setOverview] = useState<ModerationOverview | null>(null);
  const [incidents, setIncidents] = useState<ModerationIncidentRecord[]>([]);
  const [restrictions, setRestrictions] = useState<RestrictionRecord[]>([]);
  const [riskEntries, setRiskEntries] = useState<RiskEntryRecord[]>([]);
  const [selectedIncidentId, setSelectedIncidentId] = useState("");
  const [selectedIncident, setSelectedIncident] = useState<ModerationIncidentRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [filters, setFilters] = useState({
    status: "",
    severity: "",
    reported_party_type: "",
    q: "",
  });

  const relatedRiskEntries = riskEntries.filter((entry) => {
    if (!selectedIncident) {
      return false;
    }
    return (
      (!!entry.professional_name &&
        entry.professional_name === selectedIncident.professional_name) ||
      (!!entry.client_email &&
        entry.client_email === selectedIncident.client_email)
    );
  });
  const relatedRestrictions = restrictions.filter((restriction) => {
    if (!selectedIncident) {
      return false;
    }
    return (
      (!!restriction.professional_name &&
        restriction.professional_name === selectedIncident.professional_name) ||
      (!!restriction.client_email &&
        restriction.client_email === selectedIncident.client_email)
    );
  });
  const trustScore = Math.max(
    0,
    100 - relatedRiskEntries.length * 20 - relatedRestrictions.length * 15
  );

  const loadAll = useCallback(async () => {
    const [overviewData, incidentsData, restrictionsData, riskData] = await Promise.all([
      getAdminModerationOverview(),
      getAdminModerationIncidents(filters),
      getAdminModerationRestrictions({ status: "active" }),
      getAdminModerationRiskEntries({ is_active: true }),
    ]);
    setOverview(overviewData);
    setIncidents(incidentsData);
    setRestrictions(restrictionsData);
    setRiskEntries(riskData);
    setSelectedIncidentId((current) => current || incidentsData[0]?.id || "");
  }, [filters]);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        setLoading(true);
        await loadAll();
        if (active) {
          setError("");
        }
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : "Impossible de charger la modération.");
        }
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
  }, [loadAll]);

  useEffect(() => {
    if (!selectedIncidentId) {
      setSelectedIncident(null);
      return;
    }
    let active = true;
    async function loadIncident() {
      try {
        const data = await getAdminModerationIncident(selectedIncidentId);
        if (active) {
          setSelectedIncident(data);
        }
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : "Impossible de charger le signalement.");
        }
      }
    }
    void loadIncident();
    return () => {
      active = false;
    };
  }, [selectedIncidentId]);

  async function refreshSelected() {
    await loadAll();
    if (selectedIncidentId) {
      setSelectedIncident(await getAdminModerationIncident(selectedIncidentId));
    }
  }

  async function handleDecision(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedIncidentId) {
      return;
    }
    const formData = new FormData(event.currentTarget);
    try {
      await decideAdminModerationIncident(selectedIncidentId, {
        decision_type: String(formData.get("decision_type") || "dismiss") as
          | "dismiss"
          | "warn"
          | "restrict"
          | "suspend"
          | "ban",
        notes: String(formData.get("notes") || ""),
        duration_days: formData.get("duration_days")
          ? Number(formData.get("duration_days"))
          : null,
      });
      setNotice("Décision modérateur enregistrée.");
      setError("");
      await refreshSelected();
      event.currentTarget.reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible d’enregistrer la décision.");
    }
  }

  async function handleQuickUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedIncidentId) {
      return;
    }
    const formData = new FormData(event.currentTarget);
    try {
      await updateAdminModerationIncident(selectedIncidentId, {
        status: String(formData.get("status") || "") as
          | "open"
          | "in_review"
          | "resolved"
          | "rejected",
        severity: String(formData.get("severity") || "") as
          | "low"
          | "medium"
          | "high"
          | "critical",
        admin_notes: String(formData.get("admin_notes") || ""),
      });
      setNotice("Signalement mis à jour.");
      setError("");
      await refreshSelected();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de mettre à jour le signalement.");
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

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {overview
          ? [
              ["Signalements ouverts", overview.open_incidents],
              ["En revue", overview.in_review_incidents],
              ["Critiques", overview.critical_incidents],
              ["Restrictions actives", overview.active_restrictions],
              ["Entrées risque", overview.active_risk_entries],
            ].map(([label, value]) => (
              <Card key={String(label)} className="rounded-[1.6rem] p-5">
                <p className="text-sm text-[var(--foreground-muted)]">{label}</p>
                <p className="mt-2 text-3xl font-semibold text-[var(--foreground)]">{String(value)}</p>
              </Card>
            ))
          : null}
      </section>

      <section className="grid gap-6 2xl:grid-cols-[1.05fr_0.95fr]">
        <Card className="min-w-0 rounded-[1.8rem] p-5 md:p-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <FieldWrapper label="Statut">
              <Select
                value={filters.status}
                onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}
              >
                <option value="">Tous</option>
                <option value="open">Ouvert</option>
                <option value="in_review">En revue</option>
                <option value="resolved">Résolu</option>
                <option value="rejected">Rejeté</option>
              </Select>
            </FieldWrapper>
            <FieldWrapper label="Gravité">
              <Select
                value={filters.severity}
                onChange={(event) => setFilters((current) => ({ ...current, severity: event.target.value }))}
              >
                <option value="">Toutes</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </Select>
            </FieldWrapper>
            <FieldWrapper label="Cible">
              <Select
                value={filters.reported_party_type}
                onChange={(event) =>
                  setFilters((current) => ({ ...current, reported_party_type: event.target.value }))
                }
              >
                <option value="">Toutes</option>
                <option value="practitioner">Praticien</option>
                <option value="client">Client</option>
              </Select>
            </FieldWrapper>
            <FieldWrapper label="Recherche">
              <Input
                value={filters.q}
                onChange={(event) => setFilters((current) => ({ ...current, q: event.target.value }))}
                placeholder="email, praticien, motif"
              />
            </FieldWrapper>
          </div>

          <div className="mt-5 space-y-3">
            {incidents.map((incident) => (
              <button
                key={incident.id}
                type="button"
                onClick={() => setSelectedIncidentId(incident.id)}
                className={`w-full rounded-[1.4rem] border p-4 text-left transition ${
                  incident.id === selectedIncidentId
                    ? "border-[var(--primary)] bg-[var(--primary)]/8"
                    : "border-[var(--border)] bg-[var(--background-soft)] hover:border-[var(--border-strong)]"
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="break-words font-medium text-[var(--foreground)]">
                      {incident.professional_name} · {incident.client_name}
                    </p>
                    <p className="mt-1 break-words text-sm text-[var(--foreground-muted)]">
                      {incident.category} · {incident.status} · {incident.severity}
                    </p>
                  </div>
                  <p className="text-sm text-[var(--foreground-muted)]">
                    {new Date(incident.created_at).toLocaleDateString("fr-FR")}
                  </p>
                </div>
                <p className="mt-3 break-words text-sm leading-6 text-[var(--foreground-muted)]">
                  {incident.description}
                </p>
              </button>
            ))}
            {!incidents.length ? (
              <div className="rounded-[1.4rem] border border-dashed border-[var(--border)] p-6 text-sm text-[var(--foreground-muted)]">
                Aucun signalement ne correspond aux filtres actuels.
              </div>
            ) : null}
          </div>
        </Card>

        <div className="min-w-0 space-y-6">
          <Card className="min-w-0 rounded-[1.8rem] p-5 md:p-6">
            <h2 className="text-2xl font-semibold text-[var(--foreground)]">
              Détail signalement
            </h2>
            {selectedIncident ? (
              <>
                <div className="mt-4 space-y-3 text-sm leading-7 text-[var(--foreground-muted)]">
                  <p className="break-words"><span className="font-medium text-[var(--foreground)]">Praticien :</span> {selectedIncident.professional_name}</p>
                  <p className="break-words"><span className="font-medium text-[var(--foreground)]">Client :</span> {selectedIncident.client_name} · {selectedIncident.client_email}</p>
                  <p className="break-words"><span className="font-medium text-[var(--foreground)]">Motif :</span> {selectedIncident.category}</p>
                  <p className="break-words"><span className="font-medium text-[var(--foreground)]">Description :</span> {selectedIncident.description}</p>
                  <p className="break-words"><span className="font-medium text-[var(--foreground)]">Résolution :</span> {selectedIncident.resolution || "En attente"}</p>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-[1.2rem] border border-[var(--border)] bg-[var(--background-soft)] p-4 text-sm">
                    <p className="text-[var(--foreground-muted)]">Score de confiance</p>
                    <p className="mt-2 text-2xl font-semibold text-[var(--foreground)]">{trustScore}/100</p>
                  </div>
                  <div className="rounded-[1.2rem] border border-[var(--border)] bg-[var(--background-soft)] p-4 text-sm">
                    <p className="text-[var(--foreground-muted)]">Restrictions liées</p>
                    <p className="mt-2 text-2xl font-semibold text-[var(--foreground)]">{relatedRestrictions.length}</p>
                  </div>
                  <div className="rounded-[1.2rem] border border-[var(--border)] bg-[var(--background-soft)] p-4 text-sm">
                    <p className="text-[var(--foreground-muted)]">Signaux risque</p>
                    <p className="mt-2 text-2xl font-semibold text-[var(--foreground)]">{relatedRiskEntries.length}</p>
                  </div>
                </div>

                <form onSubmit={handleQuickUpdate} className="mt-5 space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <FieldWrapper label="Statut">
                      <Select name="status" defaultValue={selectedIncident.status}>
                        <option value="open">open</option>
                        <option value="in_review">in_review</option>
                        <option value="resolved">resolved</option>
                        <option value="rejected">rejected</option>
                      </Select>
                    </FieldWrapper>
                    <FieldWrapper label="Gravité">
                      <Select name="severity" defaultValue={selectedIncident.severity}>
                        <option value="low">low</option>
                        <option value="medium">medium</option>
                        <option value="high">high</option>
                        <option value="critical">critical</option>
                      </Select>
                    </FieldWrapper>
                  </div>
                  <FieldWrapper label="Notes modération">
                    <Textarea name="admin_notes" defaultValue={selectedIncident.admin_notes || ""} />
                  </FieldWrapper>
                  <Button type="submit" variant="secondary">Mettre à jour</Button>
                </form>

                <form onSubmit={handleDecision} className="mt-6 space-y-4 rounded-[1.4rem] border border-[var(--border)] p-5">
                  <h3 className="text-lg font-semibold text-[var(--foreground)]">Décision modérateur</h3>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <FieldWrapper label="Décision">
                      <Select name="decision_type" defaultValue="dismiss">
                        <option value="dismiss">Classer sans suite</option>
                        <option value="warn">Avertissement</option>
                        <option value="restrict">Restriction</option>
                        <option value="suspend">Suspension</option>
                        <option value="ban">Bannissement</option>
                      </Select>
                    </FieldWrapper>
                    <FieldWrapper label="Durée en jours">
                      <Input name="duration_days" type="number" min={1} placeholder="ex. 14" />
                    </FieldWrapper>
                  </div>
                  <FieldWrapper label="Notes décision">
                    <Textarea name="notes" />
                  </FieldWrapper>
                  <Button type="submit">Enregistrer la décision</Button>
                </form>

                <div className="mt-6 space-y-3 rounded-[1.4rem] border border-[var(--border)] p-5">
                  <h3 className="text-lg font-semibold text-[var(--foreground)]">Historique sanctions</h3>
                  {selectedIncident.decisions.length ? (
                    selectedIncident.decisions.map((decision) => (
                      <div
                        key={decision.id}
                        className="rounded-[1.2rem] border border-[var(--border)] bg-[var(--background-soft)] p-4 text-sm"
                      >
                        <p className="font-medium text-[var(--foreground)]">
                          {decision.decision_type} · {decision.created_by_email}
                        </p>
                        <p className="mt-1 break-words text-[var(--foreground-muted)]">
                          {decision.notes || "Sans note"} · {new Date(decision.created_at).toLocaleString("fr-FR")}
                        </p>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-[var(--foreground-muted)]">
                      Aucune sanction enregistrée pour ce signalement.
                    </p>
                  )}
                </div>
              </>
            ) : (
              <p className="mt-4 text-sm text-[var(--foreground-muted)]">
                Sélectionnez un signalement pour le traiter.
              </p>
            )}
          </Card>

          <section className="grid gap-6">
            <Card className="min-w-0 rounded-[1.8rem] p-5 md:p-6">
              <h2 className="text-xl font-semibold text-[var(--foreground)]">Restrictions actives</h2>
              <div className="mt-4 space-y-3">
                {restrictions.slice(0, 6).map((restriction) => (
                  <div key={restriction.id} className="rounded-[1.3rem] border border-[var(--border)] bg-[var(--background-soft)] p-4 text-sm">
                    <p className="font-medium text-[var(--foreground)]">
                      {restriction.restriction_type} · {restriction.status}
                    </p>
                    <p className="mt-1 break-words text-[var(--foreground-muted)]">
                      {restriction.professional_name || restriction.client_email || restriction.client_phone}
                    </p>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="min-w-0 rounded-[1.8rem] p-5 md:p-6">
              <h2 className="text-xl font-semibold text-[var(--foreground)]">Registre de risque</h2>
              <div className="mt-4 space-y-3">
                {riskEntries.slice(0, 6).map((entry) => (
                  <div key={entry.id} className="rounded-[1.3rem] border border-[var(--border)] bg-[var(--background-soft)] p-4 text-sm">
                    <p className="font-medium text-[var(--foreground)]">
                      {entry.risk_level} · {entry.reason}
                    </p>
                    <p className="mt-1 break-words text-[var(--foreground-muted)]">
                      {entry.professional_name || entry.client_email || entry.client_phone}
                    </p>
                  </div>
                ))}
              </div>
            </Card>
          </section>
        </div>
      </section>
    </div>
  );
}
