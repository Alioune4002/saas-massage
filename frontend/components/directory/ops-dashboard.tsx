"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { useAuthSession } from "@/hooks/use-auth-session";
import {
  bulkActionImportedProfiles,
  createAdminAcquisitionCity,
  createAdminImportedProfile,
  createAdminSource,
  createContactCampaign,
  getAdminAcquisitionCities,
  getAdminAcquisitionCity,
  getAdminAcquisitionCityCampaigns,
  getAdminAcquisitionCityFunnel,
  getAdminAcquisitionCityProfiles,
  getAdminAcquisitionCitySuggestions,
  getAdminAcquisitionSuggestions,
  getAdminContactCampaigns,
  getAdminImportedProfiles,
  getAdminImportJobs,
  getAdminSources,
  getRemovalRequests,
  runAdminSourceImport,
  sendContactCampaign,
  updateAdminAcquisitionCity,
  updateAdminAcquisitionSuggestion,
  type CityAcquisitionFunnel,
  type CityCoverageMetric,
  type ContactCampaignRecord,
  type DirectoryInterestLeadRecord,
  type ImportedProfileRecord,
  type LocationSuggestion,
  type RemovalRequestRecord,
  type SourceImportJobRecord,
  type SourceRegistryRecord,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FieldWrapper, Input, Select, Textarea } from "@/components/ui/field";
import { Notice } from "@/components/ui/notice";
import { Skeleton } from "@/components/ui/skeleton";
import { LocationAutosuggest } from "@/components/directory/location-autosuggest";

type CityFiltersState = {
  city: string;
  department_code: string;
  region: string;
  growth_status: string;
  priority_level: string;
  processed: string;
};

const INITIAL_CITY_FILTERS: CityFiltersState = {
  city: "",
  department_code: "",
  region: "",
  growth_status: "",
  priority_level: "",
  processed: "",
};

const INITIAL_PLAN_FORM = {
  objective_profiles_total: "10",
  objective_claimed_profiles: "4",
  objective_active_profiles: "3",
  priority_level: "medium",
  growth_status: "seed",
  notes_internal: "",
  is_active: true,
};

function formatPriorityLabel(priority: CityCoverageMetric["priority_level"]) {
  switch (priority) {
    case "critical":
      return "Critique";
    case "high":
      return "Haute";
    case "medium":
      return "Moyenne";
    default:
      return "Faible";
  }
}

function formatGrowthStatusLabel(status: CityCoverageMetric["growth_status"]) {
  switch (status) {
    case "empty":
      return "Vide";
    case "seed":
      return "Amorcée";
    case "building":
      return "En croissance";
    case "healthy":
      return "Saine";
    case "saturated":
      return "Saturée";
    default:
      return "Dépriorisée";
  }
}

function formatCampaignScope(campaign: ContactCampaignRecord) {
  if (campaign.campaign_scope_type === "city") {
    return campaign.city || campaign.campaign_scope_value || "Ville";
  }
  if (campaign.campaign_scope_type === "department") {
    return campaign.department_code || "Département";
  }
  if (campaign.campaign_scope_type === "region") {
    return campaign.region || "Région";
  }
  if (campaign.campaign_scope_type === "source") {
    return "Source";
  }
  return "Global";
}

export function OpsDashboard() {
  const router = useRouter();
  const { user, loading, error } = useAuthSession();
  const [sources, setSources] = useState<SourceRegistryRecord[]>([]);
  const [jobs, setJobs] = useState<SourceImportJobRecord[]>([]);
  const [profiles, setProfiles] = useState<ImportedProfileRecord[]>([]);
  const [removals, setRemovals] = useState<RemovalRequestRecord[]>([]);
  const [cityRows, setCityRows] = useState<CityCoverageMetric[]>([]);
  const [globalSuggestions, setGlobalSuggestions] = useState<DirectoryInterestLeadRecord[]>([]);
  const [campaigns, setCampaigns] = useState<ContactCampaignRecord[]>([]);
  const [selectedCitySlug, setSelectedCitySlug] = useState("");
  const [selectedCity, setSelectedCity] = useState<CityCoverageMetric | null>(null);
  const [cityFunnel, setCityFunnel] = useState<CityAcquisitionFunnel | null>(null);
  const [cityProfiles, setCityProfiles] = useState<ImportedProfileRecord[]>([]);
  const [citySuggestions, setCitySuggestions] = useState<DirectoryInterestLeadRecord[]>([]);
  const [cityCampaigns, setCityCampaigns] = useState<ContactCampaignRecord[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [loadingCityData, setLoadingCityData] = useState(false);
  const [pageError, setPageError] = useState("");
  const [pageSuccess, setPageSuccess] = useState("");
  const [importSourceId, setImportSourceId] = useState("");
  const [currentStatusFilter, setCurrentStatusFilter] = useState("pending_review");
  const [cityFilters, setCityFilters] = useState<CityFiltersState>(INITIAL_CITY_FILTERS);
  const [newCitySuggestion, setNewCitySuggestion] = useState<LocationSuggestion | null>(null);
  const [planForm, setPlanForm] = useState(INITIAL_PLAN_FORM);
  const [citySuggestionFilter, setCitySuggestionFilter] = useState("");

  useEffect(() => {
    if (!loading && user?.role !== "admin") {
      router.replace(user ? "/" : "/login");
    }
  }, [loading, router, user]);

  const loadGlobalData = useCallback(async () => {
    const [
      sourcesData,
      jobsData,
      profilesData,
      removalsData,
      cityRowsData,
      suggestionsData,
      campaignsData,
    ] = await Promise.all([
      getAdminSources(),
      getAdminImportJobs(),
      getAdminImportedProfiles({ import_status: currentStatusFilter }),
      getRemovalRequests(),
      getAdminAcquisitionCities({
        city: cityFilters.city || undefined,
        department_code: cityFilters.department_code || undefined,
        region: cityFilters.region || undefined,
        growth_status: cityFilters.growth_status as CityCoverageMetric["growth_status"] | undefined,
        priority_level: cityFilters.priority_level as CityCoverageMetric["priority_level"] | undefined,
        processed:
          cityFilters.processed === ""
            ? undefined
            : cityFilters.processed === "true",
      }),
      getAdminAcquisitionSuggestions({ processed: false }),
      getAdminContactCampaigns(),
    ]);

    setSources(sourcesData);
    setJobs(jobsData);
    setProfiles(profilesData);
    setRemovals(removalsData);
    setCityRows(cityRowsData);
    setGlobalSuggestions(suggestionsData);
    setCampaigns(campaignsData);
    setImportSourceId((current) => current || sourcesData[0]?.id || "");
    setSelectedCitySlug((current) => {
      if (current && cityRowsData.some((row) => row.city_slug === current)) {
        return current;
      }
      return cityRowsData[0]?.city_slug || "";
    });
  }, [cityFilters, currentStatusFilter]);

  const loadCityData = useCallback(async (citySlug: string) => {
    if (!citySlug) {
      setSelectedCity(null);
      setCityFunnel(null);
      setCityProfiles([]);
      setCitySuggestions([]);
      setCityCampaigns([]);
      return;
    }

    setLoadingCityData(true);
    try {
      const [city, funnel, profilesData, suggestionsData, campaignsData] =
        await Promise.all([
          getAdminAcquisitionCity(citySlug),
          getAdminAcquisitionCityFunnel(citySlug),
          getAdminAcquisitionCityProfiles(citySlug),
          getAdminAcquisitionCitySuggestions(
            citySlug,
            citySuggestionFilter
              ? {
                  ops_status:
                    citySuggestionFilter as DirectoryInterestLeadRecord["ops_status"],
                }
              : undefined
          ),
          getAdminAcquisitionCityCampaigns(citySlug),
        ]);
      setSelectedCity(city);
      setCityFunnel(funnel);
      setCityProfiles(profilesData);
      setCitySuggestions(suggestionsData);
      setCityCampaigns(campaignsData);
    } finally {
      setLoadingCityData(false);
    }
  }, [citySuggestionFilter]);

  useEffect(() => {
    if (!user || user.role !== "admin") {
      return;
    }

    let active = true;

    async function load() {
      try {
        setLoadingData(true);
        await loadGlobalData();
        if (!active) {
          return;
        }
        setPageError("");
      } catch (err) {
        if (!active) {
          return;
        }
        setPageError(err instanceof Error ? err.message : "Impossible de charger le cockpit ops.");
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
  }, [loadGlobalData, user]);

  useEffect(() => {
    if (!selectedCitySlug || !user || user.role !== "admin") {
      return;
    }

    let active = true;
    async function loadCity() {
      try {
        await loadCityData(selectedCitySlug);
      } catch (err) {
        if (!active) {
          return;
        }
        setPageError(err instanceof Error ? err.message : "Impossible de charger le détail ville.");
      }
    }
    void loadCity();
    return () => {
      active = false;
    };
  }, [loadCityData, selectedCitySlug, user]);

  useEffect(() => {
    if (!selectedCity) {
      setPlanForm(INITIAL_PLAN_FORM);
      return;
    }
    setPlanForm({
      objective_profiles_total: String(selectedCity.objective_profiles_total),
      objective_claimed_profiles: String(selectedCity.objective_claimed_profiles),
      objective_active_profiles: String(selectedCity.objective_active_profiles),
      priority_level: selectedCity.priority_level,
      growth_status: selectedCity.growth_status,
      notes_internal: selectedCity.notes_internal || "",
      is_active: selectedCity.is_active,
    });
  }, [selectedCity]);

  const reviewCount = useMemo(
    () =>
      profiles.filter(
        (profile) =>
          profile.import_status === "pending_review" ||
          Number(profile.confidence_score) >= 0.8
      ).length,
    [profiles]
  );

  const cityStats = useMemo(() => {
    const activeCities = cityRows.filter((row) => row.is_active).length;
    const criticalCities = cityRows.filter((row) => row.priority_level === "critical").length;
    const emptyCities = cityRows.filter((row) => row.total_profiles === 0).length;
    return { activeCities, criticalCities, emptyCities };
  }, [cityRows]);

  async function refreshAfterMutation(options?: { refreshGlobal?: boolean; refreshCity?: boolean }) {
    if (options?.refreshGlobal) {
      await loadGlobalData();
    }
    if (options?.refreshCity && selectedCitySlug) {
      await loadCityData(selectedCitySlug);
    }
  }

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
        `Import traité : ${result.summary.total_created} créés, ${result.summary.total_updated} mis à jour, ${result.summary.total_flagged} signalés.`
      );
      setPageError("");
      await refreshAfterMutation({ refreshGlobal: true, refreshCity: true });
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
      await refreshAfterMutation({ refreshGlobal: true, refreshCity: true });
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
      await refreshAfterMutation({ refreshGlobal: true, refreshCity: true });
    } catch (err) {
      setPageError(err instanceof Error ? err.message : "Action bulk impossible.");
    }
  }

  async function handleCreateCityPlan() {
    if (!newCitySuggestion || newCitySuggestion.kind !== "city") {
      setPageError("Sélectionnez une ville du référentiel pour créer un plan de croissance.");
      return;
    }
    try {
      const row = await createAdminAcquisitionCity({
        location_slug: newCitySuggestion.slug,
      });
      setPageSuccess(`Ville pilotée ajoutée : ${row.city_label}.`);
      setPageError("");
      setNewCitySuggestion(null);
      await refreshAfterMutation({ refreshGlobal: true });
      setSelectedCitySlug(row.city_slug);
    } catch (err) {
      setPageError(err instanceof Error ? err.message : "Impossible d’ajouter la ville au cockpit.");
    }
  }

  async function handleUpdateCityPlan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedCitySlug) {
      setPageError("Aucune ville sélectionnée.");
      return;
    }
    try {
      const updated = await updateAdminAcquisitionCity(selectedCitySlug, {
        objective_profiles_total: Number(planForm.objective_profiles_total),
        objective_claimed_profiles: Number(planForm.objective_claimed_profiles),
        objective_active_profiles: Number(planForm.objective_active_profiles),
        priority_level: planForm.priority_level as CityCoverageMetric["priority_level"],
        growth_status: planForm.growth_status as CityCoverageMetric["growth_status"],
        notes_internal: planForm.notes_internal,
        is_active: planForm.is_active,
      });
      setSelectedCity(updated);
      setPageSuccess(`Objectifs mis à jour pour ${updated.city_label}.`);
      setPageError("");
      await refreshAfterMutation({ refreshGlobal: true, refreshCity: true });
    } catch (err) {
      setPageError(err instanceof Error ? err.message : "Impossible de mettre à jour la ville.");
    }
  }

  async function handleCreateLocalCampaign(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedCity) {
      setPageError("Sélectionnez une ville avant de créer une campagne locale.");
      return;
    }
    const formData = new FormData(event.currentTarget);
    try {
      await createContactCampaign({
        name: String(formData.get("name") || `Invitation ${selectedCity.city_label}`),
        campaign_type: String(formData.get("campaign_type") || "claim_invite") as ContactCampaignRecord["campaign_type"],
        status: "ready",
        campaign_scope_type: "city",
        campaign_scope_value: selectedCity.city_slug,
        city: selectedCity.city_label,
        department_code: selectedCity.department_code,
        region: selectedCity.region,
        email_template_key: String(formData.get("email_template_key") || "claim_invite"),
        audience_filter_json: {
          city: selectedCity.city_label,
          city_slug: selectedCity.city_slug,
          department_code: selectedCity.department_code,
          region: selectedCity.region,
        },
      });
      setPageSuccess(`Campagne locale créée pour ${selectedCity.city_label}.`);
      setPageError("");
      await refreshAfterMutation({ refreshGlobal: true, refreshCity: true });
      event.currentTarget.reset();
    } catch (err) {
      setPageError(err instanceof Error ? err.message : "Impossible de créer la campagne locale.");
    }
  }

  async function handleSendCampaign(campaignId?: string) {
    try {
      const targetCampaignId = campaignId;
      if (!targetCampaignId) {
        const created = await createContactCampaign({
          name: selectedCity
            ? `Invitation de revendication ${selectedCity.city_label}`
            : "Invitation de revendication manuelle",
          campaign_type: "claim_invite",
          status: "ready",
          email_template_key: "claim_invite",
          campaign_scope_type: selectedCity ? "city" : "global",
          campaign_scope_value: selectedCity?.city_slug || "",
          city: selectedCity?.city_label || "",
          department_code: selectedCity?.department_code || "",
          region: selectedCity?.region || "",
          audience_filter_json: selectedCity
            ? {
                city: selectedCity.city_label,
                city_slug: selectedCity.city_slug,
                department_code: selectedCity.department_code,
                region: selectedCity.region,
              }
            : {},
        });
        const result = await sendContactCampaign(created.id);
        setPageSuccess(`Campagne envoyée : ${result.sent} emails, ${result.failed} échecs.`);
      } else {
        const result = await sendContactCampaign(targetCampaignId);
        setPageSuccess(`Campagne envoyée : ${result.sent} emails, ${result.failed} échecs.`);
      }
      setPageError("");
      await refreshAfterMutation({ refreshGlobal: true, refreshCity: true });
    } catch (err) {
      setPageError(err instanceof Error ? err.message : "Campagne impossible.");
    }
  }

  async function handleSuggestionStatus(
    suggestion: DirectoryInterestLeadRecord,
    opsStatus: DirectoryInterestLeadRecord["ops_status"]
  ) {
    try {
      await updateAdminAcquisitionSuggestion(suggestion.id, {
        ops_status: opsStatus,
        processed: opsStatus === "converted" || opsStatus === "ignored",
      });
      setPageSuccess("Suggestion mise à jour.");
      setPageError("");
      await refreshAfterMutation({ refreshGlobal: true, refreshCity: true });
    } catch (err) {
      setPageError(err instanceof Error ? err.message : "Mise à jour de suggestion impossible.");
    }
  }

  async function handleConvertSuggestion(suggestion: DirectoryInterestLeadRecord) {
    const practitionerName = suggestion.practitioner_name.trim();
    if (!practitionerName) {
      setPageError("Cette suggestion ne contient pas de nom praticien exploitable.");
      return;
    }
    try {
      const created = await createAdminImportedProfile({
        public_name: practitionerName,
        business_name: practitionerName,
        city: suggestion.city,
        region: selectedCity?.region || "",
        bio_short: suggestion.message || "",
        import_status: "draft_imported",
        claimable: true,
        publishable_minimum_ok: false,
      });
      await updateAdminAcquisitionSuggestion(suggestion.id, {
        ops_status: "converted",
        processed: true,
        converted_to_imported_profile: created.id,
        ops_notes: suggestion.ops_notes || "Converti en fiche candidate depuis le cockpit local.",
      });
      setPageSuccess("Suggestion convertie en fiche candidate.");
      setPageError("");
      await refreshAfterMutation({ refreshGlobal: true, refreshCity: true });
    } catch (err) {
      setPageError(err instanceof Error ? err.message : "Conversion impossible.");
    }
  }

  if (loading || loadingData) {
    return (
      <main className="mx-auto max-w-7xl px-4 py-8 md:px-6">
        <Skeleton className="h-20 rounded-[2rem]" />
        <Skeleton className="mt-6 h-96 rounded-[2rem]" />
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
          Ops local marketplace
        </p>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight text-[var(--foreground)]">
          Cockpit villes & acquisition
        </h1>
        <p className="mt-4 text-sm leading-7 text-[var(--foreground-muted)]">
          Pilote l’annuaire ville par ville : couverture locale, suggestions, imports, campagnes,
          revendications et points de blocage. Les actions restent gouvernées par review humaine et
          sources whitelistées.
        </p>
      </Card>

      {error ? <Notice tone="error" className="mt-6">{error}</Notice> : null}
      {pageError ? <Notice tone="error" className="mt-6">{pageError}</Notice> : null}
      {pageSuccess ? <Notice tone="success" className="mt-6">{pageSuccess}</Notice> : null}

      <section className="mt-6 grid gap-4 xl:grid-cols-5">
        {[
          ["Sources", String(sources.length)],
          ["Jobs d’import", String(jobs.length)],
          ["File de review", String(reviewCount)],
          ["Villes pilotées", String(cityStats.activeCities)],
          ["Villes critiques", String(cityStats.criticalCities)],
        ].map(([label, value]) => (
          <Card key={label} className="rounded-[1.6rem] p-5">
            <p className="text-sm text-[var(--foreground-muted)]">{label}</p>
            <p className="mt-2 text-3xl font-semibold text-[var(--foreground)]">{value}</p>
          </Card>
        ))}
      </section>

      <section className="mt-6 grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Card className="rounded-[1.8rem] p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-[var(--foreground)]">
                Villes / Croissance
              </h2>
              <p className="mt-2 text-sm text-[var(--foreground-muted)]">
                Objectifs locaux, couverture réelle, priorités et conversion du pipeline.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <FieldWrapper label="Ville">
                <Input
                  value={cityFilters.city}
                  onChange={(event) =>
                    setCityFilters((current) => ({ ...current, city: event.target.value }))
                  }
                  placeholder="Quimper"
                />
              </FieldWrapper>
              <FieldWrapper label="Département">
                <Input
                  value={cityFilters.department_code}
                  onChange={(event) =>
                    setCityFilters((current) => ({
                      ...current,
                      department_code: event.target.value.toUpperCase(),
                    }))
                  }
                  placeholder="29"
                />
              </FieldWrapper>
              <FieldWrapper label="Région">
                <Input
                  value={cityFilters.region}
                  onChange={(event) =>
                    setCityFilters((current) => ({ ...current, region: event.target.value }))
                  }
                  placeholder="Bretagne"
                />
              </FieldWrapper>
              <FieldWrapper label="Statut">
                <Select
                  value={cityFilters.growth_status}
                  onChange={(event) =>
                    setCityFilters((current) => ({
                      ...current,
                      growth_status: event.target.value,
                    }))
                  }
                >
                  <option value="">Tous</option>
                  <option value="empty">empty</option>
                  <option value="seed">seed</option>
                  <option value="building">building</option>
                  <option value="healthy">healthy</option>
                  <option value="saturated">saturated</option>
                  <option value="deprioritized">deprioritized</option>
                </Select>
              </FieldWrapper>
              <FieldWrapper label="Priorité">
                <Select
                  value={cityFilters.priority_level}
                  onChange={(event) =>
                    setCityFilters((current) => ({
                      ...current,
                      priority_level: event.target.value,
                    }))
                  }
                >
                  <option value="">Toutes</option>
                  <option value="low">low</option>
                  <option value="medium">medium</option>
                  <option value="high">high</option>
                  <option value="critical">critical</option>
                </Select>
              </FieldWrapper>
              <FieldWrapper label="Suggestions">
                <Select
                  value={cityFilters.processed}
                  onChange={(event) =>
                    setCityFilters((current) => ({
                      ...current,
                      processed: event.target.value,
                    }))
                  }
                >
                  <option value="">Toutes</option>
                  <option value="false">Avec backlog</option>
                  <option value="true">Traitées</option>
                </Select>
              </FieldWrapper>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Card className="rounded-[1.4rem] border border-[var(--border)] p-4">
              <p className="text-xs uppercase tracking-[0.24em] text-[var(--foreground-subtle)]">
                Villes actives
              </p>
              <p className="mt-2 text-2xl font-semibold text-[var(--foreground)]">
                {cityStats.activeCities}
              </p>
            </Card>
            <Card className="rounded-[1.4rem] border border-[var(--border)] p-4">
              <p className="text-xs uppercase tracking-[0.24em] text-[var(--foreground-subtle)]">
                Villes vides
              </p>
              <p className="mt-2 text-2xl font-semibold text-[var(--foreground)]">
                {cityStats.emptyCities}
              </p>
            </Card>
            <Card className="rounded-[1.4rem] border border-[var(--border)] p-4">
              <p className="text-xs uppercase tracking-[0.24em] text-[var(--foreground-subtle)]">
                Suggestions globales
              </p>
              <p className="mt-2 text-2xl font-semibold text-[var(--foreground)]">
                {globalSuggestions.length}
              </p>
            </Card>
            <Card className="rounded-[1.4rem] border border-[var(--border)] p-4">
              <p className="text-xs uppercase tracking-[0.24em] text-[var(--foreground-subtle)]">
                Campagnes
              </p>
              <p className="mt-2 text-2xl font-semibold text-[var(--foreground)]">
                {campaigns.length}
              </p>
            </Card>
          </div>

          <div className="mt-5 space-y-3">
            {cityRows.length ? (
              cityRows.map((row) => {
                const selected = row.city_slug === selectedCitySlug;
                return (
                  <button
                    key={row.city_slug}
                    type="button"
                    onClick={() => setSelectedCitySlug(row.city_slug)}
                    className={`w-full rounded-[1.4rem] border p-4 text-left transition ${
                      selected
                        ? "border-[var(--primary)] bg-[var(--primary)]/6"
                        : "border-[var(--border)] bg-[var(--background-soft)] hover:border-[var(--border-strong)]"
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-[var(--foreground)]">
                          {row.city_label}
                          {row.department_code ? ` (${row.department_code})` : ""}
                        </p>
                        <p className="mt-1 text-sm text-[var(--foreground-muted)]">
                          {row.total_profiles} / {row.objective_profiles_total} profils ·{" "}
                          {row.claimed_profiles} revendiqués · {row.active_profiles} actifs
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs uppercase tracking-[0.24em] text-[var(--foreground-subtle)]">
                          {formatPriorityLabel(row.priority_level)}
                        </p>
                        <p className="mt-1 text-sm font-medium text-[var(--foreground)]">
                          {formatGrowthStatusLabel(row.growth_status)}
                        </p>
                      </div>
                    </div>
                    <div className="mt-4 h-2 overflow-hidden rounded-full bg-[var(--border)]">
                      <div
                        className="h-full rounded-full bg-[var(--primary)]"
                        style={{ width: `${Math.min(100, row.coverage_percent)}%` }}
                      />
                    </div>
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm text-[var(--foreground-muted)]">
                      <span>{row.coverage_percent}% de l’objectif</span>
                      <span>
                        {row.suggestions_unprocessed_count} suggestions à traiter · {row.claim_rate}% claim rate
                      </span>
                    </div>
                    <p className="mt-3 text-sm text-[var(--foreground-muted)]">
                      {row.recommended_action}
                    </p>
                  </button>
                );
              })
            ) : (
              <div className="rounded-[1.4rem] border border-dashed border-[var(--border)] p-6 text-sm text-[var(--foreground-muted)]">
                Aucun plan ou signal local ne correspond aux filtres actuels.
              </div>
            )}
          </div>
        </Card>

        <Card className="rounded-[1.8rem] p-6">
          <h2 className="text-2xl font-semibold text-[var(--foreground)]">
            Ajouter une ville au cockpit
          </h2>
          <p className="mt-3 text-sm text-[var(--foreground-muted)]">
            Sélectionne une ville du référentiel France pour commencer son pilotage avec les objectifs
            par défaut.
          </p>
          <div className="mt-5">
            <LocationAutosuggest
              label="Ville à piloter"
              hint="Uniquement les villes créent un plan local"
              onSelect={(suggestion) => setNewCitySuggestion(suggestion)}
            />
          </div>
          <div className="mt-4 rounded-[1.3rem] border border-[var(--border)] bg-[var(--background-soft)] p-4">
            <p className="text-sm font-medium text-[var(--foreground)]">
              {newCitySuggestion?.label || "Aucune ville sélectionnée"}
            </p>
            <p className="mt-1 text-sm text-[var(--foreground-muted)]">
              {newCitySuggestion
                ? [newCitySuggestion.postal_code, newCitySuggestion.department_name, newCitySuggestion.region]
                    .filter(Boolean)
                    .join(" · ")
                : "Objectifs par défaut : 10 profils, 4 revendiqués, 3 actifs."}
            </p>
          </div>
          <Button className="mt-4" onClick={handleCreateCityPlan}>
            Ajouter cette ville
          </Button>
        </Card>
      </section>

      <section className="mt-6 grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
        <Card className="rounded-[1.8rem] p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-2xl font-semibold text-[var(--foreground)]">
                {selectedCity ? selectedCity.city_label : "Ville à sélectionner"}
              </h2>
              <p className="mt-2 text-sm text-[var(--foreground-muted)]">
                {selectedCity
                  ? `${selectedCity.region || "Région non précisée"} · priorité ${formatPriorityLabel(
                      selectedCity.priority_level
                    ).toLowerCase()}`
                  : "Choisis une ville pour piloter son funnel local."}
              </p>
            </div>
            {selectedCity ? (
              <Button size="sm" variant="secondary" onClick={() => handleSendCampaign()}>
                Lancer une invitation locale
              </Button>
            ) : null}
          </div>

          {loadingCityData ? (
            <div className="mt-5 space-y-3">
              <Skeleton className="h-32 rounded-[1.4rem]" />
              <Skeleton className="h-40 rounded-[1.4rem]" />
            </div>
          ) : selectedCity ? (
            <>
              <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {[
                  ["Couverture", `${selectedCity.coverage_percent}%`],
                  ["Claims validés", String(selectedCity.claims_validated)],
                  ["Suggestions", String(selectedCity.suggestions_count)],
                  ["Campagnes", String(selectedCity.campaigns_count)],
                ].map(([label, value]) => (
                  <Card key={label} className="rounded-[1.4rem] border border-[var(--border)] p-4">
                    <p className="text-xs uppercase tracking-[0.24em] text-[var(--foreground-subtle)]">
                      {label}
                    </p>
                    <p className="mt-2 text-2xl font-semibold text-[var(--foreground)]">{value}</p>
                  </Card>
                ))}
              </div>

              <form onSubmit={handleUpdateCityPlan} className="mt-5 space-y-4 rounded-[1.4rem] border border-[var(--border)] p-5">
                <div className="grid gap-4 md:grid-cols-3">
                  <FieldWrapper label="Objectif profils">
                    <Input
                      type="number"
                      min={0}
                      value={planForm.objective_profiles_total}
                      onChange={(event) =>
                        setPlanForm((current) => ({
                          ...current,
                          objective_profiles_total: event.target.value,
                        }))
                      }
                    />
                  </FieldWrapper>
                  <FieldWrapper label="Objectif revendiqués">
                    <Input
                      type="number"
                      min={0}
                      value={planForm.objective_claimed_profiles}
                      onChange={(event) =>
                        setPlanForm((current) => ({
                          ...current,
                          objective_claimed_profiles: event.target.value,
                        }))
                      }
                    />
                  </FieldWrapper>
                  <FieldWrapper label="Objectif actifs">
                    <Input
                      type="number"
                      min={0}
                      value={planForm.objective_active_profiles}
                      onChange={(event) =>
                        setPlanForm((current) => ({
                          ...current,
                          objective_active_profiles: event.target.value,
                        }))
                      }
                    />
                  </FieldWrapper>
                </div>
                <div className="grid gap-4 md:grid-cols-3">
                  <FieldWrapper label="Priorité">
                    <Select
                      value={planForm.priority_level}
                      onChange={(event) =>
                        setPlanForm((current) => ({
                          ...current,
                          priority_level: event.target.value,
                        }))
                      }
                    >
                      <option value="low">low</option>
                      <option value="medium">medium</option>
                      <option value="high">high</option>
                      <option value="critical">critical</option>
                    </Select>
                  </FieldWrapper>
                  <FieldWrapper label="Statut">
                    <Select
                      value={planForm.growth_status}
                      onChange={(event) =>
                        setPlanForm((current) => ({
                          ...current,
                          growth_status: event.target.value,
                        }))
                      }
                    >
                      <option value="empty">empty</option>
                      <option value="seed">seed</option>
                      <option value="building">building</option>
                      <option value="healthy">healthy</option>
                      <option value="saturated">saturated</option>
                      <option value="deprioritized">deprioritized</option>
                    </Select>
                  </FieldWrapper>
                  <label className="flex items-end gap-3 rounded-[1.15rem] border border-[var(--border)] bg-[var(--background-soft)] px-4 py-3 text-sm text-[var(--foreground)]">
                    <input
                      type="checkbox"
                      checked={planForm.is_active}
                      onChange={(event) =>
                        setPlanForm((current) => ({ ...current, is_active: event.target.checked }))
                      }
                    />
                    Cockpit actif
                  </label>
                </div>
                <FieldWrapper label="Note ops">
                  <Textarea
                    value={planForm.notes_internal}
                    onChange={(event) =>
                      setPlanForm((current) => ({ ...current, notes_internal: event.target.value }))
                    }
                  />
                </FieldWrapper>
                <Button type="submit">Mettre à jour la ville</Button>
              </form>

              <div className="mt-5 grid gap-4 xl:grid-cols-2">
                <Card className="rounded-[1.4rem] border border-[var(--border)] p-5">
                  <h3 className="text-lg font-semibold text-[var(--foreground)]">Funnel acquisition</h3>
                  <div className="mt-4 space-y-3 text-sm text-[var(--foreground-muted)]">
                    {cityFunnel
                      ? [
                          ["Suggestions reçues", cityFunnel.suggestions_received],
                          ["Suggestions non traitées", cityFunnel.suggestions_unprocessed],
                          ["Profils importés", cityFunnel.profiles_imported],
                          ["En review", cityFunnel.profiles_in_review],
                          ["Publiés non revendiqués", cityFunnel.profiles_published_unclaimed],
                          ["Invitations envoyées", cityFunnel.invitations_sent],
                          ["Claims ouverts", cityFunnel.claims_opened],
                          ["Claims validés", cityFunnel.claims_validated],
                          ["Profils revendiqués", cityFunnel.profiles_claimed],
                          ["Profils publics actifs", cityFunnel.profiles_public_active],
                        ].map(([label, value]) => (
                          <div key={String(label)} className="flex items-center justify-between gap-3">
                            <span>{label}</span>
                            <span className="font-medium text-[var(--foreground)]">{String(value)}</span>
                          </div>
                        ))
                      : null}
                  </div>
                </Card>

                <Card className="rounded-[1.4rem] border border-[var(--border)] p-5">
                  <h3 className="text-lg font-semibold text-[var(--foreground)]">Recommandations</h3>
                  <div className="mt-4 space-y-3">
                    {selectedCity.recommendations.map((recommendation) => (
                      <div
                        key={recommendation}
                        className="rounded-[1rem] bg-[var(--background-soft)] px-4 py-3 text-sm text-[var(--foreground-muted)]"
                      >
                        {recommendation}
                      </div>
                    ))}
                  </div>
                </Card>
              </div>

              <div className="mt-5 grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
                <Card className="rounded-[1.4rem] border border-[var(--border)] p-5">
                  <h3 className="text-lg font-semibold text-[var(--foreground)]">Campagne locale</h3>
                  <form onSubmit={handleCreateLocalCampaign} className="mt-4 space-y-4">
                    <FieldWrapper label="Nom de campagne">
                      <Input name="name" placeholder={`Invitation ${selectedCity.city_label}`} />
                    </FieldWrapper>
                    <div className="grid gap-4 md:grid-cols-2">
                      <FieldWrapper label="Type">
                        <Select name="campaign_type" defaultValue="claim_invite">
                          <option value="claim_invite">claim_invite</option>
                          <option value="incomplete_profile_nudge">incomplete_profile_nudge</option>
                        </Select>
                      </FieldWrapper>
                      <FieldWrapper label="Template email">
                        <Select name="email_template_key" defaultValue="claim_invite">
                          <option value="claim_invite">claim_invite</option>
                          <option value="incomplete_profile_nudge">incomplete_profile_nudge</option>
                        </Select>
                      </FieldWrapper>
                    </div>
                    <Button type="submit">Créer la campagne locale</Button>
                  </form>
                </Card>

                <Card className="rounded-[1.4rem] border border-[var(--border)] p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h3 className="text-lg font-semibold text-[var(--foreground)]">
                      Suggestions locales
                    </h3>
                    <div className="min-w-[180px]">
                      <Select
                        value={citySuggestionFilter}
                        onChange={(event) => setCitySuggestionFilter(event.target.value)}
                      >
                        <option value="">Tous statuts</option>
                        <option value="new">new</option>
                        <option value="in_review">in_review</option>
                        <option value="contacted">contacted</option>
                        <option value="converted">converted</option>
                        <option value="ignored">ignored</option>
                      </Select>
                    </div>
                  </div>
                  <div className="mt-4 space-y-3">
                    {citySuggestions.length ? (
                      citySuggestions.slice(0, 8).map((suggestion) => (
                        <div
                          key={suggestion.id}
                          className="rounded-[1rem] border border-[var(--border)] bg-[var(--background-soft)] p-4"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <p className="font-medium text-[var(--foreground)]">
                                {suggestion.practitioner_name || suggestion.kind_label}
                              </p>
                              <p className="mt-1 text-sm text-[var(--foreground-muted)]">
                                {suggestion.city || "Ville non précisée"} · {suggestion.full_name}
                              </p>
                            </div>
                            <p className="text-xs uppercase tracking-[0.24em] text-[var(--foreground-subtle)]">
                              {suggestion.ops_status}
                            </p>
                          </div>
                          <p className="mt-2 text-sm text-[var(--foreground-muted)]">
                            {suggestion.message || "Aucun message complémentaire."}
                          </p>
                          <div className="mt-3 flex flex-wrap gap-2">
                            <Button size="sm" variant="secondary" onClick={() => handleSuggestionStatus(suggestion, "in_review")}>
                              En revue
                            </Button>
                            <Button size="sm" variant="secondary" onClick={() => handleSuggestionStatus(suggestion, "ignored")}>
                              Ignorer
                            </Button>
                            <Button size="sm" onClick={() => handleConvertSuggestion(suggestion)}>
                              Convertir en fiche
                            </Button>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-[var(--foreground-muted)]">
                        Aucune suggestion locale avec les filtres actuels.
                      </p>
                    )}
                  </div>
                </Card>
              </div>

              <div className="mt-5 grid gap-4 xl:grid-cols-2">
                <Card className="rounded-[1.4rem] border border-[var(--border)] p-5">
                  <h3 className="text-lg font-semibold text-[var(--foreground)]">Profils liés à la ville</h3>
                  <div className="mt-4 space-y-3">
                    {cityProfiles.length ? (
                      cityProfiles.slice(0, 8).map((profile) => (
                        <div
                          key={profile.id}
                          className="rounded-[1rem] border border-[var(--border)] bg-[var(--background-soft)] p-4"
                        >
                          <p className="font-medium text-[var(--foreground)]">
                            {profile.business_name || profile.public_name}
                          </p>
                          <p className="mt-1 text-sm text-[var(--foreground-muted)]">
                            {profile.import_status} · {profile.city || "Ville à compléter"}
                          </p>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-[var(--foreground-muted)]">
                        Aucun profil importé rattaché à cette ville.
                      </p>
                    )}
                  </div>
                </Card>

                <Card className="rounded-[1.4rem] border border-[var(--border)] p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h3 className="text-lg font-semibold text-[var(--foreground)]">Campagnes locales</h3>
                    {cityCampaigns.length ? (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => handleSendCampaign(cityCampaigns[0].id)}
                      >
                        Envoyer la dernière
                      </Button>
                    ) : null}
                  </div>
                  <div className="mt-4 space-y-3">
                    {cityCampaigns.length ? (
                      cityCampaigns.slice(0, 8).map((campaign) => (
                        <div
                          key={campaign.id}
                          className="rounded-[1rem] border border-[var(--border)] bg-[var(--background-soft)] p-4"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <p className="font-medium text-[var(--foreground)]">{campaign.name}</p>
                              <p className="mt-1 text-sm text-[var(--foreground-muted)]">
                                {campaign.status} · {formatCampaignScope(campaign)}
                              </p>
                            </div>
                            <Button size="sm" variant="secondary" onClick={() => handleSendCampaign(campaign.id)}>
                              Envoyer
                            </Button>
                          </div>
                          <p className="mt-2 text-sm text-[var(--foreground-muted)]">
                            {campaign.total_sent} envoyés · {campaign.total_failed} échecs · cible {campaign.total_targets}
                          </p>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-[var(--foreground-muted)]">
                        Aucune campagne locale encore créée pour cette ville.
                      </p>
                    )}
                  </div>
                </Card>
              </div>
            </>
          ) : (
            <div className="mt-5 rounded-[1.4rem] border border-dashed border-[var(--border)] p-6 text-sm text-[var(--foreground-muted)]">
              Sélectionne une ville dans la colonne de gauche pour voir son cockpit local.
            </div>
          )}
        </Card>

        <Card className="rounded-[1.8rem] p-6">
          <h2 className="text-2xl font-semibold text-[var(--foreground)]">Blocages globaux</h2>
          <div className="mt-5 space-y-3">
            {globalSuggestions.slice(0, 8).map((item) => (
              <div
                key={item.id}
                className="rounded-[1.4rem] border border-[var(--border)] bg-[var(--background-soft)] p-4"
              >
                <p className="font-medium text-[var(--foreground)]">{item.kind_label}</p>
                <p className="mt-1 text-sm text-[var(--foreground-muted)]">
                  {item.city || "Ville non précisée"} · {item.full_name}
                </p>
                <p className="mt-2 text-sm text-[var(--foreground-muted)]">
                  {item.practitioner_name ? `Praticien suggéré : ${item.practitioner_name}` : "Pas encore de praticien nommé."}
                </p>
              </div>
            ))}
            {!globalSuggestions.length ? (
              <p className="text-sm text-[var(--foreground-muted)]">
                Aucun backlog global côté suggestions.
              </p>
            ) : null}
          </div>
        </Card>
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
                    Score doublon : {profile.confidence_score}
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
            <Button size="sm" onClick={() => handleSendCampaign()}>
              Envoyer une campagne test
            </Button>
          </div>
          <div className="mt-5 space-y-3">
            {campaigns.slice(0, 4).map((campaign) => (
              <div key={campaign.id} className="rounded-[1.4rem] border border-[var(--border)] bg-[var(--background-soft)] p-4">
                <p className="font-medium text-[var(--foreground)]">{campaign.name}</p>
                <p className="text-sm text-[var(--foreground-muted)]">
                  {campaign.status} · {formatCampaignScope(campaign)} · {campaign.total_sent} envoyés · {campaign.total_failed} échecs
                </p>
              </div>
            ))}
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
