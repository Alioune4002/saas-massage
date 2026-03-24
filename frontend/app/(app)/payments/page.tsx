"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, CreditCard, Landmark, Wallet } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Notice } from "@/components/ui/notice";
import { SectionHeading } from "@/components/ui/section-heading";
import { Skeleton } from "@/components/ui/skeleton";
import { StatCard } from "@/components/ui/stat-card";
import {
  connectPaymentAccount,
  getDashboardProfile,
  getPaymentOverview,
  type DashboardProfile,
  type PaymentOverview,
} from "@/lib/api";
import { formatCurrency } from "@/lib/utils";

export default function PaymentsPage() {
  const [profile, setProfile] = useState<DashboardProfile | null>(null);
  const [overview, setOverview] = useState<PaymentOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

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
      const result = await connectPaymentAccount();
      if (result.url) {
        window.location.href = result.url;
        return;
      }
      setNotice("Le compte de paiement de test est prêt.");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Impossible de préparer le compte de paiement."
      );
    } finally {
      setConnecting(false);
    }
  }

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
