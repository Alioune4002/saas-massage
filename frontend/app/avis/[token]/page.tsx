"use client";

import { FormEvent, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Star } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FieldWrapper, Input, Textarea } from "@/components/ui/field";
import { Notice } from "@/components/ui/notice";
import { getReviewTokenInfo, submitReview } from "@/lib/api";

export default function ReviewTokenPage() {
  const params = useParams<{ token: string }>();
  const token = String(params.token || "");
  const [info, setInfo] = useState<{
    valid: boolean;
    reason?: "missing" | "invalid" | "used" | "expired" | "";
    first_name?: string;
    professional_name?: string;
    used?: boolean;
  } | null>(null);
  const [rating, setRating] = useState(5);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const data = await getReviewTokenInfo(token);
        if (!active) return;
        setInfo(data);
      } catch {
        if (!active) return;
        setInfo({ valid: false });
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

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    try {
      setSaving(true);
      setError("");
      await submitReview({
        token,
        author_name: String(formData.get("author_name") || ""),
        rating,
        comment: String(formData.get("comment") || ""),
      });
      setNotice("Merci. Votre avis a bien été enregistré.");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Impossible d’enregistrer votre avis."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen px-4 py-10 md:px-6">
      <div className="mx-auto max-w-2xl space-y-4">
        <Card className="rounded-[2rem]">
          <div className="flex items-center gap-3">
            <Star className="h-6 w-6 text-[var(--primary)]" />
            <div>
              <p className="text-xs uppercase tracking-[0.26em] text-[var(--primary)]/80">
                Avis client
              </p>
              <h1 className="mt-2 text-3xl font-semibold text-[var(--foreground)]">
                Partager votre ressenti
              </h1>
            </div>
          </div>

          {loading ? (
            <p className="mt-5 text-sm text-[var(--foreground-muted)]">Chargement du lien d’avis...</p>
          ) : !info?.valid ? (
            <Notice tone="error" className="mt-5">
              {info?.reason === "used"
                ? "Ce lien d’avis a déjà été utilisé."
                : info?.reason === "expired"
                  ? "Ce lien d’avis a expiré."
                  : "Ce lien d’avis n’est pas valide."}
            </Notice>
          ) : (
            <>
              <p className="mt-5 text-sm leading-7 text-[var(--foreground-muted)]">
                {info.first_name ? `Bonjour ${info.first_name}, ` : ""}
                vous pouvez laisser un avis pour votre expérience avec{" "}
                {info.professional_name || "ce praticien"}.
              </p>

              {error ? <Notice tone="error" className="mt-5">{error}</Notice> : null}
              {notice ? <Notice tone="success" className="mt-5">{notice}</Notice> : null}

              {!notice ? (
                <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                  <FieldWrapper label="Nom affiché">
                    <Input name="author_name" required />
                  </FieldWrapper>
                  <FieldWrapper label="Note">
                    <select
                      value={rating}
                      onChange={(event) => setRating(Number(event.target.value))}
                      className="h-12 w-full rounded-[1rem] border border-[var(--border)] bg-[var(--background-soft)] px-4 text-sm text-[var(--foreground)]"
                    >
                      {[5, 4, 3, 2, 1].map((value) => (
                        <option key={value} value={value}>
                          {value}/5
                        </option>
                      ))}
                    </select>
                  </FieldWrapper>
                  <FieldWrapper label="Votre avis">
                    <Textarea name="comment" required />
                  </FieldWrapper>
                  <Button type="submit" size="lg" disabled={saving}>
                    {saving ? "Enregistrement..." : "Publier mon avis"}
                  </Button>
                </form>
              ) : null}
            </>
          )}
        </Card>
      </div>
    </main>
  );
}
