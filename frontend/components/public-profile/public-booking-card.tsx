"use client";

import { CalendarClock, CheckCircle2 } from "lucide-react";

import { LegalLinks } from "@/components/legal/legal-links";
import { useBackendStatus } from "@/components/providers/backend-status-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FieldWrapper, Input, Textarea } from "@/components/ui/field";
import { Notice } from "@/components/ui/notice";
import type {
  CreatePublicBookingPayload,
  PublicBookingCreated,
  PublicAvailability,
  PublicBookingVerificationPending,
  PublicService,
} from "@/lib/api";
import { buildPublicPaymentPreview } from "@/lib/payments";
import { formatCurrency, formatDateTimeLong, formatTime } from "@/lib/utils";

type BookingForm = Omit<
  CreatePublicBookingPayload,
  "professional_slug" | "service_id" | "slot_id"
>;

type PublicBookingCardProps = {
  acceptsOnlineBooking: boolean;
  paymentUnavailableReason?: string;
  services: PublicService[];
  slots: PublicAvailability[];
  selectedServiceId: string;
  selectedSlotId: string;
  bookingForm: BookingForm;
  bookingError: string;
  bookingReceipt: PublicBookingCreated | null;
  verificationPending: PublicBookingVerificationPending | null;
  verificationCode: string;
  paymentPreview: ReturnType<typeof buildPublicPaymentPreview>;
  submitting: boolean;
  onSelectService: (serviceId: string) => void;
  onSelectSlot: (slotId: string) => void;
  onBookingFormChange: (field: keyof BookingForm, value: string | boolean) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onVerificationCodeChange: (value: string) => void;
  onSubmitVerification: () => void;
  onResendVerification: () => void;
};

export function PublicBookingCard({
  acceptsOnlineBooking,
  paymentUnavailableReason,
  services,
  slots,
  selectedServiceId,
  selectedSlotId,
  bookingForm,
  bookingError,
  bookingReceipt,
  verificationPending,
  verificationCode,
  paymentPreview,
  submitting,
  onSelectService,
  onSelectSlot,
  onBookingFormChange,
  onSubmit,
  onVerificationCodeChange,
  onSubmitVerification,
  onResendVerification,
}: PublicBookingCardProps) {
  const { backendUnavailable } = useBackendStatus();
  const selectedService =
    services.find((service) => service.id === selectedServiceId) ?? null;
  const selectedSlot =
    slots.find((slot) => slot.id === selectedSlotId) ?? null;
  const bookingDisabled =
    !acceptsOnlineBooking || Boolean(paymentUnavailableReason) || backendUnavailable;

  return (
    <Card className="rounded-[2rem]">
      <div className="flex items-center gap-3">
        <CalendarClock className="h-5 w-5 text-[var(--primary)]" />
        <div>
          <p className="text-xs uppercase tracking-[0.26em] text-[var(--primary)]/80">
            Réserver en ligne
          </p>
          <h2 className="mt-2 text-2xl font-semibold text-[var(--foreground)]">
            Choisir un rendez-vous
          </h2>
        </div>
      </div>

      {!acceptsOnlineBooking ? (
        <Notice tone="info" className="mt-5">
          Ce praticien garde sa page visible, mais la réservation en ligne n’est
          pas ouverte pour le moment.
        </Notice>
      ) : null}

      {paymentUnavailableReason ? (
        <Notice tone="info" className="mt-5">
          {paymentUnavailableReason}
        </Notice>
      ) : null}

      {backendUnavailable ? (
        <Notice tone="error" className="mt-5">
          Le service de réservation est momentanément indisponible. Vous pouvez
          consulter la page du praticien, mais l’envoi d’une demande nécessite
          le retour du backend.
        </Notice>
      ) : null}

      <div className="mt-6 space-y-5">
        <div>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-[var(--foreground)]">
                1. Choisir une prestation
              </p>
              <p className="mt-1 text-sm text-[var(--foreground-muted)]">
                Sélectionnez la séance qui correspond le mieux à votre besoin.
              </p>
            </div>
            <Badge tone="info">{services.length}</Badge>
          </div>

          <div className="mt-4 grid gap-3">
            {services.map((service) => (
              <button
                key={service.id}
                type="button"
                onClick={() => onSelectService(service.id)}
                className={
                  selectedServiceId === service.id
                    ? "rounded-[1.5rem] border border-[var(--primary)]/40 bg-[var(--surface-muted)] px-4 py-4 text-left shadow-[0_12px_30px_rgba(0,0,0,0.08)]"
                    : "rounded-[1.5rem] border border-[var(--border)] bg-[var(--background-soft)] px-4 py-4 text-left hover:border-[var(--border-strong)] hover:bg-[var(--surface-muted)]"
                }
                disabled={bookingDisabled}
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-base font-semibold text-[var(--foreground)]">
                      {service.title}
                    </p>
                    <p className="mt-2 text-sm leading-6 text-[var(--foreground-muted)]">
                      {service.short_description}
                    </p>
                  </div>
                  <div className="rounded-[1.1rem] border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2 text-right">
                    <p className="text-sm font-semibold text-[var(--foreground)]">
                      {formatCurrency(service.price_eur)}
                    </p>
                    <p className="mt-1 text-xs text-[var(--foreground-subtle)]">
                      {service.duration_minutes} min
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-[var(--foreground)]">
                2. Choisir un créneau
              </p>
              <p className="mt-1 text-sm text-[var(--foreground-muted)]">
                Les créneaux affichés sont réellement encore disponibles.
              </p>
            </div>
            <Badge tone="success">{slots.length}</Badge>
          </div>

          {slots.length === 0 ? (
            <div className="mt-4 rounded-[1.35rem] border border-dashed border-[var(--border)] bg-[var(--background-soft)] px-4 py-4 text-sm leading-6 text-[var(--foreground-muted)]">
              Aucun créneau ouvert pour cette prestation pour l’instant.
            </div>
          ) : (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {slots.slice(0, 10).map((slot) => (
                <button
                  key={slot.id}
                  type="button"
                  onClick={() => onSelectSlot(slot.id)}
                  className={
                    selectedSlotId === slot.id
                      ? "rounded-[1.35rem] border border-[var(--primary)]/42 bg-[var(--surface-muted)] px-4 py-4 text-left"
                      : "rounded-[1.35rem] border border-[var(--border)] bg-[var(--background-soft)] px-4 py-4 text-left hover:border-[var(--border-strong)]"
                  }
                  disabled={bookingDisabled}
                >
                  <p className="text-sm font-semibold text-[var(--foreground)]">
                    {formatDateTimeLong(slot.start_at)}
                  </p>
                  <p className="mt-2 text-xs uppercase tracking-[0.18em] text-[var(--foreground-subtle)]">
                    {formatTime(slot.start_at)} - {formatTime(slot.end_at)}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <p className="text-sm font-medium text-[var(--foreground)]">
              3. Vos informations
            </p>
            <p className="mt-1 text-sm text-[var(--foreground-muted)]">
              Le praticien vous répondra avec les informations utiles pour votre
              séance.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <FieldWrapper label="Prénom">
              <Input
                value={bookingForm.client_first_name}
                onChange={(event) =>
                  onBookingFormChange("client_first_name", event.target.value)
                }
                disabled={bookingDisabled}
                required
              />
            </FieldWrapper>
            <FieldWrapper label="Nom">
              <Input
                value={bookingForm.client_last_name}
                onChange={(event) =>
                  onBookingFormChange("client_last_name", event.target.value)
                }
                disabled={bookingDisabled}
                required
              />
            </FieldWrapper>
          </div>

          <FieldWrapper label="Email">
            <Input
              type="email"
              value={bookingForm.client_email}
              onChange={(event) =>
                onBookingFormChange("client_email", event.target.value)
              }
              disabled={bookingDisabled}
              required
            />
          </FieldWrapper>

          <FieldWrapper label="Téléphone" hint="Optionnel">
            <Input
              value={bookingForm.client_phone}
              onChange={(event) =>
                onBookingFormChange("client_phone", event.target.value)
              }
              disabled={bookingDisabled}
            />
          </FieldWrapper>

          <FieldWrapper label="Message pour le praticien" hint="Optionnel">
            <Textarea
              value={bookingForm.client_note}
              onChange={(event) =>
                onBookingFormChange("client_note", event.target.value)
              }
              disabled={bookingDisabled}
              placeholder="Indiquez ici votre besoin, une préférence ou une information utile."
            />
          </FieldWrapper>

          <div className="rounded-[1.35rem] border border-[var(--border)] bg-[var(--background-soft)] p-4">
            <p className="text-sm font-medium text-[var(--foreground)]">
              4. Consentements
            </p>
            <div className="mt-3 space-y-3 text-sm text-[var(--foreground-muted)]">
              <label className="flex items-start gap-3">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={bookingForm.accept_cgu}
                  onChange={(event) =>
                    onBookingFormChange("accept_cgu", event.target.checked)
                  }
                  disabled={bookingDisabled}
                />
                <span>J’accepte les conditions générales d’utilisation.</span>
              </label>
              <label className="flex items-start gap-3">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={bookingForm.accept_cgv}
                  onChange={(event) =>
                    onBookingFormChange("accept_cgv", event.target.checked)
                  }
                  disabled={bookingDisabled}
                />
                <span>J’accepte les conditions générales de vente.</span>
              </label>
              <label className="flex items-start gap-3">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={bookingForm.accept_cancellation_policy}
                  onChange={(event) =>
                    onBookingFormChange(
                      "accept_cancellation_policy",
                      event.target.checked
                    )
                  }
                  disabled={bookingDisabled}
                />
                <span>J’ai lu la politique d’annulation et de remboursement.</span>
              </label>
            </div>
          </div>

          {selectedService || selectedSlot ? (
            <div className="rounded-[1.4rem] border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-4">
              <div className="flex items-center gap-2 text-[var(--foreground)]">
                <CheckCircle2 className="h-4 w-4 text-[var(--primary)]" />
                <p className="text-sm font-medium">5. Récapitulatif</p>
              </div>
              <div className="mt-3 space-y-2 text-sm text-[var(--foreground-muted)]">
                {selectedService ? (
                  <p>
                    {selectedService.title} · {selectedService.duration_minutes} min
                    · {formatCurrency(selectedService.price_eur)}
                  </p>
                ) : (
                  <p>Choisissez une prestation.</p>
                )}
                {selectedSlot ? (
                  <p>{formatDateTimeLong(selectedSlot.start_at)}</p>
                ) : (
                  <p>Choisissez ensuite un créneau.</p>
                )}
                {selectedService ? (
                  <>
                    <p>Prix total · {formatCurrency(paymentPreview.total)}</p>
                    <p>
                      À régler maintenant · {formatCurrency(paymentPreview.dueNow)}
                    </p>
                    {paymentPreview.remaining > 0 ? (
                      <p>
                        Reste à régler sur place · {formatCurrency(paymentPreview.remaining)}
                      </p>
                    ) : null}
                    <p>{paymentPreview.cancellationSummary}</p>
                  </>
                ) : null}
              </div>
            </div>
          ) : null}

          {bookingError ? <Notice tone="error">{bookingError}</Notice> : null}
          {verificationPending ? (
            <Notice tone="info">
              <div className="space-y-3">
                <p className="font-medium">
                  Vérifiez votre email pour finaliser cette réservation
                </p>
                <p className="text-sm leading-6 opacity-90">
                  Un code a été envoyé à {verificationPending.masked_email}.
                  Tant que ce code n’est pas validé, aucun rendez-vous n’est créé.
                </p>
                <FieldWrapper label="Code de vérification">
                  <Input
                    value={verificationCode}
                    onChange={(event) =>
                      onVerificationCodeChange(event.target.value)
                    }
                    disabled={submitting}
                    placeholder="Entrez le code reçu"
                  />
                </FieldWrapper>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button
                    type="button"
                    onClick={onSubmitVerification}
                    disabled={submitting || verificationCode.trim().length < 4}
                  >
                    Vérifier mon email
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={onResendVerification}
                    disabled={submitting}
                  >
                    Renvoyer un code
                  </Button>
                </div>
              </div>
            </Notice>
          ) : null}
          {bookingReceipt ? (
            <Notice tone="success">
              <div className="space-y-2">
                <p className="font-medium">Votre demande a bien été transmise.</p>
                <p className="text-sm leading-6 opacity-90">
                  {bookingReceipt.service_title} · {formatDateTimeLong(bookingReceipt.start_at)}
                </p>
                <p className="text-sm leading-6 opacity-90">
                  Montant réglé maintenant · {formatCurrency(bookingReceipt.amount_received_eur)}
                </p>
                {Number(bookingReceipt.amount_remaining_eur) > 0 ? (
                  <p className="text-sm leading-6 opacity-90">
                    Reste à régler sur place · {formatCurrency(bookingReceipt.amount_remaining_eur)}
                  </p>
                ) : null}
                <p className="text-sm leading-6 opacity-90">
                  {bookingReceipt.cancellation_policy_summary}
                </p>
                <p className="text-sm leading-6 opacity-90">
                  Le praticien peut maintenant confirmer votre séance ou revenir
                  vers vous si un ajustement est nécessaire.
                </p>
              </div>
            </Notice>
          ) : null}

          {selectedService ? (
            <div className="rounded-[1.4rem] border border-[var(--border)] bg-[var(--background-soft)] px-4 py-4">
              <div className="flex items-center gap-2 text-[var(--foreground)]">
                <CheckCircle2 className="h-4 w-4 text-[var(--primary)]" />
                <p className="text-sm font-medium">6. Règlement à la réservation</p>
              </div>
              <div className="mt-3 space-y-2 text-sm leading-6 text-[var(--foreground-muted)]">
                <p className="font-medium">{paymentPreview.title}</p>
                <p>{paymentPreview.description}</p>
                <p>{paymentPreview.message}</p>
                <p>{paymentPreview.cancellationSummary}</p>
                {paymentPreview.dueNow > 0 ? (
                  <p>
                    Après validation, vous serez redirigé vers une étape de
                    règlement sécurisée. Le praticien ne voit ce montant comme
                    encaissé qu’après confirmation du prestataire de paiement.
                  </p>
                ) : null}
              </div>
            </div>
          ) : null}

          <Button
            type="submit"
            size="lg"
            className="w-full"
            disabled={bookingDisabled || submitting}
          >
            {submitting ? "Traitement..." : `7. ${paymentPreview.buttonLabel}`}
          </Button>

          <LegalLinks className="pt-2" />
        </form>
      </div>
    </Card>
  );
}
