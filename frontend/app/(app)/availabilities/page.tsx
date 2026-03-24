"use client";

import { type FormEvent, useEffect, useMemo, useState } from "react";
import {
  Ban,
  CalendarDays,
  CalendarPlus2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Plus,
  Trash2,
} from "lucide-react";

import {
  AgendaStatusBadge,
  BookingStatusBadge,
} from "@/components/agenda/agenda-status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { FieldWrapper, Input, Select } from "@/components/ui/field";
import { Notice } from "@/components/ui/notice";
import { SectionHeading } from "@/components/ui/section-heading";
import { Skeleton } from "@/components/ui/skeleton";
import {
  createAvailability,
  deleteAvailability,
  getAgenda,
  getServices,
  type AgendaDay,
  type CreateAvailabilityPayload,
  type Service,
} from "@/lib/api";
import {
  formatDateTimeLong,
  formatDay,
  formatTime,
  toDateInputValue,
} from "@/lib/utils";

function toLocalDateTimeInputValue(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  const hours = `${date.getHours()}`.padStart(2, "0");
  const minutes = `${date.getMinutes()}`.padStart(2, "0");

  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function buildDefaultRange(targetDate: string) {
  const baseDate = new Date(`${targetDate}T09:00`);
  const endDate = new Date(baseDate);
  endDate.setMinutes(endDate.getMinutes() + 60);

  return {
    start_at: toLocalDateTimeInputValue(baseDate),
    end_at: toLocalDateTimeInputValue(endDate),
  };
}

export default function AvailabilitiesPage() {
  const [agenda, setAgenda] = useState<AgendaDay | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [selectedDate, setSelectedDate] = useState(() =>
    toDateInputValue(new Date())
  );
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [form, setForm] = useState<CreateAvailabilityPayload>({
    service: null,
    ...buildDefaultRange(toDateInputValue(new Date())),
    slot_type: "open",
    label: "",
    is_active: true,
  });

  async function load(date: string) {
    try {
      setLoading(true);
      const [agendaData, servicesData] = await Promise.all([
        getAgenda(date),
        getServices(),
      ]);
      setAgenda(agendaData);
      setServices(servicesData);
      setError("");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Impossible de charger l’agenda."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load(selectedDate);
  }, [selectedDate]);

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!form.start_at || !form.end_at) {
      setError("Choisissez une heure de début et de fin.");
      return;
    }

    try {
      setSubmitting(true);
      const payload: CreateAvailabilityPayload = {
        ...form,
        service: form.slot_type === "blocked" ? null : form.service,
      };
      await createAvailability(payload);
      setForm({
        service: null,
        ...buildDefaultRange(selectedDate),
        slot_type: "open",
        label: "",
        is_active: true,
      });
      setSuccess(
        form.slot_type === "blocked"
          ? "Plage bloquée ajoutée à l’agenda."
          : "Créneau réservable ajouté à l’agenda."
      );
      await load(selectedDate);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Création impossible.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      setDeletingId(id);
      setError("");
      setSuccess("");
      await deleteAvailability(id);
      setSuccess("Créneau retiré de l’agenda.");
      await load(selectedDate);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Suppression impossible."
      );
    } finally {
      setDeletingId(null);
    }
  }

  const selectedDateLabel = useMemo(
    () => formatDay(`${selectedDate}T12:00:00`),
    [selectedDate]
  );

  const openServices = services.filter((service) => service.is_active);

  return (
    <div className="space-y-6">
      <SectionHeading
        eyebrow="Agenda"
        title="Mes créneaux"
        description="Visualisez la journée, ouvrez vos disponibilités, bloquez une plage si besoin et gardez une lecture immédiate de vos rendez-vous."
        action={
          <Button
            size="lg"
            iconLeft={<Plus className="h-4 w-4" />}
            onClick={() =>
              document.getElementById("agenda-form")?.scrollIntoView({
                behavior: "smooth",
                block: "start",
              })
            }
          >
            Ajouter à l’agenda
          </Button>
        }
      />

      {error ? <Notice tone="error">{error}</Notice> : null}
      {success ? <Notice tone="success">{success}</Notice> : null}

      <Card className="rounded-[2rem]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-[var(--primary)]/80">
              Lecture du jour
            </p>
            <h2 className="mt-3 text-2xl font-semibold text-[var(--foreground)]">
              {selectedDateLabel}
            </h2>
            <p className="mt-2 text-sm text-[var(--foreground-muted)]">
              Une vue simple pour distinguer les créneaux libres, les demandes,
              les rendez-vous confirmés et les plages bloquées.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="md"
                className="h-11 w-11 rounded-2xl px-0"
                onClick={() => {
                  const current = new Date(`${selectedDate}T12:00:00`);
                  current.setDate(current.getDate() - 1);
                  setSelectedDate(toDateInputValue(current));
                }}
                aria-label="Jour précédent"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Input
                type="date"
                value={selectedDate}
                onChange={(event) => {
                  setSelectedDate(event.target.value);
                  setForm((current) => ({
                    ...current,
                    ...buildDefaultRange(event.target.value),
                  }));
                }}
                className="min-w-[12rem]"
              />
              <Button
                variant="secondary"
                size="md"
                className="h-11 w-11 rounded-2xl px-0"
                onClick={() => {
                  const current = new Date(`${selectedDate}T12:00:00`);
                  current.setDate(current.getDate() + 1);
                  setSelectedDate(toDateInputValue(current));
                }}
                aria-label="Jour suivant"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            <Button
              variant="ghost"
              size="md"
              onClick={() => setSelectedDate(toDateInputValue(new Date()))}
            >
              Aujourd’hui
            </Button>
          </div>
        </div>
      </Card>

      {loading || !agenda ? (
        <div className="space-y-4">
          <Skeleton className="h-36 rounded-[1.8rem]" />
          <Skeleton className="h-[32rem] rounded-[2rem]" />
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Card>
              <p className="text-sm text-[var(--foreground-subtle)]">
                Créneaux libres
              </p>
              <p className="mt-4 text-3xl font-semibold text-[var(--foreground)]">
                {agenda.overview.free_slots}
              </p>
              <p className="mt-2 text-sm text-[var(--foreground-muted)]">
                Disponibles à la réservation sur cette journée.
              </p>
            </Card>
            <Card>
              <p className="text-sm text-[var(--foreground-subtle)]">
                Demandes en attente
              </p>
              <p className="mt-4 text-3xl font-semibold text-[var(--foreground)]">
                {agenda.overview.pending_bookings}
              </p>
              <p className="mt-2 text-sm text-[var(--foreground-muted)]">
                À confirmer pour sécuriser l’accueil.
              </p>
            </Card>
            <Card>
              <p className="text-sm text-[var(--foreground-subtle)]">
                Rendez-vous confirmés
              </p>
              <p className="mt-4 text-3xl font-semibold text-[var(--foreground)]">
                {agenda.overview.confirmed_bookings}
              </p>
              <p className="mt-2 text-sm text-[var(--foreground-muted)]">
                Séances déjà planifiées sur cette journée.
              </p>
            </Card>
            <Card>
              <p className="text-sm text-[var(--foreground-subtle)]">
                Plages bloquées
              </p>
              <p className="mt-4 text-3xl font-semibold text-[var(--foreground)]">
                {agenda.overview.blocked_slots}
              </p>
              <p className="mt-2 text-sm text-[var(--foreground-muted)]">
                Pauses, déplacements ou indisponibilités.
              </p>
            </Card>
          </div>

          <div className="grid gap-4 xl:grid-cols-[1.06fr_0.94fr]">
            <Card id="agenda-form" className="rounded-[2rem]">
              <CardHeader
                title="Ajouter un créneau ou bloquer une plage"
                subtitle="Préparez votre journée sans ambiguïté. Un créneau libre pourra être réservé. Une plage bloquée restera indisponible."
              />

              <form onSubmit={handleCreate} className="mt-6 grid gap-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <FieldWrapper label="Type d’entrée">
                    <Select
                      value={form.slot_type ?? "open"}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          slot_type: event.target.value as "open" | "blocked",
                          service:
                            event.target.value === "blocked" ? null : current.service,
                        }))
                      }
                    >
                      <option value="open">Créneau réservable</option>
                      <option value="blocked">Plage bloquée</option>
                    </Select>
                  </FieldWrapper>

                  {form.slot_type === "blocked" ? (
                    <FieldWrapper label="Libellé" hint="Optionnel">
                      <Input
                        value={form.label ?? ""}
                        placeholder="Pause, déplacement, fermeture..."
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            label: event.target.value,
                          }))
                        }
                      />
                    </FieldWrapper>
                  ) : (
                    <FieldWrapper label="Prestation liée">
                      <Select
                        value={form.service ?? ""}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            service: event.target.value || null,
                          }))
                        }
                      >
                        <option value="">Toutes mes prestations</option>
                        {openServices.map((service) => (
                          <option key={service.id} value={service.id}>
                            {service.title}
                          </option>
                        ))}
                      </Select>
                    </FieldWrapper>
                  )}
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <FieldWrapper label="Début">
                    <Input
                      type="datetime-local"
                      value={form.start_at}
                      onChange={(event) =>
                        setForm((current) => {
                          const nextStart = event.target.value;
                          if (!nextStart) {
                            return { ...current, start_at: "" };
                          }
                          if (current.end_at) {
                            return { ...current, start_at: nextStart };
                          }
                          const endDate = new Date(nextStart);
                          endDate.setMinutes(endDate.getMinutes() + 60);
                          return {
                            ...current,
                            start_at: nextStart,
                            end_at: toLocalDateTimeInputValue(endDate),
                          };
                        })
                      }
                    />
                  </FieldWrapper>
                  <FieldWrapper label="Fin">
                    <Input
                      type="datetime-local"
                      value={form.end_at}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          end_at: event.target.value,
                        }))
                      }
                    />
                  </FieldWrapper>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm leading-6 text-[var(--foreground-muted)]">
                    La logique métier bloque automatiquement les chevauchements et
                    empêche une double réservation d’un même créneau.
                  </p>
                  <Button
                    type="submit"
                    size="lg"
                    iconLeft={
                      form.slot_type === "blocked" ? (
                        <Ban className="h-4 w-4" />
                      ) : (
                        <CalendarPlus2 className="h-4 w-4" />
                      )
                    }
                    disabled={submitting}
                  >
                    {submitting
                      ? "Enregistrement..."
                      : form.slot_type === "blocked"
                        ? "Bloquer cette plage"
                        : "Publier ce créneau"}
                  </Button>
                </div>
              </form>
            </Card>

            <Card className="rounded-[2rem]">
              <CardHeader
                title="Prochains rendez-vous"
                subtitle="Une vue rapide des prochaines demandes et séances confirmées."
              />

              {agenda.upcoming_bookings.length === 0 ? (
                <div className="mt-6">
                  <EmptyState
                    eyebrow="Aucun rendez-vous"
                    title="Rien à venir pour le moment"
                    description="Les prochaines demandes et confirmations apparaîtront ici dès qu’un client réservera."
                    icon={<CalendarDays className="h-5 w-5" />}
                  />
                </div>
              ) : (
                <div className="mt-6 space-y-3">
                  {agenda.upcoming_bookings.map((booking) => (
                    <div
                      key={booking.id}
                      className="rounded-[1.45rem] border border-[var(--border)] bg-[var(--background-soft)] px-4 py-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-[var(--foreground)]">
                            {booking.client_name}
                          </p>
                          <p className="mt-1 text-sm text-[var(--foreground-muted)]">
                            {booking.service_title}
                          </p>
                        </div>
                        <BookingStatusBadge status={booking.status} />
                      </div>
                      <p className="mt-3 text-sm text-[var(--foreground-subtle)]">
                        {formatDateTimeLong(booking.start_at)}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-5 rounded-[1.45rem] border border-[var(--border)] bg-[var(--surface-muted)] p-4">
                <p className="text-sm font-medium text-[var(--foreground)]">
                  Annulations récentes
                </p>
                {agenda.recent_cancellations.length === 0 ? (
                  <p className="mt-2 text-sm text-[var(--foreground-muted)]">
                    Aucune annulation récente.
                  </p>
                ) : (
                  <div className="mt-3 space-y-3">
                    {agenda.recent_cancellations.map((booking) => (
                      <div key={booking.id} className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-[var(--foreground)]">
                            {booking.client_name}
                          </p>
                          <p className="truncate text-sm text-[var(--foreground-muted)]">
                            {booking.service_title}
                          </p>
                        </div>
                        <p className="text-xs text-[var(--foreground-subtle)]">
                          {formatTime(booking.start_at)}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </Card>
          </div>

          <Card className="rounded-[2rem]">
            <CardHeader
              title="Planning du jour"
              subtitle="Chaque ligne reflète l’état réel du créneau: libre, demandé, confirmé ou bloqué."
            />

            {agenda.timeline.length === 0 ? (
              <div className="mt-6">
                <EmptyState
                  eyebrow="Journée vide"
                  title="Aucun créneau sur cette date"
                  description="Ajoutez quelques disponibilités ou bloquez vos plages d’indisponibilité pour garder un agenda clair."
                  actionLabel="Ajouter à l’agenda"
                  onAction={() =>
                    document.getElementById("agenda-form")?.scrollIntoView({
                      behavior: "smooth",
                      block: "start",
                    })
                  }
                  icon={<Clock3 className="h-5 w-5" />}
                />
              </div>
            ) : (
              <div className="mt-6 space-y-3">
                {agenda.timeline.map((item) => {
                  const canDelete =
                    item.agenda_state === "free" || item.agenda_state === "blocked";

                  return (
                    <div
                      key={item.id}
                      className="rounded-[1.55rem] border border-[var(--border)] bg-[var(--background-soft)] px-4 py-4"
                    >
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <AgendaStatusBadge state={item.agenda_state} />
                            <p className="text-sm font-semibold text-[var(--foreground)]">
                              {formatTime(item.start_at)} - {formatTime(item.end_at)}
                            </p>
                          </div>

                          <p className="mt-3 text-base font-semibold text-[var(--foreground)]">
                            {item.agenda_state === "blocked"
                              ? item.label || "Plage indisponible"
                              : item.booking?.client_name || item.service_title || "Créneau ouvert à plusieurs prestations"}
                          </p>
                          <p className="mt-2 text-sm leading-6 text-[var(--foreground-muted)]">
                            {item.agenda_state === "blocked"
                              ? "Cette plage est bloquée et ne peut pas être réservée."
                              : item.booking
                                ? `${item.booking.service_title} · ${formatDateTimeLong(item.booking.start_at)}`
                                : item.service_title || "Réservable sur les prestations compatibles."}
                          </p>
                        </div>

                        <div className="flex items-center gap-2">
                          {canDelete ? (
                            <Button
                              variant="secondary"
                              size="sm"
                              iconLeft={<Trash2 className="h-4 w-4" />}
                              disabled={deletingId === item.id}
                              onClick={() => handleDelete(item.id)}
                            >
                              Retirer
                            </Button>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
