"use client";

import { FormEvent, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FieldWrapper, Input, Textarea } from "@/components/ui/field";
import { Notice } from "@/components/ui/notice";
import { submitDirectoryInterest, type DirectoryInterestPayload } from "@/lib/api";

type LaunchInterestFormProps = {
  kind: DirectoryInterestPayload["kind"];
  title: string;
  description: string;
  practitionerLabel?: string;
};

export function LaunchInterestForm({
  kind,
  title,
  description,
  practitionerLabel = "Nom du praticien",
}: LaunchInterestFormProps) {
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    try {
      setSubmitting(true);
      setError("");
      await submitDirectoryInterest({
        kind,
        full_name: String(formData.get("full_name") || ""),
        email: String(formData.get("email") || ""),
        city: String(formData.get("city") || ""),
        practitioner_name: String(formData.get("practitioner_name") || ""),
        message: String(formData.get("message") || ""),
        source_page:
          typeof window !== "undefined" ? window.location.pathname : "/",
      });
      setNotice("Votre demande a bien été enregistrée.");
      (event.currentTarget as HTMLFormElement).reset();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Impossible d’enregistrer cette demande pour le moment."
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card className="rounded-[1.8rem]">
      <h3 className="text-xl font-semibold text-[var(--foreground)]">{title}</h3>
      <p className="mt-3 text-sm leading-7 text-[var(--foreground-muted)]">
        {description}
      </p>

      {error ? <Notice tone="error" className="mt-4">{error}</Notice> : null}
      {notice ? <Notice tone="success" className="mt-4">{notice}</Notice> : null}

      <form onSubmit={handleSubmit} className="mt-5 space-y-4">
        <FieldWrapper label="Votre nom">
          <Input name="full_name" required />
        </FieldWrapper>
        <FieldWrapper label="Votre email">
          <Input name="email" type="email" required />
        </FieldWrapper>
        <FieldWrapper label="Ville">
          <Input name="city" />
        </FieldWrapper>
        {kind !== "city_waitlist" ? (
          <FieldWrapper label={practitionerLabel}>
            <Input name="practitioner_name" />
          </FieldWrapper>
        ) : null}
        <FieldWrapper label="Message">
          <Textarea name="message" />
        </FieldWrapper>
        <Button type="submit" size="lg" disabled={submitting}>
          {submitting ? "Envoi..." : "Envoyer"}
        </Button>
      </form>
    </Card>
  );
}
