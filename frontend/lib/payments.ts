import type {
  Booking,
  DashboardProfile,
  PublicProfessional,
  PublicService,
  PaymentStatus,
} from "@/lib/api";

type PaymentConfigLike = Pick<
  DashboardProfile | PublicProfessional,
  | "reservation_payment_mode"
  | "deposit_value_type"
  | "deposit_value"
  | "free_cancellation_notice_hours"
  | "keep_payment_after_deadline"
  | "payment_message"
>;

export function getPaymentStatusLabel(status: PaymentStatus) {
  switch (status) {
    case "payment_required":
      return "Paiement demandé";
    case "deposit_required":
      return "Acompte attendu";
    case "payment_pending":
      return "Paiement en attente";
    case "payment_authorized":
      return "Autorisation enregistrée";
    case "payment_captured":
      return "Règlement sécurisé";
    case "partially_refunded":
      return "Remboursement partiel";
    case "refunded":
      return "Remboursé";
    case "canceled":
      return "Annulé";
    default:
      return "Aucun paiement demandé";
  }
}

export function getBookingPaymentTone(status: PaymentStatus) {
  switch (status) {
    case "payment_required":
    case "deposit_required":
      return "warning" as const;
    case "payment_pending":
    case "payment_authorized":
      return "info" as const;
    case "payment_captured":
      return "success" as const;
    case "partially_refunded":
      return "warning" as const;
    case "refunded":
    case "canceled":
      return "neutral" as const;
    default:
      return "neutral" as const;
  }
}

export function buildPublicPaymentPreview(
  profile: PaymentConfigLike,
  service: PublicService | null
) {
  const fullRefundHours = 48;
  const partialRefundHours = 24;
  const total = Number(service?.price_eur ?? 0);
  const depositValue = Number(profile.deposit_value ?? 0);

  let dueNow = 0;
  if (profile.reservation_payment_mode === "full") {
    dueNow = total;
  } else if (profile.reservation_payment_mode === "deposit") {
    dueNow =
      profile.deposit_value_type === "percentage"
        ? (total * depositValue) / 100
        : depositValue;
  }

  dueNow = Math.max(0, Math.min(total, Math.round(dueNow * 100) / 100));
  const remaining = Math.max(0, Math.round((total - dueNow) * 100) / 100);

  let title = "Aucun paiement demandé à la réservation";
  let description = "Le règlement se fait directement avec le praticien.";
  let buttonLabel = "Envoyer ma demande de rendez-vous";

  if (profile.reservation_payment_mode === "deposit") {
    title = "Acompte demandé pour réserver ce créneau";
    description = "L’acompte est sécurisé sur la plateforme. Le reste éventuel se règle ensuite selon les conditions prévues.";
    buttonLabel = "Continuer vers le règlement de l’acompte";
  }

  if (profile.reservation_payment_mode === "full") {
    title = "Règlement complet demandé à la réservation";
    description = "Le règlement est sécurisé sur la plateforme avant la séance.";
    buttonLabel = "Continuer vers le règlement";
  }

  const cancellationSummary =
    profile.reservation_payment_mode === "none"
      ? "Annulation sans frais jusqu’à 48 h avant le rendez-vous. Entre 48 h et 24 h avant, un remboursement partiel peut s’appliquer si un acompte a été payé. Moins de 24 h avant ou en cas d’absence, l’acompte peut être conservé."
      : `Annulation sans frais jusqu’à ${fullRefundHours} h avant le rendez-vous. Entre ${fullRefundHours} h et ${partialRefundHours} h avant, 50 % de l’acompte peut être remboursé. Moins de ${partialRefundHours} h avant ou en cas d’absence, ${
          profile.reservation_payment_mode === "full"
            ? "le règlement peut être conservé selon les conditions prévues."
            : "l’acompte peut être conservé."
        }`;

  return {
    total,
    dueNow,
    remaining,
    title,
    description,
    buttonLabel,
    cancellationSummary,
    message:
      profile.payment_message ||
      (profile.reservation_payment_mode === "deposit"
        ? "Votre acompte permet de sécuriser votre créneau avant confirmation."
        : profile.reservation_payment_mode === "full"
          ? "Votre règlement est sécurisé sur la plateforme avant votre séance."
          : "Le règlement se fait directement avec le praticien."),
  };
}

export function getBookingPaymentBreakdown(booking: Booking) {
  if (booking.payment_status === "payment_captured") {
    return `${booking.amount_received_eur} € sécurisés · ${booking.amount_remaining_eur} € restants`;
  }
  if (booking.payment_status === "payment_authorized") {
    return "Autorisation enregistrée, capture en cours de confirmation";
  }
  if (booking.payment_status === "payment_pending") {
    return "Paiement en attente de confirmation par le prestataire";
  }
  return `${booking.amount_received_eur} € sécurisés · ${booking.amount_remaining_eur} € restants`;
}
