"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { LegalLinks } from "@/components/legal/legal-links";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FieldWrapper, Input } from "@/components/ui/field";
import { Notice } from "@/components/ui/notice";
import { Skeleton } from "@/components/ui/skeleton";
import {
  completeClaimOnboarding,
  requestImportedProfileClaim,
  verifyClaimToken,
  type ClaimVerificationResponse,
} from "@/lib/api";
import { getAuthenticatedHomePath, hydrateSession } from "@/lib/auth";

const requiredDocuments = [
  { slug: "cgu", label: "les CGU", href: "/cgu" },
  { slug: "cgv", label: "les CGV", href: "/cgv" },
  { slug: "contrat-praticien", label: "le contrat praticien", href: "/contrat-praticien" },
  { slug: "confidentialite", label: "la politique de confidentialité", href: "/confidentialite" },
];

type ClaimPageProps = {
  token?: string;
  profileId?: string;
};

export function ClaimPage({ token, profileId = "" }: ClaimPageProps) {
  const router = useRouter();
  const [verification, setVerification] = useState<ClaimVerificationResponse | null>(null);
  const [loading, setLoading] = useState(Boolean(token));
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [acceptedDocuments, setAcceptedDocuments] = useState<string[]>([]);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }

    const claimToken = token;

    let active = true;
    async function load() {
      try {
        const data = await verifyClaimToken(claimToken);
        if (!active) {
          return;
        }
        setVerification(data);
        setError("");
      } catch (err) {
        if (!active) {
          return;
        }
        setError(err instanceof Error ? err.message : "Lien de revendication invalide.");
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
  }, [token]);

  async function handleInviteRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!profileId) {
      setError("Aucune fiche cible n’a été trouvée.");
      return;
    }
    try {
      setSubmitting(true);
      const result = await requestImportedProfileClaim(profileId, inviteEmail);
      setSuccess(
        result.status === "sent"
          ? "Un lien de revendication a été envoyé si l’adresse est autorisée pour cette fiche."
          : "Demande enregistrée."
      );
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible d’envoyer la demande.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleComplete(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!verification) {
      return;
    }
    const formData = new FormData(event.currentTarget);
    try {
      setSubmitting(true);
      const result = await completeClaimOnboarding({
        token: verification.claim.token,
        first_name: String(formData.get("first_name") || ""),
        last_name: String(formData.get("last_name") || ""),
        business_name: String(formData.get("business_name") || ""),
        email: String(formData.get("email") || ""),
        password: String(formData.get("password") || ""),
        password_confirmation: String(formData.get("password_confirmation") || ""),
        accepted_documents: acceptedDocuments,
      });
      const me = await hydrateSession(result.token);
      router.replace(getAuthenticatedHomePath(me));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de finaliser la revendication.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-10 md:px-6">
        <Skeleton className="h-16 rounded-[1.8rem]" />
        <Skeleton className="mt-4 h-64 rounded-[2rem]" />
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-10 md:px-6">
      <Card className="rounded-[2rem] p-6 md:p-8">
        <Badge tone="info">Revendication de fiche</Badge>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight text-[var(--foreground)]">
          Revendiquer une fiche praticien
        </h1>
        <p className="mt-4 text-sm leading-7 text-[var(--foreground-muted)]">
          Ce parcours ne crée aucun faux lead ni aucun faux signal d’activité. Il sert uniquement
          à rattacher une fiche existante ou à demander l’envoi d’un lien de revendication honnête.
        </p>

        {error ? <Notice tone="error" className="mt-6">{error}</Notice> : null}
        {success ? <Notice tone="success" className="mt-6">{success}</Notice> : null}

        {!verification ? (
          <form onSubmit={handleInviteRequest} className="mt-8 space-y-4">
            <FieldWrapper label="Adresse e-mail de revendication">
              <Input
                type="email"
                required
                value={inviteEmail}
                onChange={(event) => setInviteEmail(event.target.value)}
                placeholder="vous@exemple.com"
              />
            </FieldWrapper>
            <Button type="submit" size="lg" disabled={submitting}>
              {submitting ? "Envoi..." : "Recevoir un lien de revendication"}
            </Button>
          </form>
        ) : (
          <form onSubmit={handleComplete} className="mt-8 space-y-5">
            <Notice tone="info">
              Fiche détectée: <strong>{verification.profile.business_name || verification.profile.public_name}</strong>
            </Notice>
            <div className="grid gap-4 md:grid-cols-2">
              <FieldWrapper label="Prénom">
                <Input name="first_name" defaultValue="" />
              </FieldWrapper>
              <FieldWrapper label="Nom">
                <Input name="last_name" defaultValue="" />
              </FieldWrapper>
            </div>
            <FieldWrapper label="Nom affiché">
              <Input
                name="business_name"
                defaultValue={verification.profile.business_name || verification.profile.public_name}
              />
            </FieldWrapper>
            <div className="grid gap-4 md:grid-cols-2">
              <FieldWrapper label="Adresse e-mail du compte">
                <Input
                  name="email"
                  type="email"
                  defaultValue={verification.claim.email}
                  required
                />
              </FieldWrapper>
              <FieldWrapper label="Mot de passe">
                <Input name="password" type="password" required />
              </FieldWrapper>
            </div>
            <FieldWrapper label="Confirmer le mot de passe">
              <Input name="password_confirmation" type="password" required />
            </FieldWrapper>
            <div className="space-y-3 rounded-[1.4rem] border border-[var(--border)] bg-[var(--background-soft)] p-4">
              <p className="text-sm font-medium text-[var(--foreground)]">
                J’accepte les documents requis pour activer mon compte praticien
              </p>
              {requiredDocuments.map((document) => (
                <label key={document.slug} className="flex items-start gap-3 text-sm text-[var(--foreground-muted)]">
                  <input
                    type="checkbox"
                    checked={acceptedDocuments.includes(document.slug)}
                    onChange={(event) =>
                      setAcceptedDocuments((current) =>
                        event.target.checked
                          ? [...current, document.slug]
                          : current.filter((value) => value !== document.slug)
                      )
                    }
                  />
                  <span>
                    J’accepte{" "}
                    <a href={document.href} className="underline">
                      {document.label}
                    </a>
                    .
                  </span>
                </label>
              ))}
            </div>
            <Button type="submit" size="lg" disabled={submitting}>
              {submitting ? "Activation..." : "Activer ma fiche praticien"}
            </Button>
          </form>
        )}

        <div className="mt-8">
          <LegalLinks />
        </div>
      </Card>
    </main>
  );
}
