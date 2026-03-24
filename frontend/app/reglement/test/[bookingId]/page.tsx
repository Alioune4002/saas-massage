"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Notice } from "@/components/ui/notice";
import { confirmTestPayment } from "@/lib/api";

export default function TestPaymentPage() {
  const params = useParams<{ bookingId: string }>();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";
  const bookingId = useMemo(() => String(params.bookingId || ""), [params.bookingId]);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  async function handleConfirm() {
    try {
      setLoading(true);
      setError("");
      const result = await confirmTestPayment(bookingId, token);
      setNotice(
        result.amount_remaining_eur && Number(result.amount_remaining_eur) > 0
          ? "Le règlement test est bien sécurisé. Le reste pourra être réglé ensuite selon les conditions prévues."
          : "Le règlement test est bien sécurisé sur la plateforme."
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Impossible de finaliser ce règlement de test."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen px-4 py-10 md:px-6">
      <div className="mx-auto max-w-2xl space-y-4">
        <Card className="rounded-[2rem]">
          <div className="flex items-center gap-3">
            <ShieldCheck className="h-6 w-6 text-[var(--primary)]" />
            <div>
              <p className="text-xs uppercase tracking-[0.26em] text-[var(--primary)]/80">
                Règlement de test Stripe
              </p>
              <h1 className="mt-2 text-3xl font-semibold text-[var(--foreground)]">
                Finaliser le règlement sécurisé
              </h1>
            </div>
          </div>

          <p className="mt-5 text-sm leading-7 text-[var(--foreground-muted)]">
            Cette page simule le retour prestataire en environnement de test. Le
            règlement ne sera marqué comme sécurisé qu’après cette validation.
          </p>

          {!token ? (
            <Notice tone="info" className="mt-5">
              Ce lien de règlement de test est incomplet ou n’est plus valable.
            </Notice>
          ) : null}

          {error ? <Notice tone="error" className="mt-5">{error}</Notice> : null}
          {notice ? <Notice tone="success" className="mt-5">{notice}</Notice> : null}

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Button size="lg" onClick={handleConfirm} disabled={loading || !token}>
              {loading ? "Validation en cours..." : "Finaliser le règlement de test"}
            </Button>
            <Link href="/" className="shrink-0">
              <Button variant="secondary" size="lg">
                Revenir au site
              </Button>
            </Link>
          </div>
        </Card>
      </div>
    </main>
  );
}
