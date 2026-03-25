"use client";

import { FormEvent, useEffect, useState } from "react";
import { Star, UserRoundPlus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FieldWrapper, Input, Select, Textarea } from "@/components/ui/field";
import { Notice } from "@/components/ui/notice";
import { SectionHeading } from "@/components/ui/section-heading";
import { Skeleton } from "@/components/ui/skeleton";
import {
  createReviewInvitation,
  createTrustedClient,
  flagReview,
  getReviewInvitations,
  getReviews,
  respondToReview,
  getTrustedClients,
  type ReviewInvitation,
  type ReviewPractitionerItem,
  type TrustedClient,
} from "@/lib/api";

export default function ReviewsPage() {
  const [reviews, setReviews] = useState<ReviewPractitionerItem[]>([]);
  const [invitations, setInvitations] = useState<ReviewInvitation[]>([]);
  const [trustedClients, setTrustedClients] = useState<TrustedClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [inviting, setInviting] = useState(false);
  const [savingTrustedClient, setSavingTrustedClient] = useState(false);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const [reviewsData, invitationsData, trustedClientsData] = await Promise.all([
          getReviews(),
          getReviewInvitations(),
          getTrustedClients(),
        ]);
        if (!active) return;
        setReviews(reviewsData);
        setInvitations(invitationsData);
        setTrustedClients(trustedClientsData);
      } catch (err) {
        if (!active) return;
        setError(
          err instanceof Error ? err.message : "Impossible de charger les avis."
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

  async function handleInviteReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    try {
      setInviting(true);
      setError("");
      const invitation = await createReviewInvitation({
        first_name: String(formData.get("first_name") || ""),
        last_name: String(formData.get("last_name") || ""),
        email: String(formData.get("email") || ""),
        source: String(formData.get("source") || "manual") as "manual" | "booking" | "legacy",
      });
      setInvitations((current) => [invitation, ...current]);
      event.currentTarget.reset();
      setNotice("L’invitation d’avis a été préparée.");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Impossible de créer l’invitation d’avis."
      );
    } finally {
      setInviting(false);
    }
  }

  async function handleFlagReview(id: string) {
    const reason =
      window.prompt("Expliquez brièvement pourquoi cet avis doit être vérifié.") ||
      "";
    if (!reason.trim()) {
      return;
    }

    try {
      setError("");
      const review = await flagReview(id, reason);
      setReviews((current) =>
        current.map((item) => (item.id === id ? review : item))
      );
      setNotice("L’avis a été signalé pour vérification.");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Impossible de signaler cet avis."
      );
    }
  }

  async function handleRespondToReview(id: string) {
    const response =
      window.prompt("Rédigez une réponse publique courte et professionnelle.") || "";
    if (!response.trim()) {
      return;
    }

    try {
      setError("");
      const review = await respondToReview(id, response);
      setReviews((current) =>
        current.map((item) => (item.id === id ? review : item))
      );
      setNotice("La réponse publique a été ajoutée.");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Impossible d’ajouter cette réponse."
      );
    }
  }

  async function handleCreateTrustedClient(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    try {
      setSavingTrustedClient(true);
      setError("");
      const trustedClient = await createTrustedClient({
        first_name: String(formData.get("first_name") || ""),
        last_name: String(formData.get("last_name") || ""),
        email: String(formData.get("email") || ""),
        waive_deposit: formData.get("waive_deposit") === "on",
        allow_pay_on_site: formData.get("allow_pay_on_site") === "on",
        notes: String(formData.get("notes") || ""),
        is_active: true,
      });
      setTrustedClients((current) => [trustedClient, ...current]);
      event.currentTarget.reset();
      setNotice("Le client de confiance a été ajouté.");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Impossible d’ajouter ce client de confiance."
      );
    } finally {
      setSavingTrustedClient(false);
    }
  }

  return (
    <div className="space-y-6">
      <SectionHeading
        eyebrow="Avis clients"
        title="Avis et clients de confiance"
        description="Invitez vos anciens clients à partager leur ressenti et identifiez les clients connus pour leur proposer des conditions plus souples."
      />

      {error ? <Notice tone="error">{error}</Notice> : null}
      {notice ? <Notice tone="success">{notice}</Notice> : null}

      {loading ? (
        <div className="grid gap-4 xl:grid-cols-2">
          <Skeleton className="h-[28rem] rounded-[2rem]" />
          <Skeleton className="h-[28rem] rounded-[2rem]" />
        </div>
      ) : (
        <>
          <div className="grid gap-4 xl:grid-cols-2">
            <Card>
              <div className="flex items-center gap-3">
                <Star className="h-5 w-5 text-[var(--primary)]" />
                <div>
                  <h2 className="text-xl font-semibold text-[var(--foreground)]">
                    Demander des avis
                  </h2>
                  <p className="mt-1 text-sm text-[var(--foreground-muted)]">
                    Invitez vos anciens clients avec un lien unique, simple et rassurant.
                  </p>
                </div>
              </div>

              <form onSubmit={handleInviteReview} className="mt-6 space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <FieldWrapper label="Prénom">
                    <Input name="first_name" required />
                  </FieldWrapper>
                  <FieldWrapper label="Nom">
                    <Input name="last_name" />
                  </FieldWrapper>
                </div>
                <FieldWrapper label="Email">
                  <Input name="email" type="email" required />
                </FieldWrapper>
                <FieldWrapper label="Type d’invitation">
                  <Select name="source" defaultValue="manual">
                    <option value="manual">Client invité</option>
                    <option value="legacy">Client historique</option>
                  </Select>
                </FieldWrapper>
                <Button type="submit" disabled={inviting}>
                  {inviting ? "Préparation..." : "Préparer l’invitation"}
                </Button>
              </form>

              <div className="mt-6 space-y-3">
                {invitations.slice(0, 5).map((invitation) => (
                  <div
                    key={invitation.id}
                    className="rounded-[1.2rem] border border-[var(--border)] bg-[var(--background-soft)] px-4 py-3"
                  >
                    <p className="font-medium text-[var(--foreground)]">
                      {invitation.first_name} {invitation.last_name}
                    </p>
                    <p className="mt-1 text-sm text-[var(--foreground-muted)]">
                      {invitation.email}
                    </p>
                    <p className="mt-2 text-xs uppercase tracking-[0.18em] text-[var(--foreground-subtle)]">
                      {invitation.used_at
                        ? "Invitation utilisée"
                        : invitation.sent_at
                          ? "Invitation envoyée"
                          : "Invitation prête"}
                    </p>
                  </div>
                ))}
              </div>
            </Card>

            <Card>
              <div className="flex items-center gap-3">
                <UserRoundPlus className="h-5 w-5 text-[var(--primary)]" />
                <div>
                  <h2 className="text-xl font-semibold text-[var(--foreground)]">
                    Clients de confiance
                  </h2>
                  <p className="mt-1 text-sm text-[var(--foreground-muted)]">
                    Autorisez certains clients connus à réserver sans acompte ou à régler sur place.
                  </p>
                </div>
              </div>

              <form onSubmit={handleCreateTrustedClient} className="mt-6 space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <FieldWrapper label="Prénom">
                    <Input name="first_name" required />
                  </FieldWrapper>
                  <FieldWrapper label="Nom">
                    <Input name="last_name" />
                  </FieldWrapper>
                </div>
                <FieldWrapper label="Email">
                  <Input name="email" type="email" required />
                </FieldWrapper>
                <FieldWrapper label="Notes internes" hint="Optionnel">
                  <Textarea name="notes" />
                </FieldWrapper>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="flex items-center gap-3 rounded-[1rem] border border-[var(--border)] px-4 py-3 text-sm text-[var(--foreground)]">
                    <input type="checkbox" name="waive_deposit" defaultChecked />
                    Réserver sans acompte
                  </label>
                  <label className="flex items-center gap-3 rounded-[1rem] border border-[var(--border)] px-4 py-3 text-sm text-[var(--foreground)]">
                    <input type="checkbox" name="allow_pay_on_site" defaultChecked />
                    Régler sur place
                  </label>
                </div>
                <Button type="submit" disabled={savingTrustedClient}>
                  {savingTrustedClient ? "Enregistrement..." : "Ajouter ce client"}
                </Button>
              </form>

              <div className="mt-6 space-y-3">
                {trustedClients.slice(0, 5).map((client) => (
                  <div
                    key={client.id}
                    className="rounded-[1.2rem] border border-[var(--border)] bg-[var(--background-soft)] px-4 py-3"
                  >
                    <p className="font-medium text-[var(--foreground)]">
                      {client.first_name} {client.last_name}
                    </p>
                    <p className="mt-1 text-sm text-[var(--foreground-muted)]">
                      {client.email}
                    </p>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          <Card>
            <h2 className="text-xl font-semibold text-[var(--foreground)]">
              Avis déjà publiés
            </h2>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {reviews.map((review) => (
                <div
                  key={review.id}
                  className="rounded-[1.2rem] border border-[var(--border)] bg-[var(--background-soft)] px-4 py-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-medium text-[var(--foreground)]">{review.author_name}</p>
                    <p className="text-sm text-[var(--foreground-subtle)]">
                      {review.rating}/5
                    </p>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-[var(--foreground-muted)]">
                    {review.comment}
                  </p>
                    <p className="mt-3 text-xs uppercase tracking-[0.18em] text-[var(--foreground-subtle)]">
                      {review.verification_label} ·{" "}
                    {review.status === "approved"
                      ? "Approuvé"
                      : review.status === "hidden"
                        ? "Masqué"
                        : review.status === "rejected"
                          ? "Refusé"
                          : "En attente"}
                      {review.experience_date
                        ? ` · expérience du ${new Date(review.experience_date).toLocaleDateString("fr-FR")}`
                        : ""}
                  </p>
                  {review.flag_reason ? (
                    <p className="mt-2 text-sm leading-6 text-[var(--warning)]">
                      {review.flag_reason}
                    </p>
                  ) : null}
                  {review.practitioner_response ? (
                    <div className="mt-3 rounded-[1rem] border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-3">
                      <p className="text-xs uppercase tracking-[0.18em] text-[var(--foreground-subtle)]">
                        Votre réponse publique
                      </p>
                      <p className="mt-2 text-sm leading-6 text-[var(--foreground-muted)]">
                        {review.practitioner_response}
                      </p>
                    </div>
                  ) : null}
                  {review.status !== "hidden" ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleFlagReview(review.id)}
                      >
                        Signaler pour vérification
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRespondToReview(review.id)}
                      >
                        Répondre publiquement
                      </Button>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
