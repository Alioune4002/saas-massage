"use client";

import { FormEvent, useEffect, useState } from "react";

import {
  createContactCampaign,
  getAdminCampaignOverview,
  getAdminContactCampaigns,
  sendContactCampaign,
  type AdminCampaignOverview,
  type ContactCampaignRecord,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FieldWrapper, Input, Select, Textarea } from "@/components/ui/field";
import { Notice } from "@/components/ui/notice";
import { Skeleton } from "@/components/ui/skeleton";

const TEMPLATE_BY_TYPE: Record<ContactCampaignRecord["campaign_type"], string> = {
  claim_invite: "claim_invite",
  incomplete_profile_nudge: "incomplete_profile_nudge",
  source_recontact: "claim_invite",
  seo: "claim_invite",
  boost: "incomplete_profile_nudge",
  acquisition: "claim_invite",
  email: "incomplete_profile_nudge",
};

export function CampaignsDashboard() {
  const [overview, setOverview] = useState<AdminCampaignOverview | null>(null);
  const [campaigns, setCampaigns] = useState<ContactCampaignRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function loadAll() {
    const [overviewData, campaignsData] = await Promise.all([
      getAdminCampaignOverview(),
      getAdminContactCampaigns(),
    ]);
    setOverview(overviewData);
    setCampaigns(campaignsData);
  }

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
          setError(err instanceof Error ? err.message : "Impossible de charger les campagnes.");
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
  }, []);

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const campaignType = String(formData.get("campaign_type") || "claim_invite") as ContactCampaignRecord["campaign_type"];
    const campaignScopeType = String(formData.get("campaign_scope_type") || "city") as ContactCampaignRecord["campaign_scope_type"];
    const city = String(formData.get("city") || "");
    const departmentCode = String(formData.get("department_code") || "");
    const region = String(formData.get("region") || "");
    const scopeValue =
      String(formData.get("campaign_scope_value") || "") ||
      city ||
      departmentCode ||
      region;

    try {
      await createContactCampaign({
        name: String(formData.get("name") || ""),
        campaign_type: campaignType,
        status: "ready",
        campaign_scope_type: campaignScopeType,
        campaign_scope_value: scopeValue,
        city,
        department_code: departmentCode,
        region,
        campaign_message: String(formData.get("campaign_message") || ""),
        budget_eur: String(formData.get("budget_eur") || "") || null,
        email_template_key: String(formData.get("email_template_key") || TEMPLATE_BY_TYPE[campaignType]),
        audience_filter_json: {
          city,
          department_code: departmentCode,
          region,
        },
      });
      setNotice("Campagne créée.");
      setError("");
      await loadAll();
      event.currentTarget.reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de créer la campagne.");
    }
  }

  async function handleSend(campaignId: string) {
    try {
      const result = await sendContactCampaign(campaignId);
      setNotice(`Campagne envoyée : ${result.sent} messages, ${result.failed} échecs.`);
      setError("");
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Envoi impossible.");
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
        {overview
          ? [
              ["Campagnes totales", overview.summary.total_campaigns],
              ["Campagnes actives", overview.summary.active_campaigns],
              ["Messages envoyés", overview.summary.sent_messages],
              ["Échecs", overview.summary.failed_messages],
            ].map(([label, value]) => (
              <Card key={String(label)} className="rounded-[1.6rem] p-5">
                <p className="text-sm text-[var(--foreground-muted)]">{label}</p>
                <p className="mt-2 text-3xl font-semibold text-[var(--foreground)]">{String(value)}</p>
              </Card>
            ))
          : null}
      </section>

      <section className="grid gap-6 2xl:grid-cols-[0.95fr_1.05fr]">
        <Card className="min-w-0 rounded-[1.8rem] p-5 md:p-6">
          <h2 className="text-2xl font-semibold text-[var(--foreground)]">Créer une campagne</h2>
          <p className="mt-3 text-sm leading-7 text-[var(--foreground-muted)]">
            Campagnes locales ou globales reliées à l’annuaire, aux villes et aux profils importés.
          </p>
          <form onSubmit={handleCreate} className="mt-5 space-y-4">
            <FieldWrapper label="Nom">
              <Input name="name" required placeholder="Quimper · revendication printemps" />
            </FieldWrapper>
            <div className="grid gap-4 sm:grid-cols-2">
              <FieldWrapper label="Type">
                <Select name="campaign_type" defaultValue="claim_invite">
                  <option value="claim_invite">claim_invite</option>
                  <option value="incomplete_profile_nudge">incomplete_profile_nudge</option>
                  <option value="source_recontact">source_recontact</option>
                  <option value="seo">seo</option>
                  <option value="boost">boost</option>
                  <option value="acquisition">acquisition</option>
                  <option value="email">email</option>
                </Select>
              </FieldWrapper>
              <FieldWrapper label="Scope">
                <Select name="campaign_scope_type" defaultValue="city">
                  <option value="city">city</option>
                  <option value="department">department</option>
                  <option value="region">region</option>
                  <option value="global">global</option>
                  <option value="source">source</option>
                </Select>
              </FieldWrapper>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <FieldWrapper label="Ville">
                <Input name="city" placeholder="Quimper" />
              </FieldWrapper>
              <FieldWrapper label="Département">
                <Input name="department_code" placeholder="29" />
              </FieldWrapper>
              <FieldWrapper label="Région">
                <Input name="region" placeholder="Bretagne" />
              </FieldWrapper>
              <FieldWrapper label="Budget €">
                <Input name="budget_eur" type="number" min="0" step="0.01" placeholder="250" />
              </FieldWrapper>
            </div>
            <FieldWrapper label="Clé template email">
              <Input name="email_template_key" placeholder="claim_invite" />
            </FieldWrapper>
            <FieldWrapper label="Message">
              <Textarea
                name="campaign_message"
                placeholder="Message interne ou base de message reliée à la campagne."
              />
            </FieldWrapper>
            <FieldWrapper label="Valeur de scope">
              <Input
                name="campaign_scope_value"
                placeholder="Slug ville, code département, région ou source"
              />
            </FieldWrapper>
            <Button type="submit">Créer la campagne</Button>
          </form>
        </Card>

        <Card className="min-w-0 rounded-[1.8rem] p-5 md:p-6">
          <h2 className="text-2xl font-semibold text-[var(--foreground)]">Campagnes existantes</h2>
          <div className="mt-5 space-y-3">
            {campaigns.map((campaign) => (
              <div
                key={campaign.id}
                className="rounded-[1.4rem] border border-[var(--border)] bg-[var(--background-soft)] p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="break-words font-medium text-[var(--foreground)]">{campaign.name}</p>
                    <p className="mt-1 break-words text-sm text-[var(--foreground-muted)]">
                      {campaign.campaign_type} · {campaign.campaign_scope_type} ·{" "}
                      {campaign.city || campaign.department_code || campaign.region || campaign.campaign_scope_value || "global"}
                    </p>
                  </div>
                  <p className="text-sm text-[var(--foreground-muted)]">{campaign.status}</p>
                </div>
                <div className="mt-4 grid gap-2 text-sm text-[var(--foreground-muted)] sm:grid-cols-3">
                  <p>Cibles : {campaign.total_targets}</p>
                  <p>Envoyés : {campaign.total_sent}</p>
                  <p>Échecs : {campaign.total_failed}</p>
                </div>
                <p className="mt-3 break-words text-sm leading-6 text-[var(--foreground-muted)]">
                  {campaign.campaign_message || "Aucun message interne saisi sur cette campagne."}
                </p>
                <div className="mt-4 flex flex-wrap gap-3">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => void handleSend(campaign.id)}
                    disabled={campaign.status === "completed" || campaign.status === "cancelled"}
                  >
                    Lancer / relancer
                  </Button>
                  <span className="inline-flex items-center rounded-full bg-[var(--background)] px-3 py-2 text-xs text-[var(--foreground-muted)]">
                    Budget {campaign.budget_eur ? `${campaign.budget_eur} €` : "non défini"}
                  </span>
                </div>
              </div>
            ))}
            {!campaigns.length ? (
              <div className="rounded-[1.4rem] border border-dashed border-[var(--border)] p-6 text-sm text-[var(--foreground-muted)]">
                Aucune campagne créée pour le moment.
              </div>
            ) : null}
          </div>
        </Card>
      </section>
    </div>
  );
}

