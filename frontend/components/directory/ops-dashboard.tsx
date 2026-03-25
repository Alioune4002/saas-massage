"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { useAuthSession } from "@/hooks/use-auth-session";
import {
  bulkActionImportedProfiles,
  createAdminImportedProfile,
  createAdminSource,
  createContactCampaign,
  getAdminImportedProfiles,
  getAdminImportJobs,
  getAdminSources,
  getRemovalRequests,
  runAdminSourceImport,
  sendContactCampaign,
  type ImportedProfileRecord,
  type RemovalRequestRecord,
  type SourceImportJobRecord,
  type SourceRegistryRecord,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FieldWrapper, Input, Select, Textarea } from "@/components/ui/field";
import { Notice } from "@/components/ui/notice";
import { Skeleton } from "@/components/ui/skeleton";

export function OpsDashboard() {
  const router = useRouter();
  const { user, loading, error } = useAuthSession();
  const [sources, setSources] = useState<SourceRegistryRecord[]>([]);
  const [jobs, setJobs] = useState<SourceImportJobRecord[]>([]);
  const [profiles, setProfiles] = useState<ImportedProfileRecord[]>([]);
  const [removals, setRemovals] = useState<RemovalRequestRecord[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [pageError, setPageError] = useState("");
  const [pageSuccess, setPageSuccess] = useState("");
  const [importSourceId, setImportSourceId] = useState("");
  const [currentStatusFilter, setCurrentStatusFilter] = useState("pending_review");

  useEffect(() => {
    if (!loading && user?.role !== "admin") {
      router.replace(user ? "/" : "/login");
    }
  }, [loading, router, user]);

  useEffect(() => {
    if (!user || user.role !== "admin") {
      return;
    }

    let active = true;
    async function load() {
      try {
        setLoadingData(true);
        const [sourcesData, jobsData, profilesData, removalsData] = await Promise.all([
          getAdminSources(),
          getAdminImportJobs(),
          getAdminImportedProfiles({ import_status: currentStatusFilter }),
          getRemovalRequests(),
        ]);
        if (!active) {
          return;
        }
        setSources(sourcesData);
        setJobs(jobsData);
        setProfiles(profilesData);
        setRemovals(removalsData);
        setImportSourceId((current) => current || sourcesData[0]?.id || "");
        setPageError("");
      } catch (err) {
        if (!active) {
          return;
        }
        setPageError(err instanceof Error ? err.message : "Impossible de charger le tableau ops.");
      } finally {
        if (active) {
          setLoadingData(false);
        }
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, [currentStatusFilter, user]);

  const reviewCount = useMemo(
    () =>
      profiles.filter(
        (profile) =>
          profile.import_status === "pending_review" ||
          Number(profile.confidence_score) >= 0.8
      ).length,
    [profiles]
  );

  async function handleCreateSource(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    try {
      const created = await createAdminSource({
        name: String(formData.get("name") || ""),
        base_url: String(formData.get("base_url") || ""),
        source_type: String(formData.get("source_type") || "manual_csv") as SourceRegistryRecord["source_type"],
        legal_status: "approved",
        is_active: true,
        requires_manual_review_before_publish: true,
        can_contact_imported_profiles: false,
        default_visibility_mode: "private_draft",
      });
      setSources((current) => [created, ...current]);
      setImportSourceId(created.id);
      setPageSuccess("Source créée.");
      setPageError("");
      event.currentTarget.reset();
    } catch (err) {
      setPageError(err instanceof Error ? err.message : "Impossible de créer la source.");
    }
  }

  async function handleCsvImport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const file = formData.get("file");
    if (!(file instanceof File) || !importSourceId) {
      setPageError("Sélectionnez une source et un fichier CSV.");
      return;
    }
    try {
      const result = await runAdminSourceImport({
        sourceId: importSourceId,
        file,
        dryRun: String(formData.get("dry_run") || "") === "on",
      });
      setPageSuccess(
        `Import traité: ${result.summary.total_created} créés, ${result.summary.total_updated} mis à jour, ${result.summary.total_flagged} signalés.`
      );
      setPageError("");
      const refreshedJobs = await getAdminImportJobs();
      setJobs(refreshedJobs);
      const refreshedProfiles = await getAdminImportedProfiles({ import_status: currentStatusFilter });
      setProfiles(refreshedProfiles);
    } catch (err) {
      setPageError(err instanceof Error ? err.message : "Import impossible.");
    }
  }

  async function handleManualProfileCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    try {
      await createAdminImportedProfile({
        public_name: String(formData.get("public_name") || ""),
        business_name: String(formData.get("business_name") || ""),
        city: String(formData.get("city") || ""),
        region: String(formData.get("region") || ""),
        email_public: String(formData.get("email_public") || ""),
        phone_public: String(formData.get("phone_public") || ""),
        bio_short: String(formData.get("bio_short") || ""),
        service_tags_json: String(formData.get("service_tags") || "")
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
        import_status: "draft_imported",
        claimable: true,
        publishable_minimum_ok: true,
      });
      setPageSuccess("Fiche candidate créée.");
      setPageError("");
      const refreshedProfiles = await getAdminImportedProfiles({ import_status: currentStatusFilter });
      setProfiles(refreshedProfiles);
      event.currentTarget.reset();
    } catch (err) {
      setPageError(err instanceof Error ? err.message : "Création impossible.");
    }
  }

  async function handleBulkAction(
    action:
      | "approve_internal"
      | "publish_unclaimed"
      | "reject"
      | "mark_removed"
      | "send_claim_invite"
  ) {
    try {
      const ids = profiles.slice(0, 5).map((profile) => profile.id);
      if (!ids.length) {
        setPageError("Aucune fiche à traiter dans la file actuelle.");
        return;
      }
      const result = await bulkActionImportedProfiles({ ids, action });
      setPageSuccess(`${result.updated} fiches traitées.`);
      setPageError("");
      const refreshedProfiles = await getAdminImportedProfiles({ import_status: currentStatusFilter });
      setProfiles(refreshedProfiles);
    } catch (err) {
      setPageError(err instanceof Error ? err.message : "Action bulk impossible.");
    }
  }

  async function handleSendCampaign() {
    try {
      const campaign = await createContactCampaign({
        name: "Invitation de revendication manuelle",
        campaign_type: "claim_invite",
        status: "ready",
        email_template_key: "claim_invite",
        audience_filter_json: {},
      });
      const result = await sendContactCampaign(campaign.id);
      setPageSuccess(`Campagne envoyée: ${result.sent} emails, ${result.failed} échecs.`);
      setPageError("");
    } catch (err) {
      setPageError(err instanceof Error ? err.message : "Campagne impossible.");
    }
  }

  if (loading || loadingData) {
    return (
      <main className="mx-auto max-w-7xl px-4 py-8 md:px-6">
        <Skeleton className="h-20 rounded-[2rem]" />
        <Skeleton className="mt-6 h-72 rounded-[2rem]" />
      </main>
    );
  }

  if (!user || user.role !== "admin") {
    return null;
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 md:px-6">
      <Card className="rounded-[2rem] p-6 md:p-8">
        <p className="text-xs uppercase tracking-[0.32em] text-[var(--primary)]/80">
          Imports & Annuaire
        </p>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight text-[var(--foreground)]">
          Dashboard d’opérations
        </h1>
        <p className="mt-4 text-sm leading-7 text-[var(--foreground-muted)]">
          Sources autorisées, imports, revue, publication contrôlée, revendications et suppressions.
          Aucun flux autonome hors whitelist n’est déclenché ici.
        </p>
      </Card>

      {error ? <Notice tone="error" className="mt-6">{error}</Notice> : null}
      {pageError ? <Notice tone="error" className="mt-6">{pageError}</Notice> : null}
      {pageSuccess ? <Notice tone="success" className="mt-6">{pageSuccess}</Notice> : null}

      <section className="mt-6 grid gap-4 xl:grid-cols-4">
        {[
          ["Sources", String(sources.length)],
          ["Jobs d’import", String(jobs.length)],
          ["File de review", String(reviewCount)],
          ["Suppressions", String(removals.length)],
        ].map(([label, value]) => (
          <Card key={label} className="rounded-[1.6rem] p-5">
            <p className="text-sm text-[var(--foreground-muted)]">{label}</p>
            <p className="mt-2 text-3xl font-semibold text-[var(--foreground)]">{value}</p>
          </Card>
        ))}
      </section>

      <section className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card className="rounded-[1.8rem] p-6">
          <h2 className="text-2xl font-semibold text-[var(--foreground)]">Créer une source</h2>
          <form onSubmit={handleCreateSource} className="mt-5 space-y-4">
            <FieldWrapper label="Nom de la source">
              <Input name="name" required />
            </FieldWrapper>
            <FieldWrapper label="Base URL">
              <Input name="base_url" placeholder="https://source.exemple.com" />
            </FieldWrapper>
            <FieldWrapper label="Type">
              <Select name="source_type" defaultValue="manual_csv">
                <option value="manual_csv">manual_csv</option>
                <option value="manual_form">manual_form</option>
                <option value="api">api</option>
                <option value="rss">rss</option>
                <option value="parser_custom">parser_custom</option>
              </Select>
            </FieldWrapper>
            <Button type="submit">Créer la source</Button>
          </form>
        </Card>

        <Card className="rounded-[1.8rem] p-6">
          <h2 className="text-2xl font-semibold text-[var(--foreground)]">Import CSV</h2>
          <form onSubmit={handleCsvImport} className="mt-5 space-y-4">
            <FieldWrapper label="Source">
              <Select value={importSourceId} onChange={(event) => setImportSourceId(event.target.value)}>
                {sources.map((source) => (
                  <option key={source.id} value={source.id}>
                    {source.name}
                  </option>
                ))}
              </Select>
            </FieldWrapper>
            <FieldWrapper label="Fichier CSV">
              <Input name="file" type="file" accept=".csv,text/csv" required />
            </FieldWrapper>
            <label className="flex items-center gap-3 text-sm text-[var(--foreground-muted)]">
              <input type="checkbox" name="dry_run" />
              Simulation dry-run avant écriture
            </label>
            <Button type="submit">Lancer l’import</Button>
          </form>
        </Card>
      </section>

      <section className="mt-6 grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Card className="rounded-[1.8rem] p-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-[var(--foreground)]">File de review</h2>
              <div className="mt-3 max-w-xs">
                <FieldWrapper label="Statut courant">
                  <Select
                    value={currentStatusFilter}
                    onChange={(event) => setCurrentStatusFilter(event.target.value)}
                  >
                    <option value="draft_imported">draft_imported</option>
                    <option value="pending_review">pending_review</option>
                    <option value="approved_internal">approved_internal</option>
                    <option value="published_unclaimed">published_unclaimed</option>
                    <option value="removed">removed</option>
                  </Select>
                </FieldWrapper>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => handleBulkAction("approve_internal")}>
                Approve
              </Button>
              <Button size="sm" onClick={() => handleBulkAction("publish_unclaimed")}>
                Publier
              </Button>
              <Button size="sm" variant="secondary" onClick={() => handleBulkAction("send_claim_invite")}>
                Envoyer invites
              </Button>
              <Button size="sm" variant="secondary" onClick={() => handleBulkAction("mark_removed")}>
                Retirer
              </Button>
            </div>
          </div>

          <div className="mt-5 space-y-3">
            {profiles.slice(0, 10).map((profile) => (
              <div
                key={profile.id}
                className="rounded-[1.4rem] border border-[var(--border)] bg-[var(--background-soft)] p-4"
              >
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="font-medium text-[var(--foreground)]">
                      {profile.business_name || profile.public_name}
                    </p>
                    <p className="text-sm text-[var(--foreground-muted)]">
                      {profile.city || "Ville à compléter"} · {profile.source_name}
                    </p>
                  </div>
                  <p className="text-xs text-[var(--foreground-subtle)]">
                    Score doublon: {profile.confidence_score}
                  </p>
                </div>
                <p className="mt-2 text-sm text-[var(--foreground-muted)]">
                  {profile.review_notes || "Aucune note de revue."}
                </p>
              </div>
            ))}
          </div>
        </Card>

        <Card className="rounded-[1.8rem] p-6">
          <h2 className="text-2xl font-semibold text-[var(--foreground)]">Créer une fiche candidate</h2>
          <form onSubmit={handleManualProfileCreate} className="mt-5 space-y-4">
            <FieldWrapper label="Nom public">
              <Input name="public_name" required />
            </FieldWrapper>
            <FieldWrapper label="Nom d’activité">
              <Input name="business_name" />
            </FieldWrapper>
            <div className="grid gap-4 md:grid-cols-2">
              <FieldWrapper label="Ville">
                <Input name="city" required />
              </FieldWrapper>
              <FieldWrapper label="Région">
                <Input name="region" />
              </FieldWrapper>
            </div>
            <FieldWrapper label="Email public">
              <Input name="email_public" type="email" />
            </FieldWrapper>
            <FieldWrapper label="Téléphone public">
              <Input name="phone_public" />
            </FieldWrapper>
            <FieldWrapper label="Tags services">
              <Input name="service_tags" placeholder="relaxant, deep_tissue, drainage" />
            </FieldWrapper>
            <FieldWrapper label="Bio courte">
              <Textarea name="bio_short" />
            </FieldWrapper>
            <Button type="submit">Créer la fiche</Button>
          </form>
        </Card>
      </section>

      <section className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card className="rounded-[1.8rem] p-6">
          <h2 className="text-2xl font-semibold text-[var(--foreground)]">Jobs récents</h2>
          <div className="mt-5 space-y-3">
            {jobs.slice(0, 8).map((job) => (
              <div key={job.id} className="rounded-[1.4rem] border border-[var(--border)] bg-[var(--background-soft)] p-4">
                <p className="font-medium text-[var(--foreground)]">{job.source_name}</p>
                <p className="text-sm text-[var(--foreground-muted)]">
                  {job.status} · vus {job.total_seen} · créés {job.total_created} · mis à jour {job.total_updated}
                </p>
              </div>
            ))}
          </div>
        </Card>

        <Card className="rounded-[1.8rem] p-6">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-2xl font-semibold text-[var(--foreground)]">Campagnes & suppressions</h2>
            <Button size="sm" onClick={handleSendCampaign}>
              Envoyer une campagne test
            </Button>
          </div>
          <div className="mt-5 space-y-3">
            {removals.slice(0, 6).map((request) => (
              <div key={request.id} className="rounded-[1.4rem] border border-[var(--border)] bg-[var(--background-soft)] p-4">
                <p className="font-medium text-[var(--foreground)]">{request.requester_email}</p>
                <p className="text-sm text-[var(--foreground-muted)]">{request.reason}</p>
              </div>
            ))}
          </div>
        </Card>
      </section>
    </main>
  );
}
