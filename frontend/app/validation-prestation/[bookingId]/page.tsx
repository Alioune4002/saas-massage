"use client";

import { useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { CheckCircle2, AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FieldWrapper, Textarea } from "@/components/ui/field";
import { Notice } from "@/components/ui/notice";
import { validateServiceCompletion } from "@/lib/api";

export default function ServiceValidationPage() {
  const params = useParams<{ bookingId: string }>();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";
  const bookingId = useMemo(() => String(params.bookingId || ""), [params.bookingId]);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [issueReason, setIssueReason] = useState("");

  async function handleValidate() {
    try {
      setLoading(true);
      setError("");
      await validateServiceCompletion(bookingId, token);
      setNotice(
        "Merci. Votre validation a bien été enregistrée et le suivi de règlement peut maintenant avancer."
      );
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Impossible d’enregistrer votre validation.";
      if (message.includes("déjà été validée")) {
        setNotice("Cette séance avait déjà été validée auparavant.");
      } else {
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleReportIssue() {
    try {
      setLoading(true);
      setError("");
      await validateServiceCompletion(
        bookingId,
        token,
        "report_issue",
        issueReason.trim() || "Le client demande une vérification après la séance."
      );
      setNotice(
        "Votre signalement a bien été transmis. Le versement reste bloqué pendant la vérification."
      );
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Impossible d’enregistrer ce signalement.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen px-4 py-10 md:px-6">
      <div className="mx-auto max-w-2xl space-y-4">
        <Card className="rounded-[2rem]">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-6 w-6 text-[color:var(--success)]" />
            <div>
              <p className="text-xs uppercase tracking-[0.26em] text-[color:var(--success)]/80">
                Validation de prestation
              </p>
              <h1 className="mt-2 text-3xl font-semibold text-[var(--foreground)]">
                Confirmer que votre séance a bien eu lieu
              </h1>
            </div>
          </div>

          <p className="mt-5 text-sm leading-7 text-[var(--foreground-muted)]">
            Cette confirmation permet de clôturer le suivi du rendez-vous et de
            débloquer le versement prévu lorsque le règlement a été sécurisé sur
            la plateforme.
          </p>

          {error ? <Notice tone="error" className="mt-5">{error}</Notice> : null}
          {notice ? <Notice tone="success" className="mt-5">{notice}</Notice> : null}

          <div className="mt-6">
            <Button size="lg" onClick={handleValidate} disabled={loading || !token}>
              {loading ? "Validation en cours..." : "Oui, ma séance s’est bien déroulée"}
            </Button>
          </div>

          <div className="mt-8 rounded-[1.5rem] border border-[var(--border)] bg-[var(--background-soft)] p-4">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-[var(--warning)]" />
              <div>
                <p className="text-sm font-medium text-[var(--foreground)]">
                  Signaler un problème
                </p>
                <p className="mt-1 text-sm text-[var(--foreground-muted)]">
                  Utilisez ce signalement si la séance ne s’est pas déroulée comme prévu.
                </p>
              </div>
            </div>
            <div className="mt-4 space-y-4">
              <FieldWrapper label="Expliquez brièvement la situation">
                <Textarea
                  value={issueReason}
                  onChange={(event) => setIssueReason(event.target.value)}
                  placeholder="Exemple : la séance n’a pas eu lieu, le lieu n’était pas accessible, ou un point important doit être vérifié."
                />
              </FieldWrapper>
              <Button
                variant="secondary"
                size="lg"
                onClick={handleReportIssue}
                disabled={loading || !token}
              >
                {loading ? "Envoi..." : "Signaler un problème"}
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </main>
  );
}
