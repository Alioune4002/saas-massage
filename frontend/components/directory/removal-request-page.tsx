"use client";

import { FormEvent, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FieldWrapper, Input, Textarea } from "@/components/ui/field";
import { Notice } from "@/components/ui/notice";
import { createRemovalRequest } from "@/lib/api";

type RemovalRequestPageProps = {
  slugOrId: string;
};

export function RemovalRequestPage({ slugOrId }: RemovalRequestPageProps) {
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    try {
      setSubmitting(true);
      await createRemovalRequest({
        slug_or_id: slugOrId,
        requester_name: String(formData.get("requester_name") || ""),
        requester_email: String(formData.get("requester_email") || ""),
        reason: String(formData.get("reason") || ""),
      });
      setSuccess("Votre demande de suppression a bien été prise en compte.");
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible d’enregistrer la demande.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 md:px-6">
      <Card className="rounded-[2rem] p-6 md:p-8">
        <h1 className="text-4xl font-semibold tracking-tight text-[var(--foreground)]">
          Demander la suppression d’une fiche
        </h1>
        <p className="mt-4 text-sm leading-7 text-[var(--foreground-muted)]">
          Ce formulaire sert à demander la suppression ou la correction d’une fiche praticien
          importée de manière contrôlée. Aucune demande client fictive n’est générée.
        </p>

        {success ? <Notice tone="success" className="mt-6">{success}</Notice> : null}
        {error ? <Notice tone="error" className="mt-6">{error}</Notice> : null}

        <form onSubmit={handleSubmit} className="mt-8 space-y-4">
          <FieldWrapper label="Nom">
            <Input name="requester_name" required />
          </FieldWrapper>
          <FieldWrapper label="Email">
            <Input name="requester_email" type="email" required />
          </FieldWrapper>
          <FieldWrapper label="Motif de la demande">
            <Textarea
              name="reason"
              required
              placeholder="Expliquez si vous êtes le praticien concerné, si les informations sont inexactes ou si vous souhaitez retirer la fiche."
            />
          </FieldWrapper>
          <Button type="submit" size="lg" disabled={submitting}>
            {submitting ? "Envoi..." : "Envoyer ma demande"}
          </Button>
        </form>
      </Card>
    </main>
  );
}
