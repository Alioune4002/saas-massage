"use client";

import { useEffect, useState } from "react";
import {
  BookOpenCheck,
  Check,
  Clock3,
  Mail,
  Phone,
  ShieldAlert,
  X,
} from "lucide-react";

import { BookingStatusBadge } from "@/components/agenda/agenda-status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Notice } from "@/components/ui/notice";
import { SectionHeading } from "@/components/ui/section-heading";
import { Skeleton } from "@/components/ui/skeleton";
import {
  getBookingPaymentTone,
  getPaymentStatusLabel,
} from "@/lib/payments";
import { emitBookingsUpdated } from "@/lib/practitioner-space";
import {
  cancelBooking,
  completeService,
  confirmBooking,
  getBookings,
  markClientNoShow,
  markClientArrived,
  markPractitionerNoShow,
  recordManualPayment,
  reportBookingIssue,
  startService,
  type Booking,
  type BookingStatus,
} from "@/lib/api";
import { formatCurrency, formatDateTimeLong } from "@/lib/utils";

export default function BookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [allBookings, setAllBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<BookingStatus | "all">("all");
  const [notice, setNotice] = useState("");

  async function load(status: BookingStatus | "all") {
    try {
      setLoading(true);
      const [filteredData, allData] = await Promise.all([
        getBookings(status),
        getBookings(),
      ]);
      setBookings(filteredData);
      setAllBookings(allData);
      setError("");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Impossible de charger les réservations."
      );
    } finally {
      setLoading(false);
    }
  }

  async function updateStatus(id: string, nextAction: "confirm" | "cancel") {
    try {
      setBusyId(id);
      setNotice("");
      setError("");
      const updatedBooking =
        nextAction === "confirm"
          ? await confirmBooking(id)
          : await cancelBooking(id);

      setBookings((current) =>
        current.map((booking) =>
          booking.id === id ? updatedBooking : booking
        )
      );
      setAllBookings((current) =>
        current.map((booking) =>
          booking.id === id ? updatedBooking : booking
        )
      );
      emitBookingsUpdated();
      setNotice(
        nextAction === "confirm"
          ? `La séance de ${updatedBooking.client_first_name} ${updatedBooking.client_last_name} est confirmée. Un message de confirmation est prêt pour le client.`
          : `La demande de ${updatedBooking.client_first_name} ${updatedBooking.client_last_name} est annulée. Un message d’information est prêt pour le client.`
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Impossible de mettre à jour la réservation."
      );
    } finally {
      setBusyId(null);
    }
  }

  async function updateLifecycle(
    id: string,
    nextAction:
      | "arrived"
      | "start"
      | "complete"
      | "cash"
      | "transfer"
      | "issue"
      | "client-no-show"
      | "practitioner-no-show"
  ) {
    try {
      setBusyId(id);
      setNotice("");
      setError("");
      const reason =
        nextAction === "issue" || nextAction === "client-no-show" || nextAction === "practitioner-no-show"
          ? window.prompt("Précisez brièvement la situation à enregistrer.") || ""
          : "";
      let updatedBooking: Booking;
      if (nextAction === "arrived") {
        updatedBooking = await markClientArrived(id);
      } else if (nextAction === "start") {
        updatedBooking = await startService(id);
      } else if (nextAction === "complete") {
        updatedBooking = await completeService(id);
      } else if (nextAction === "issue") {
        updatedBooking = await reportBookingIssue(id, reason);
      } else if (nextAction === "client-no-show") {
        updatedBooking = await markClientNoShow(id, reason);
      } else if (nextAction === "practitioner-no-show") {
        updatedBooking = await markPractitionerNoShow(id, reason);
      } else {
        updatedBooking = await recordManualPayment(
          id,
          nextAction === "cash" ? "cash" : "bank_transfer"
        );
      }

      setBookings((current) =>
        current.map((booking) =>
          booking.id === id ? updatedBooking : booking
        )
      );
      setAllBookings((current) =>
        current.map((booking) =>
          booking.id === id ? updatedBooking : booking
        )
      );
      const lifecycleMessage =
        nextAction === "arrived"
          ? "Le client est marqué comme arrivé."
          : nextAction === "start"
            ? "La prestation est marquée comme commencée."
            : nextAction === "complete"
              ? "La prestation est marquée comme terminée. La validation client peut maintenant être demandée."
              : nextAction === "issue"
                ? "Le signalement est enregistré. Le versement reste bloqué pendant la vérification."
                : nextAction === "client-no-show"
                  ? "L’absence du client est enregistrée pour vérification."
                  : nextAction === "practitioner-no-show"
                    ? "L’absence du praticien est enregistrée. Le suivi de règlement reste bloqué."
                    : "Le règlement sur place a bien été enregistré.";
      setNotice(lifecycleMessage);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Impossible de mettre à jour le suivi."
      );
    } finally {
      setBusyId(null);
    }
  }

  useEffect(() => {
    void load(activeFilter);
  }, [activeFilter]);

  const pendingCount = allBookings.filter((booking) => booking.status === "pending").length;
  const confirmedCount = allBookings.filter(
    (booking) => booking.status === "confirmed"
  ).length;
  const canceledCount = allBookings.filter((booking) => booking.status === "canceled").length;

  return (
    <div className="space-y-6">
      <SectionHeading
        eyebrow="Réservations"
        title="Réservations clients"
        description="Retrouve les demandes de rendez-vous, confirme rapidement les séances et garde une lecture rassurante de ton activité."
      />

      {error ? <Notice tone="error">{error}</Notice> : null}
      {notice ? <Notice tone="success">{notice}</Notice> : null}

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <p className="text-sm text-[var(--foreground-subtle)]">En attente</p>
          <p className="mt-4 text-3xl font-semibold text-[var(--foreground)]">{pendingCount}</p>
          <p className="mt-2 text-sm text-[var(--foreground-muted)]">
            Réservations à confirmer rapidement.
          </p>
        </Card>
        <Card>
          <p className="text-sm text-[var(--foreground-subtle)]">Confirmées</p>
          <p className="mt-4 text-3xl font-semibold text-[var(--foreground)]">{confirmedCount}</p>
          <p className="mt-2 text-sm text-[var(--foreground-muted)]">
            Dossiers sécurisés et prêts pour l’accueil.
          </p>
        </Card>
        <Card>
          <p className="text-sm text-[var(--foreground-subtle)]">Annulées</p>
          <p className="mt-4 text-3xl font-semibold text-[var(--foreground)]">{canceledCount}</p>
          <p className="mt-2 text-sm text-[var(--foreground-muted)]">
            Suivi d’historique et points de friction.
          </p>
        </Card>
      </div>

      {pendingCount > 0 ? (
        <Notice tone="info">
          {pendingCount} demande{pendingCount > 1 ? "s" : ""} attend
          {pendingCount > 1 ? "ent" : ""} encore votre retour. Une réponse
          rapide rassure vos clients et évite les rendez-vous perdus.
        </Notice>
      ) : null}

      <Card>
        <CardHeader
          title="Demandes de rendez-vous"
          subtitle="Filtre par statut et traite les demandes sans perdre le contexte."
          action={
            <div className="flex flex-wrap gap-2">
              {[
                ["all", "Toutes"],
                ["pending", "En attente"],
                ["confirmed", "Confirmées"],
                ["canceled", "Annulées"],
              ].map(([value, label]) => (
                <Button
                  key={value}
                  variant={activeFilter === value ? "primary" : "secondary"}
                  size="sm"
                  onClick={() => setActiveFilter(value as BookingStatus | "all")}
                >
                  {label}
                </Button>
              ))}
            </div>
          }
        />

        {loading ? (
          <div className="mt-6 space-y-4">
            {Array.from({ length: 3 }).map((_, index) => (
              <Skeleton key={index} className="h-48 rounded-[1.6rem]" />
            ))}
          </div>
        ) : bookings.length === 0 ? (
          <div className="mt-6">
            <EmptyState
              eyebrow="Aucune réservation"
              title="Aucune demande pour le moment"
              description="Les prochaines réservations apparaîtront ici avec une lecture claire, prête pour confirmer ou refuser en quelques gestes."
              icon={<BookOpenCheck className="h-5 w-5" />}
            />
          </div>
        ) : (
          <div className="mt-6 space-y-4">
            {bookings.map((booking) => {
              return (
                <div
                  key={booking.id}
                  className="rounded-[1.6rem] border border-[var(--border)] bg-[var(--surface-muted)] p-5"
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-xl font-semibold text-[var(--foreground)]">
                          {booking.client_first_name} {booking.client_last_name}
                        </h3>
                        <BookingStatusBadge status={booking.status} />
                        <Badge tone={getBookingPaymentTone(booking.payment_status)}>
                          {getPaymentStatusLabel(booking.payment_status)}
                        </Badge>
                      </div>
                      <p className="text-sm leading-6 text-[var(--foreground-muted)]">
                        {booking.service_title} · {formatDateTimeLong(booking.start_at)}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {booking.status === "pending" ? (
                        <>
                          <Button
                            size="sm"
                            iconLeft={<Check className="h-4 w-4" />}
                            disabled={busyId === booking.id}
                            onClick={() => updateStatus(booking.id, "confirm")}
                          >
                            Confirmer
                          </Button>
                          <Button
                            variant="danger"
                            size="sm"
                            iconLeft={<X className="h-4 w-4" />}
                            disabled={busyId === booking.id}
                            onClick={() => updateStatus(booking.id, "cancel")}
                          >
                            Annuler
                          </Button>
                        </>
                      ) : booking.status === "confirmed" ? (
                        <>
                          {booking.fulfillment_status === "scheduled" ? (
                            <Button
                              variant="secondary"
                              size="sm"
                              disabled={busyId === booking.id}
                              onClick={() => updateLifecycle(booking.id, "arrived")}
                            >
                              Client arrivé
                            </Button>
                          ) : null}
                          {booking.fulfillment_status === "client_arrived" ? (
                            <Button
                              variant="secondary"
                              size="sm"
                              disabled={busyId === booking.id}
                              onClick={() => updateLifecycle(booking.id, "start")}
                            >
                              Prestation commencée
                            </Button>
                          ) : null}
                          {booking.fulfillment_status === "in_progress" ? (
                            <Button
                              variant="secondary"
                              size="sm"
                              disabled={busyId === booking.id}
                              onClick={() => updateLifecycle(booking.id, "complete")}
                            >
                              Prestation terminée
                            </Button>
                          ) : null}
                          <Button
                            variant="secondary"
                            size="sm"
                            iconLeft={<X className="h-4 w-4" />}
                            disabled={busyId === booking.id}
                            onClick={() => updateStatus(booking.id, "cancel")}
                          >
                            Marquer annulée
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={busyId === booking.id}
                            onClick={() => updateLifecycle(booking.id, "issue")}
                          >
                            Signaler un problème
                          </Button>
                        </>
                      ) : null}
                    </div>
                  </div>

                  <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <div className="rounded-[1.2rem] border border-[var(--border)] bg-[var(--background-soft)] px-4 py-3 text-sm text-[var(--foreground-muted)]">
                      <div className="mb-2 flex items-center gap-2 text-[var(--foreground-subtle)]">
                        <Clock3 className="h-4 w-4" />
                        Horaire
                      </div>
                      <p className="font-medium text-[var(--foreground)]">
                        {formatDateTimeLong(booking.start_at)}
                      </p>
                    </div>
                    <div className="rounded-[1.2rem] border border-[var(--border)] bg-[var(--background-soft)] px-4 py-3 text-sm text-[var(--foreground-muted)]">
                      <div className="mb-2 flex items-center gap-2 text-[var(--foreground-subtle)]">
                        <Mail className="h-4 w-4" />
                        Email
                      </div>
                      <p className="font-medium text-[var(--foreground)]">{booking.client_email}</p>
                    </div>
                    <div className="rounded-[1.2rem] border border-[var(--border)] bg-[var(--background-soft)] px-4 py-3 text-sm text-[var(--foreground-muted)]">
                      <div className="mb-2 flex items-center gap-2 text-[var(--foreground-subtle)]">
                        <Phone className="h-4 w-4" />
                        Téléphone
                      </div>
                      <p className="font-medium text-[var(--foreground)]">
                        {booking.client_phone || "Non renseigné"}
                      </p>
                    </div>
                    <div className="rounded-[1.2rem] border border-[var(--border)] bg-[var(--background-soft)] px-4 py-3 text-sm text-[var(--foreground-muted)]">
                      <div className="mb-2 flex items-center gap-2 text-[var(--foreground-subtle)]">
                        <BookOpenCheck className="h-4 w-4" />
                        Note client
                      </div>
                      <p className="font-medium text-[var(--foreground)]">
                        {booking.client_note || "Aucune note"}
                      </p>
                    </div>
                    <div className="rounded-[1.2rem] border border-[var(--border)] bg-[var(--background-soft)] px-4 py-3 text-sm text-[var(--foreground-muted)] md:col-span-2 xl:col-span-4">
                      <div className="mb-2 flex items-center gap-2 text-[var(--foreground-subtle)]">
                        <BookOpenCheck className="h-4 w-4" />
                        Règlement
                      </div>
                      <p className="font-medium text-[var(--foreground)]">
                        {booking.payment_summary}
                      </p>
                      <p className="mt-2 text-sm text-[var(--foreground-muted)]">
                        {booking.payout_summary}
                      </p>
                      {booking.payment_message ? (
                        <p className="mt-2 text-sm leading-6 text-[var(--foreground-muted)]">
                          {booking.payment_message}
                        </p>
                      ) : null}
                      {booking.amount_remaining_eur !== "0.00" ? (
                        <div className="mt-3 flex flex-wrap gap-2">
                          <Button
                            variant="secondary"
                            size="sm"
                            disabled={busyId === booking.id}
                            onClick={() => updateLifecycle(booking.id, "cash")}
                          >
                            Enregistrer espèces · {formatCurrency(booking.amount_remaining_eur)}
                          </Button>
                          <Button
                            variant="secondary"
                            size="sm"
                            disabled={busyId === booking.id}
                            onClick={() => updateLifecycle(booking.id, "transfer")}
                          >
                            Enregistrer virement · {formatCurrency(booking.amount_remaining_eur)}
                          </Button>
                        </div>
                      ) : null}
                      {booking.payout_status === "payout_blocked" && booking.payout_summary ? (
                        <p className="mt-3 text-sm leading-6 text-[var(--warning)]">
                          {booking.payout_summary}
                        </p>
                      ) : null}
                    </div>
                    <div className="rounded-[1.2rem] border border-[var(--border)] bg-[var(--background-soft)] px-4 py-3 text-sm text-[var(--foreground-muted)] md:col-span-2 xl:col-span-4">
                      <div className="mb-2 flex items-center gap-2 text-[var(--foreground-subtle)]">
                        <BookOpenCheck className="h-4 w-4" />
                        Suivi de séance
                      </div>
                      <p className="font-medium text-[var(--foreground)]">
                        {booking.fulfillment_status === "scheduled"
                          ? "Séance planifiée"
                          : booking.fulfillment_status === "client_arrived"
                            ? "Client arrivé"
                            : booking.fulfillment_status === "in_progress"
                              ? "Prestation en cours"
                              : booking.fulfillment_status === "completed_by_practitioner"
                                ? "Terminée côté praticien, validation client en attente"
                                : booking.fulfillment_status === "completed_validated_by_client"
                                  ? "Prestations validée par le client"
                                  : booking.fulfillment_status === "auto_completed"
                                    ? "Validation automatique après délai"
                                    : "Signalement ou litige en cours"}
                      </p>
                      {booking.issue_reason ? (
                        <div className="mt-3 rounded-[1rem] border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3">
                          <div className="flex items-center gap-2 text-[var(--foreground)]">
                            <ShieldAlert className="h-4 w-4 text-[var(--warning)]" />
                            <p className="text-sm font-medium">Signalement enregistré</p>
                          </div>
                          <p className="mt-2 text-sm leading-6 text-[var(--foreground-muted)]">
                            {booking.issue_reason}
                          </p>
                        </div>
                      ) : null}
                      {booking.status === "confirmed" ? (
                        <div className="mt-3 flex flex-wrap gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={busyId === booking.id}
                            onClick={() => updateLifecycle(booking.id, "client-no-show")}
                          >
                            Client absent
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={busyId === booking.id}
                            onClick={() => updateLifecycle(booking.id, "practitioner-no-show")}
                          >
                            Praticien absent
                          </Button>
                        </div>
                      ) : null}
                      {booking.timeline.length > 0 ? (
                        <div className="mt-3 space-y-2">
                          {booking.timeline.slice(0, 4).map((item) => (
                            <p key={item.id} className="text-sm leading-6 text-[var(--foreground-muted)]">
                              {item.message}
                            </p>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
