"use client";

import { useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FieldWrapper, Input } from "@/components/ui/field";
import { Notice } from "@/components/ui/notice";
import { SectionHeading } from "@/components/ui/section-heading";
import { Skeleton } from "@/components/ui/skeleton";
import {
  getDashboardContacts,
  updateDashboardContact,
  type PractitionerContact,
} from "@/lib/api";
import { formatDateTimeLong } from "@/lib/utils";

const segmentOptions: Array<{ value: PractitionerContact["segment"] | "all"; label: string }> = [
  { value: "all", label: "Tous" },
  { value: "new", label: "Nouveaux" },
  { value: "active", label: "Actifs" },
  { value: "loyal", label: "Fidèles" },
  { value: "never_seen", label: "Jamais vus" },
  { value: "canceled", label: "Annulés" },
  { value: "no_show", label: "No-show" },
  { value: "watch", label: "À surveiller" },
  { value: "dispute", label: "Avec litige" },
];

export default function ContactsPage() {
  const [contacts, setContacts] = useState<PractitionerContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [segment, setSegment] = useState<PractitionerContact["segment"] | "all">("all");
  const [query, setQuery] = useState("");
  const [selectedContactId, setSelectedContactId] = useState("");
  const [privateNote, setPrivateNote] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        setLoading(true);
        const data = await getDashboardContacts({
          segment: segment === "all" ? undefined : segment,
          q: query || undefined,
        });
        if (!active) {
          return;
        }
        setContacts(data);
        setSelectedContactId((current) => current || data[0]?.id || "");
        setError("");
      } catch (err) {
        if (!active) {
          return;
        }
        setError(err instanceof Error ? err.message : "Impossible de charger les contacts.");
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
  }, [query, segment]);

  const selectedContact = useMemo(
    () => contacts.find((item) => item.id === selectedContactId) ?? null,
    [contacts, selectedContactId]
  );

  useEffect(() => {
    setPrivateNote(selectedContact?.private_note || "");
    setTagInput(selectedContact?.tags.map((tag) => tag.label).join(", ") || "");
  }, [selectedContact]);

  async function handleSave() {
    if (!selectedContact) {
      return;
    }
    try {
      setBusy(true);
      const updated = await updateDashboardContact(selectedContact.id, {
        private_note: privateNote,
        tag_labels: tagInput
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
      });
      setContacts((current) =>
        current.map((item) => (item.id === updated.id ? updated : item))
      );
      setNotice("Fiche contact mise à jour.");
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible d’enregistrer cette fiche.");
    } finally {
      setBusy(false);
    }
  }

  const stats = useMemo(() => {
    return {
      total: contacts.length,
      loyal: contacts.filter((item) => item.segment === "loyal").length,
      watch: contacts.filter((item) => ["watch", "blocked", "dispute"].includes(item.segment)).length,
      validated: contacts.reduce((acc, item) => acc + item.validated_booking_count, 0),
    };
  }, [contacts]);

  return (
    <div className="space-y-6">
      <SectionHeading
        eyebrow="Contacts"
        title="Clients et contacts"
        description="Retrouve tes contacts issus des réservations, repère les clients fidèles et garde des notes privées utiles sans quitter ton espace."
      />

      {error ? <Notice tone="error">{error}</Notice> : null}
      {notice ? <Notice tone="success">{notice}</Notice> : null}

      <div className="grid gap-4 md:grid-cols-4">
        {[
          ["Contacts suivis", String(stats.total)],
          ["Clients fidèles", String(stats.loyal)],
          ["À surveiller", String(stats.watch)],
          ["Prestations validées", String(stats.validated)],
        ].map(([label, value]) => (
          <Card key={label}>
            <p className="text-sm text-[var(--foreground-subtle)]">{label}</p>
            <p className="mt-4 text-3xl font-semibold text-[var(--foreground)]">{value}</p>
          </Card>
        ))}
      </div>

      <Card>
        <div className="grid gap-4 lg:grid-cols-[0.7fr_0.3fr]">
          <FieldWrapper label="Rechercher un contact">
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Nom, email ou téléphone"
            />
          </FieldWrapper>
          <FieldWrapper label="Segment">
            <select
              value={segment}
              onChange={(event) => setSegment(event.target.value as PractitionerContact["segment"] | "all")}
              className="w-full rounded-[1.15rem] border border-[var(--border)] bg-[var(--background-soft)] px-4 py-3 text-sm text-[var(--foreground)]"
            >
              {segmentOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </FieldWrapper>
        </div>
      </Card>

      {loading ? (
        <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
          <Skeleton className="h-[420px] rounded-[1.8rem]" />
          <Skeleton className="h-[420px] rounded-[1.8rem]" />
        </div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
          <Card className="rounded-[1.8rem] p-4">
            <div className="space-y-3">
              {contacts.map((contact) => (
                <button
                  key={contact.id}
                  type="button"
                  onClick={() => setSelectedContactId(contact.id)}
                  className={`w-full rounded-[1.4rem] border px-4 py-4 text-left ${
                    selectedContactId === contact.id
                      ? "border-[var(--primary)] bg-[var(--background-soft)]"
                      : "border-[var(--border)] bg-[var(--surface)]"
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-medium text-[var(--foreground)]">{contact.display_name}</p>
                      <p className="text-sm text-[var(--foreground-muted)]">{contact.email}</p>
                    </div>
                    <Badge tone={contact.segment === "loyal" ? "success" : contact.segment === "watch" || contact.segment === "dispute" ? "warning" : "info"}>
                      {contact.segment_label}
                    </Badge>
                  </div>
                  <p className="mt-3 text-xs text-[var(--foreground-subtle)]">
                    {contact.booking_count} réservation(s) · {contact.validated_booking_count} prestation(s) validée(s)
                  </p>
                </button>
              ))}
            </div>
          </Card>

          <Card className="rounded-[1.8rem] p-6">
            {selectedContact ? (
              <>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.26em] text-[var(--primary)]/80">
                      Fiche contact
                    </p>
                    <h2 className="mt-3 text-2xl font-semibold text-[var(--foreground)]">
                      {selectedContact.display_name}
                    </h2>
                  </div>
                  <Badge tone={selectedContact.is_trusted ? "success" : "info"}>
                    {selectedContact.is_trusted ? "Client de confiance" : selectedContact.risk_label}
                  </Badge>
                </div>

                <div className="mt-6 grid gap-4 md:grid-cols-2">
                  <div className="rounded-[1.4rem] border border-[var(--border)] bg-[var(--background-soft)] px-4 py-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-[var(--foreground-subtle)]">
                      Dernière réservation
                    </p>
                    <p className="mt-2 text-sm text-[var(--foreground)]">
                      {selectedContact.last_booking_at
                        ? formatDateTimeLong(selectedContact.last_booking_at)
                        : "Aucune"}
                    </p>
                  </div>
                  <div className="rounded-[1.4rem] border border-[var(--border)] bg-[var(--background-soft)] px-4 py-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-[var(--foreground-subtle)]">
                      Raisons du segment
                    </p>
                    <p className="mt-2 text-sm text-[var(--foreground)]">
                      {selectedContact.segment_reasons_json.join(" · ") || "Aucune"}
                    </p>
                  </div>
                </div>

                <div className="mt-6 space-y-4">
                  <FieldWrapper label="Note privée">
                    <textarea
                      value={privateNote}
                      onChange={(event) => setPrivateNote(event.target.value)}
                      className="min-h-[150px] w-full rounded-[1.15rem] border border-[var(--border)] bg-[var(--background-soft)] px-4 py-3 text-sm text-[var(--foreground)]"
                      placeholder="Informations utiles pour le suivi de ce client."
                    />
                  </FieldWrapper>
                  <FieldWrapper label="Tags internes">
                    <Input
                      value={tagInput}
                      onChange={(event) => setTagInput(event.target.value)}
                      placeholder="fidèle, drainage, pause midi"
                    />
                  </FieldWrapper>
                  <Button onClick={() => void handleSave()} disabled={busy}>
                    {busy ? "Enregistrement..." : "Enregistrer la fiche contact"}
                  </Button>
                </div>
              </>
            ) : (
              <p className="text-sm text-[var(--foreground-muted)]">
                Sélectionnez un contact pour voir son détail.
              </p>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
