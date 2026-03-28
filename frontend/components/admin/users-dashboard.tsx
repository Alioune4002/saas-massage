"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";

import {
  bulkAdminUsersAction,
  getAdminUsers,
  updateAdminUser,
  type AdminUserDirectoryRecord,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FieldWrapper, Input, Select } from "@/components/ui/field";
import { Notice } from "@/components/ui/notice";
import { Skeleton } from "@/components/ui/skeleton";

export function UsersDashboard() {
  const [rows, setRows] = useState<AdminUserDirectoryRecord[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [filters, setFilters] = useState({
    q: "",
    role: "",
    status: "",
    city: "",
    verification: "",
    public_status: "",
    incidented: "",
  });
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkMessage, setBulkMessage] = useState("");

  const load = useCallback(async (currentFilters = filters) => {
    const data = await getAdminUsers({
      q: currentFilters.q || undefined,
      role: currentFilters.role || undefined,
      status: (currentFilters.status as "active" | "suspended") || undefined,
      city: currentFilters.city || undefined,
      verification:
        (currentFilters.verification as "verified" | "unverified") || undefined,
      public_status:
        (currentFilters.public_status as "public" | "private") || undefined,
      incidented:
        currentFilters.incidented === ""
          ? undefined
          : currentFilters.incidented === "true",
    });
    setRows(data);
    setSelectedId((current) => current || data[0]?.id || "");
    setSelectedIds((current) => current.filter((id) => data.some((row) => row.id === id)));
  }, [filters]);

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
          setError(err instanceof Error ? err.message : "Impossible de charger les comptes.");
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
  }, [load]);

  const selectedUser = useMemo(
    () => rows.find((row) => row.id === selectedId) || null,
    [rows, selectedId]
  );

  async function handleFilterSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      await load();
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Filtrage impossible.");
    }
  }

  async function handleToggleStatus() {
    if (!selectedUser) return;
    try {
      await updateAdminUser(selectedUser.id, { is_active: !selectedUser.is_active });
      setNotice(
        selectedUser.is_active
          ? "Compte suspendu."
          : "Compte réactivé."
      );
      setError("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de mettre à jour le compte.");
    }
  }

  async function handleAdminRoleChange(value: "" | "admin" | "moderator" | "support" | "ops") {
    if (!selectedUser || selectedUser.role !== "admin") {
      return;
    }
    try {
      await updateAdminUser(selectedUser.id, { admin_role: value });
      setNotice("Rôle admin mis à jour.");
      setError("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de mettre à jour le rôle.");
    }
  }

  function toggleSelection(id: string) {
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id]
    );
  }

  async function handleBulkAction(
    action:
      | "suspend"
      | "reactivate"
      | "assign_support"
      | "assign_moderation"
      | "send_group_message"
      | "export_csv"
  ) {
    if (!selectedIds.length) {
      setError("Sélectionnez au moins un compte.");
      return;
    }
    try {
      const result = await bulkAdminUsersAction({
        ids: selectedIds,
        action,
        title:
          action === "assign_support"
            ? "Prise en charge support"
            : action === "assign_moderation"
              ? "Prise en charge modération"
              : "Message plateforme",
        body: bulkMessage || "Un message vous a été envoyé par l’équipe NUADYX.",
        category:
          action === "assign_support"
            ? "support"
            : action === "assign_moderation"
              ? "moderation"
              : "product",
        display_mode: "inbox",
        reply_allowed: false,
        ticket_status: "pending",
      });
      if (action === "export_csv" && result.rows) {
        const headers = Object.keys(result.rows[0] || {});
        const lines = [
          headers.join(","),
          ...result.rows.map((row) =>
            headers
              .map((header) => `"${String(row[header] ?? "").replaceAll('"', '""')}"`)
              .join(",")
          ),
        ];
        const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = "nuadyx-admin-users.csv";
        link.click();
        window.URL.revokeObjectURL(url);
        setNotice("Export CSV généré.");
      } else {
        setNotice("Action groupée appliquée.");
      }
      setError("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action groupée impossible.");
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

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Comptes listés", rows.length],
          ["Praticiens", rows.filter((row) => row.role === "professional").length],
          ["Admins", rows.filter((row) => row.role === "admin").length],
          ["Suspendus", rows.filter((row) => !row.is_active).length],
        ].map(([label, value]) => (
          <Card key={String(label)} className="rounded-[1.6rem] p-5">
            <p className="text-sm text-[var(--foreground-muted)]">{label}</p>
            <p className="mt-2 text-3xl font-semibold text-[var(--foreground)]">{String(value)}</p>
          </Card>
        ))}
      </section>

      <section className="grid gap-6 2xl:grid-cols-[1.15fr_0.85fr]">
        <Card className="min-w-0 rounded-[1.8rem] p-5 md:p-6">
          <form onSubmit={handleFilterSubmit} className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <FieldWrapper label="Recherche">
              <Input
                value={filters.q}
                onChange={(event) => setFilters((current) => ({ ...current, q: event.target.value }))}
                placeholder="nom, email, praticien"
              />
            </FieldWrapper>
            <FieldWrapper label="Rôle">
              <Select
                value={filters.role}
                onChange={(event) => setFilters((current) => ({ ...current, role: event.target.value }))}
              >
                <option value="">Tous</option>
                <option value="professional">Praticien</option>
                <option value="admin">Admin</option>
              </Select>
            </FieldWrapper>
            <FieldWrapper label="Statut">
              <Select
                value={filters.status}
                onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}
              >
                <option value="">Tous</option>
                <option value="active">Actif</option>
                <option value="suspended">Suspendu</option>
              </Select>
            </FieldWrapper>
            <FieldWrapper label="Ville">
              <Input
                value={filters.city}
                onChange={(event) => setFilters((current) => ({ ...current, city: event.target.value }))}
                placeholder="ville"
              />
            </FieldWrapper>
            <FieldWrapper label="Vérification">
              <Select
                value={filters.verification}
                onChange={(event) =>
                  setFilters((current) => ({ ...current, verification: event.target.value }))
                }
              >
                <option value="">Toutes</option>
                <option value="verified">Vérifié</option>
                <option value="unverified">Non vérifié</option>
              </Select>
            </FieldWrapper>
            <FieldWrapper label="Visibilité publique">
              <Select
                value={filters.public_status}
                onChange={(event) =>
                  setFilters((current) => ({ ...current, public_status: event.target.value }))
                }
              >
                <option value="">Tous</option>
                <option value="public">Public</option>
                <option value="private">Privé</option>
              </Select>
            </FieldWrapper>
            <FieldWrapper label="Incidents">
              <Select
                value={filters.incidented}
                onChange={(event) =>
                  setFilters((current) => ({ ...current, incidented: event.target.value }))
                }
              >
                <option value="">Tous</option>
                <option value="true">Avec incident</option>
                <option value="false">Sans incident</option>
              </Select>
            </FieldWrapper>
            <div className="sm:col-span-2 xl:col-span-4">
              <Button type="submit" variant="secondary">Actualiser la table</Button>
            </div>
          </form>

          <div className="mt-5 rounded-[1.4rem] border border-[var(--border)] bg-[var(--background-soft)] p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
              <div className="flex-1">
                <FieldWrapper label="Message groupé">
                  <Input
                    value={bulkMessage}
                    onChange={(event) => setBulkMessage(event.target.value)}
                    placeholder="Message utilisé pour support, modération ou envoi groupé"
                  />
                </FieldWrapper>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-6">
                <Button type="button" variant="secondary" onClick={() => void handleBulkAction("suspend")}>
                  Suspendre
                </Button>
                <Button type="button" variant="secondary" onClick={() => void handleBulkAction("reactivate")}>
                  Réactiver
                </Button>
                <Button type="button" variant="ghost" onClick={() => void handleBulkAction("assign_support")}>
                  Support
                </Button>
                <Button type="button" variant="ghost" onClick={() => void handleBulkAction("assign_moderation")}>
                  Modération
                </Button>
                <Button type="button" variant="ghost" onClick={() => void handleBulkAction("send_group_message")}>
                  Message groupé
                </Button>
                <Button type="button" variant="ghost" onClick={() => void handleBulkAction("export_csv")}>
                  Export CSV
                </Button>
              </div>
            </div>
            <p className="mt-3 text-sm text-[var(--foreground-muted)]">
              {selectedIds.length} compte(s) sélectionné(s)
            </p>
          </div>

          <div className="mt-6 overflow-x-auto">
            <table className="min-w-[1280px] w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] text-[var(--foreground-muted)]">
                  <th className="px-3 py-3 font-medium">Sel.</th>
                  <th className="px-3 py-3 font-medium">Nom</th>
                  <th className="px-3 py-3 font-medium">Email</th>
                  <th className="px-3 py-3 font-medium">Rôle</th>
                  <th className="px-3 py-3 font-medium">Statut</th>
                  <th className="px-3 py-3 font-medium">Ville</th>
                  <th className="px-3 py-3 font-medium">Réservations</th>
                  <th className="px-3 py-3 font-medium">Note</th>
                  <th className="px-3 py-3 font-medium">Public</th>
                  <th className="px-3 py-3 font-medium">Vérification</th>
                  <th className="px-3 py-3 font-medium">Visibilité</th>
                  <th className="px-3 py-3 font-medium">Paiements</th>
                  <th className="px-3 py-3 font-medium">Incidents</th>
                  <th className="px-3 py-3 font-medium">Inscription</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.id}
                    className={`cursor-pointer border-b border-[var(--border)]/70 transition hover:bg-[var(--background-soft)] ${
                      row.id === selectedId ? "bg-[var(--primary)]/8" : ""
                    }`}
                    onClick={() => setSelectedId(row.id)}
                  >
                    <td className="px-3 py-3" onClick={(event) => event.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(row.id)}
                        onChange={() => toggleSelection(row.id)}
                      />
                    </td>
                    <td className="px-3 py-3">
                      <div className="min-w-0">
                        <p className="break-words font-medium text-[var(--foreground)]">
                          {row.professional_name ||
                            `${row.first_name} ${row.last_name}`.trim() ||
                            row.email}
                        </p>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-[var(--foreground-muted)]">{row.email}</td>
                    <td className="px-3 py-3 text-[var(--foreground-muted)]">
                      {row.role === "admin"
                        ? `admin${row.admin_role ? ` · ${row.admin_role}` : ""}`
                        : "praticien"}
                    </td>
                    <td className="px-3 py-3">
                      {row.is_active ? "actif" : "suspendu"}
                    </td>
                    <td className="px-3 py-3 text-[var(--foreground-muted)]">{row.city || "—"}</td>
                    <td className="px-3 py-3 text-[var(--foreground-muted)]">{row.bookings_count}</td>
                    <td className="px-3 py-3 text-[var(--foreground-muted)]">{row.average_rating || "0.00"}</td>
                    <td className="px-3 py-3 text-[var(--foreground-muted)]">{row.is_public_profile ? "public" : "privé"}</td>
                    <td className="px-3 py-3 text-[var(--foreground-muted)]">{row.verification_badge_status}</td>
                    <td className="px-3 py-3 text-[var(--foreground-muted)]">{row.profile_visibility_score}</td>
                    <td className="px-3 py-3 text-[var(--foreground-muted)]">{row.payment_account_status}</td>
                    <td className="px-3 py-3 text-[var(--foreground-muted)]">{row.incidents_count}</td>
                    <td className="px-3 py-3 text-[var(--foreground-muted)]">
                      {new Date(row.date_joined).toLocaleDateString("fr-FR")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card className="min-w-0 rounded-[1.8rem] p-5 md:p-6">
          <h2 className="text-2xl font-semibold text-[var(--foreground)]">Compte sélectionné</h2>
          {selectedUser ? (
            <div className="mt-5 space-y-5">
              <div className="space-y-2 text-sm leading-7 text-[var(--foreground-muted)]">
                <p><span className="font-medium text-[var(--foreground)]">Nom :</span> {selectedUser.professional_name || `${selectedUser.first_name} ${selectedUser.last_name}`.trim() || "—"}</p>
                <p><span className="font-medium text-[var(--foreground)]">Email :</span> {selectedUser.email}</p>
                <p><span className="font-medium text-[var(--foreground)]">Rôle :</span> {selectedUser.role === "admin" ? `admin ${selectedUser.admin_role || ""}` : "praticien"}</p>
                <p><span className="font-medium text-[var(--foreground)]">Ville :</span> {selectedUser.city || "—"}</p>
                <p><span className="font-medium text-[var(--foreground)]">Réservations :</span> {selectedUser.bookings_count}</p>
                <p><span className="font-medium text-[var(--foreground)]">Incidents :</span> {selectedUser.incidents_count}</p>
                <p><span className="font-medium text-[var(--foreground)]">Paiements :</span> {selectedUser.payments_total_eur} €</p>
                <p><span className="font-medium text-[var(--foreground)]">Statut Stripe :</span> {selectedUser.payment_account_status}</p>
                <p><span className="font-medium text-[var(--foreground)]">Visibilité :</span> {selectedUser.profile_visibility_score}</p>
                <p><span className="font-medium text-[var(--foreground)]">Profil public :</span> {selectedUser.is_public_profile ? "oui" : "non"}</p>
                <p><span className="font-medium text-[var(--foreground)]">Badge vérification :</span> {selectedUser.verification_badge_status}</p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <Button type="button" onClick={handleToggleStatus}>
                  {selectedUser.is_active ? "Suspendre" : "Réactiver"}
                </Button>
                {selectedUser.public_profile_url ? (
                  <Link href={selectedUser.public_profile_url} target="_blank" className="w-full">
                    <Button type="button" variant="secondary" className="w-full">
                      Voir profil public
                    </Button>
                  </Link>
                ) : (
                  <Button type="button" variant="secondary" disabled>
                    Pas de profil public
                  </Button>
                )}
                <Link href={`/admin/moderation`} className="w-full">
                  <Button type="button" variant="ghost" className="w-full">
                    Voir incidents liés
                  </Button>
                </Link>
                <Link href="/admin/analytics" className="w-full">
                  <Button type="button" variant="ghost" className="w-full">
                    Voir paiements & activité
                  </Button>
                </Link>
              </div>

              {selectedUser.role === "admin" ? (
                <FieldWrapper label="Rôle admin interne">
                  <Select
                    value={selectedUser.admin_role || ""}
                    onChange={(event) =>
                      void handleAdminRoleChange(
                        event.target.value as "" | "admin" | "moderator" | "support" | "ops"
                      )
                    }
                  >
                    <option value="admin">admin</option>
                    <option value="ops">ops</option>
                    <option value="moderator">moderator</option>
                    <option value="support">support</option>
                  </Select>
                </FieldWrapper>
              ) : null}
            </div>
          ) : (
            <p className="mt-5 text-sm text-[var(--foreground-muted)]">
              Sélectionnez un compte pour voir son historique, ses incidents et ses paiements.
            </p>
          )}
        </Card>
      </section>
    </div>
  );
}
