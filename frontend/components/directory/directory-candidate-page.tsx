"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { MapPin } from "lucide-react";

import { SiteHeader } from "@/components/marketing/site-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FieldWrapper, Input, Textarea } from "@/components/ui/field";
import { Notice } from "@/components/ui/notice";
import { Skeleton } from "@/components/ui/skeleton";
import {
  getDirectoryCandidate,
  submitDirectoryClaimRequest,
  submitDirectoryRemovalRequest,
  type DirectoryCandidate,
} from "@/lib/api";
import { MASSAGE_CATEGORY_LABELS } from "@/lib/directory";

type DirectoryCandidatePageProps = {
  slug: string;
};

export function DirectoryCandidatePage({ slug }: DirectoryCandidatePageProps) {
  const [candidate, setCandidate] = useState<DirectoryCandidate | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [claimNotice, setClaimNotice] = useState("");
  const [removalNotice, setRemovalNotice] = useState("");

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const data = await getDirectoryCandidate(slug);
        if (!active) {
          return;
        }
        setCandidate(data);
        setError("");
      } catch (err) {
        if (!active) {
          return;
        }
        setError(
          err instanceof Error
            ? err.message
            : "Impossible de charger cette fiche praticien."
        );
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
  }, [slug]);

  async function handleClaim(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    try {
      const response = await submitDirectoryClaimRequest(slug, {
        claimant_name: String(formData.get("claimant_name") || ""),
        claimant_email: String(formData.get("claimant_email") || ""),
        claimant_phone: String(formData.get("claimant_phone") || ""),
        message: String(formData.get("message") || ""),
      });
      setClaimNotice(response.message);
      setError("");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Impossible d’envoyer la demande de revendication."
      );
    }
  }

  async function handleRemoval(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    try {
      const response = await submitDirectoryRemovalRequest(slug, {
        requester_name: String(formData.get("requester_name") || ""),
        requester_email: String(formData.get("requester_email") || ""),
        reason: String(formData.get("reason") || ""),
      });
      setRemovalNotice(response.message);
      setError("");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Impossible d’envoyer la demande de suppression."
      );
    }
  }

  return (
    <main className="min-h-screen px-4 pb-12 pt-4 md:px-6">
      <SiteHeader />

      <div className="mx-auto mt-6 max-w-5xl space-y-6">
        {loading ? (
          <Skeleton className="h-96 rounded-[2rem]" />
        ) : error ? (
          <Notice tone="error">{error}</Notice>
        ) : candidate ? (
          <>
            <Card className="rounded-[2rem]">
              <Badge tone="warning">Fiche praticien non revendiquée</Badge>
              <h1 className="mt-5 text-4xl font-semibold tracking-tight text-[var(--foreground)]">
                {candidate.business_name}
              </h1>
              <p className="mt-4 flex items-center gap-2 text-sm text-[var(--foreground-muted)]">
                <MapPin className="h-4 w-4" />
                {candidate.service_area || candidate.city || "Ville à préciser"}
              </p>
              {candidate.public_headline ? (
                <p className="mt-4 text-lg font-medium text-[var(--foreground)]">
                  {candidate.public_headline}
                </p>
              ) : null}
              <p className="mt-4 text-sm leading-7 text-[var(--foreground-muted)]">
                {candidate.bio || candidate.claim_notice}
              </p>

              <div className="mt-5 flex flex-wrap gap-2">
                {candidate.massage_categories.map((category) => (
                  <Badge key={category} tone="info">
                    {MASSAGE_CATEGORY_LABELS[category] || category}
                  </Badge>
                ))}
                {candidate.specialties.map((specialty) => (
                  <Badge key={specialty}>{specialty}</Badge>
                ))}
              </div>

              <Notice tone="info" className="mt-5">
                {candidate.claim_notice}
              </Notice>

              <div className="mt-5 flex flex-wrap gap-3">
                <Link href="/inscription">
                  <Button size="lg">Créer ma page praticien</Button>
                </Link>
                <Link href="/praticiens">
                  <Button variant="secondary" size="lg">
                    Retour à l’annuaire
                  </Button>
                </Link>
              </div>
            </Card>

            {claimNotice ? <Notice tone="success">{claimNotice}</Notice> : null}
            {removalNotice ? <Notice tone="success">{removalNotice}</Notice> : null}

            <div className="grid gap-4 lg:grid-cols-2">
              <Card className="rounded-[2rem]">
                <h2 className="text-2xl font-semibold text-[var(--foreground)]">
                  Vous êtes ce praticien ?
                </h2>
                <p className="mt-3 text-sm leading-7 text-[var(--foreground-muted)]">
                  Envoyez une demande honnête de revendication. Aucune réservation,
                  aucun faux lead et aucun client fictif ne sont générés à partir de cette fiche.
                </p>
                <form onSubmit={handleClaim} className="mt-6 space-y-4">
                  <FieldWrapper label="Nom">
                    <Input name="claimant_name" required />
                  </FieldWrapper>
                  <FieldWrapper label="Email">
                    <Input name="claimant_email" type="email" required />
                  </FieldWrapper>
                  <FieldWrapper label="Téléphone">
                    <Input name="claimant_phone" />
                  </FieldWrapper>
                  <FieldWrapper label="Message">
                    <Textarea
                      name="message"
                      placeholder="Je suis bien ce praticien et je souhaite compléter ma fiche."
                    />
                  </FieldWrapper>
                  <Button type="submit" size="lg">
                    Revendiquer cette fiche
                  </Button>
                </form>
              </Card>

              <Card className="rounded-[2rem]">
                <h2 className="text-2xl font-semibold text-[var(--foreground)]">
                  Demander la suppression
                </h2>
                <p className="mt-3 text-sm leading-7 text-[var(--foreground-muted)]">
                  Si cette fiche ne doit pas apparaître dans l’annuaire, vous pouvez
                  demander sa suppression. La demande sera tracée puis revue.
                </p>
                <form onSubmit={handleRemoval} className="mt-6 space-y-4">
                  <FieldWrapper label="Nom">
                    <Input name="requester_name" required />
                  </FieldWrapper>
                  <FieldWrapper label="Email">
                    <Input name="requester_email" type="email" required />
                  </FieldWrapper>
                  <FieldWrapper label="Motif">
                    <Textarea
                      name="reason"
                      placeholder="Merci de retirer cette fiche ou de corriger les informations."
                    />
                  </FieldWrapper>
                  <Button type="submit" variant="secondary" size="lg">
                    Demander la suppression
                  </Button>
                </form>
              </Card>
            </div>
          </>
        ) : null}
      </div>
    </main>
  );
}
