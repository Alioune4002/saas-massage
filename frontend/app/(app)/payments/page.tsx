"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, CreditCard, Landmark, Wallet } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FieldWrapper, Input } from "@/components/ui/field";
import { Notice } from "@/components/ui/notice";
import { SectionHeading } from "@/components/ui/section-heading";
import { Skeleton } from "@/components/ui/skeleton";
import { StatCard } from "@/components/ui/stat-card";
import {
  connectPaymentAccount,
  getDashboardProfile,
  getApiFieldErrors,
  getApiFormError,
  getPaymentOverview,
  type DashboardProfile,
  type PaymentOverview,
  type PractitionerVerification,
  updatePractitionerVerification,
} from "@/lib/api";
import { formatCurrency } from "@/lib/utils";

export default function PaymentsPage() {
  const [profile, setProfile] = useState<DashboardProfile | null>(null);
  const [overview, setOverview] = useState<PaymentOverview | null>(null);
  const [verification, setVerification] = useState<PractitionerVerification | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [savingVerification, setSavingVerification] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [connectError, setConnectError] = useState("");
  const [verificationError, setVerificationError] = useState("");
  const [verificationFieldErrors, setVerificationFieldErrors] = useState<
    Record<string, string>
  >({});

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const [profileData, overviewData] = await Promise.all([
          getDashboardProfile(),
          getPaymentOverview(),
        ]);
        if (!active) return;
        setProfile(profileData);
        setVerification(profileData.verification);
        setOverview(overviewData);
      } catch (err) {
        if (!active) return;
        setError(
          err instanceof Error
            ? err.message
            : "Impossible de charger les règlements."
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
  }, []);

  async function handleConnectAccount() {
    try {
      setConnecting(true);
      setError("");
      setConnectError("");
      const result = await connectPaymentAccount();
      if (result.url) {
        window.location.href = result.url;
        return;
      }
      setNotice("Le compte de paiement de test est prêt.");
    } catch (err) {
      setConnectError(
        getApiFormError(
          err,
          "Impossible de préparer la connexion du compte de paiement."
        )
      );
    } finally {
      setConnecting(false);
    }
  }

  async function handleVerificationSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    try {
      setSavingVerification(true);
      setError("");
      setVerificationError("");
      setVerificationFieldErrors({});
      const nextVerification = await updatePractitionerVerification(formData);
      setVerification(nextVerification);
      setNotice(
        "Les éléments de vérification ont été enregistrés. Le statut sera mis à jour après revue."
      );
    } catch (err) {
      setVerificationFieldErrors(getApiFieldErrors(err));
      setVerificationError(
        getApiFormError(
          err,
          "Impossible d’enregistrer les éléments de vérification."
        )
      );
    } finally {
      setSavingVerification(false);
    }
  }

  const verificationStatusLabel = verification
    ? {
        not_started: "Non commencé",
        pending: "En attente",
        in_review: "En revue",
        verified: "Vérifié",
        rejected: "Refusé",
        expired: "Expiré",
      }[verification.status]
    : "Non commencé";

  return (
    <div className="space-y-6">
      <SectionHeading
        eyebrow="Règlements"
        title="Paiements et versements"
        description="Retrouve tes encaissements, les sommes encore en attente, les versements à venir et la connexion de ton compte de paiement."
        action={
          profile?.slug ? (
            <Link href={`/${profile.slug}`} target="_blank">
              <Button variant="secondary" size="lg" iconRight={<ArrowUpRight className="h-4 w-4" />}>
                Voir mon profil en tant que client
              </Button>
            </Link>
          ) : null
        }
      />

      {error ? <Notice tone="error">{error}</Notice> : null}
      {notice ? <Notice tone="success">{notice}</Notice> : null}
      {!loading &&
      profile?.payment_account &&
      profile.payment_account.onboarding_status !== "active" ? (
        <Notice tone="info">
          Le compte de paiement existe, mais n’est pas encore entièrement
          activé. Tant que Stripe Connect n’a pas validé les informations du
          praticien, le règlement en ligne et les versements restent limités.
        </Notice>
      ) : null}

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-36 rounded-[1.75rem]" />
          ))}
        </div>
      ) : (
        <>
          <Card>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.26em] text-[var(--primary)]/80">
                  Compte de paiement
                </p>
                <h2 className="mt-3 text-2xl font-semibold text-[var(--foreground)]">
                  {profile?.payment_account?.onboarding_status === "active"
                    ? "Compte prêt à recevoir des règlements"
                    : "Connecter mon compte de paiement"}
                </h2>
                <p className="mt-2 text-sm leading-6 text-[var(--foreground-muted)]">
                  Reliez votre compte Stripe Connect pour accepter les règlements
                  sur la plateforme et préparer les versements après validation
                  de prestation.
                </p>
              </div>

              <Button size="lg" onClick={handleConnectAccount} disabled={connecting}>
                {connecting ? "Préparation..." : "Connecter mon compte de paiement"}
              </Button>
            </div>

            {connectError ? (
              <Notice tone="error" className="mt-5">
                {connectError}
              </Notice>
            ) : null}
          </Card>

          <Card>
            <div className="flex flex-col gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.26em] text-[var(--primary)]/80">
                  Vérification praticien
                </p>
                <h2 className="mt-3 text-2xl font-semibold text-[var(--foreground)]">
                  Statut KYC : {verificationStatusLabel}
                </h2>
                <p className="mt-2 text-sm leading-6 text-[var(--foreground-muted)]">
                  Déposez vos justificatifs pour préparer la mention publique
                  “Praticien vérifié” et fluidifier les opérations sensibles.
                </p>
              </div>

              {verification?.badge_is_active ? (
                <Notice tone="success">
                  Praticien vérifié. {verification.badge_tooltip}
                </Notice>
              ) : null}
              {verification?.rejection_reason ? (
                <Notice tone="error">{verification.rejection_reason}</Notice>
              ) : null}
              {verificationError ? (
                <Notice tone="error">{verificationError}</Notice>
              ) : null}

              <form
                onSubmit={handleVerificationSubmit}
                className="grid gap-4 lg:grid-cols-2"
              >
                <FieldWrapper
                  label="SIREN"
                  error={verificationFieldErrors.siren}
                >
                  <Input
                    name="siren"
                    defaultValue={verification?.siren || ""}
                    placeholder="9 chiffres"
                  />
                </FieldWrapper>
                <FieldWrapper
                  label="SIRET"
                  error={verificationFieldErrors.siret}
                >
                  <Input
                    name="siret"
                    defaultValue={verification?.siret || ""}
                    placeholder="14 chiffres"
                  />
                </FieldWrapper>
                <FieldWrapper
                  label="Bénéficiaire"
                  error={verificationFieldErrors.beneficiary_name}
                >
                  <Input
                    name="beneficiary_name"
                    defaultValue={verification?.beneficiary_name || ""}
                    placeholder="Nom du bénéficiaire des versements"
                  />
                </FieldWrapper>
                <FieldWrapper
                  label="4 derniers chiffres de l’IBAN"
                  error={verificationFieldErrors.iban_last4}
                >
                  <Input
                    name="iban_last4"
                    maxLength={4}
                    defaultValue={verification?.iban_last4 || ""}
                    placeholder="1234"
                  />
                </FieldWrapper>
                <FieldWrapper
                  label="Pièce d’identité"
                  error={verificationFieldErrors.identity_document}
                >
                  <Input name="identity_document" type="file" />
                </FieldWrapper>
                <FieldWrapper
                  label="Selfie de vérification"
                  error={verificationFieldErrors.selfie_document}
                >
                  <Input name="selfie_document" type="file" />
                </FieldWrapper>
                <FieldWrapper
                  label="Justificatif d’activité"
                  error={verificationFieldErrors.activity_document}
                >
                  <Input name="activity_document" type="file" />
                </FieldWrapper>
                <FieldWrapper
                  label="Attestation RC Pro"
                  error={verificationFieldErrors.liability_insurance_document}
                >
                  <Input name="liability_insurance_document" type="file" />
                </FieldWrapper>
                <FieldWrapper
                  label="Justificatif bancaire"
                  error={verificationFieldErrors.iban_document}
                >
                  <Input name="iban_document" type="file" />
                </FieldWrapper>
                <div className="lg:col-span-2">
                  <Button type="submit" disabled={savingVerification}>
                    {savingVerification
                      ? "Enregistrement..."
                      : "Enregistrer les éléments de vérification"}
                  </Button>
                </div>
              </form>

              {verification?.decisions?.length ? (
                <div className="space-y-3">
                  <h3 className="text-lg font-semibold text-[var(--foreground)]">
                    Historique des décisions
                  </h3>
                  <div className="grid gap-3">
                    {verification.decisions.slice(0, 4).map((decision) => (
                      <div
                        key={decision.id}
                        className="rounded-[1.2rem] border border-[var(--border)] bg-[var(--background-soft)] px-4 py-3"
                      >
                        <p className="text-sm font-medium text-[var(--foreground)]">
                          {decision.from_status || "aucun"} → {decision.to_status}
                        </p>
                        {decision.reason ? (
                          <p className="mt-1 text-sm text-[var(--foreground-muted)]">
                            {decision.reason}
                          </p>
                        ) : null}
                        <p className="mt-2 text-xs uppercase tracking-[0.18em] text-[var(--foreground-subtle)]">
                          {new Date(decision.created_at).toLocaleString("fr-FR")}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </Card>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <StatCard
              label="Règlements capturés sur la plateforme"
              value={formatCurrency(overview?.collected_platform_eur ?? "0")}
              hint="Montants confirmés côté paiement, avant versement praticien."
              icon={<Wallet className="h-5 w-5" />}
            />
            <StatCard
              label="CA encaissé hors plateforme"
              value={formatCurrency(overview?.collected_off_platform_eur ?? "0")}
              hint="Espèces, virement ou autre règlement enregistré."
              icon={<Landmark className="h-5 w-5" />}
            />
            <StatCard
              label="Acomptes encaissés"
              value={formatCurrency(overview?.deposits_captured_eur ?? "0")}
              hint="Créneaux déjà sécurisés par un acompte."
              icon={<CreditCard className="h-5 w-5" />}
            />
            <StatCard
              label="Reste à encaisser"
              value={formatCurrency(overview?.remaining_to_collect_eur ?? "0")}
              hint="Montants encore attendus sur place ou après confirmation."
              icon={<Wallet className="h-5 w-5" />}
            />
            <StatCard
              label="Remboursements"
              value={formatCurrency(overview?.refunded_eur ?? "0")}
              hint="Montants déjà remboursés à vos clients."
              icon={<CreditCard className="h-5 w-5" />}
            />
            <StatCard
              label="Versements à venir"
              value={formatCurrency(overview?.payouts_pending_eur ?? "0")}
              hint="Sommes validées ou encore retenues avant envoi au praticien."
              icon={<Landmark className="h-5 w-5" />}
            />
          </div>

          <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
            <Card>
              <h3 className="text-lg font-semibold text-[var(--foreground)]">
                Répartition par moyen de règlement
              </h3>
              <div className="mt-4 space-y-3">
                {overview?.by_channel.map((item) => (
                  <div
                    key={item.channel}
                    className="flex items-center justify-between rounded-[1.2rem] border border-[var(--border)] bg-[var(--background-soft)] px-4 py-3"
                  >
                    <span className="text-sm text-[var(--foreground-muted)]">
                      {item.label}
                    </span>
                    <span className="text-sm font-semibold text-[var(--foreground)]">
                      {formatCurrency(item.amount_eur)}
                    </span>
                  </div>
                ))}
              </div>
            </Card>

            <Card>
              <h3 className="text-lg font-semibold text-[var(--foreground)]">
                Derniers mouvements
              </h3>
              <div className="mt-4 space-y-3">
                {overview?.recent_movements.map((movement) => (
                  <div
                    key={movement.id}
                    className="rounded-[1.2rem] border border-[var(--border)] bg-[var(--background-soft)] px-4 py-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-medium text-[var(--foreground)]">
                        {movement.kind === "deposit"
                          ? "Acompte"
                          : movement.kind === "full"
                            ? "Paiement total"
                            : movement.kind === "refund"
                              ? "Remboursement"
                              : movement.kind === "payout"
                                ? "Versement praticien"
                                : "Règlement enregistré"}
                      </span>
                      <span className="text-sm font-semibold text-[var(--foreground)]">
                        {formatCurrency(movement.amount_eur)}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-[var(--foreground-muted)]">
                      {movement.provider === "stripe_connect"
                        ? "Plateforme Stripe Connect"
                        : movement.provider === "manual"
                          ? "Enregistré manuellement"
                          : "Système"}
                    </p>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
