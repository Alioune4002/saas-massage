import type {
  AssistantProfile,
  Availability,
  Booking,
  DashboardProfile,
  Service,
} from "@/lib/api";

export type SpaceChecklistItem = {
  key: string;
  label: string;
  description: string;
  href: string;
  ctaLabel: string;
  completed: boolean;
};

const WELCOME_NOTICE_KEY = "nuadyx_practitioner_welcome_notice";
export const BOOKINGS_UPDATED_EVENT = "nuadyx-bookings-updated";

export function rememberWelcomeNotice(message: string) {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(WELCOME_NOTICE_KEY, message);
}

export function consumeWelcomeNotice() {
  if (typeof window === "undefined") return "";
  const value = window.sessionStorage.getItem(WELCOME_NOTICE_KEY) ?? "";
  if (value) {
    window.sessionStorage.removeItem(WELCOME_NOTICE_KEY);
  }
  return value;
}

export function emitBookingsUpdated() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(BOOKINGS_UPDATED_EVENT));
}

export function buildSpaceChecklist(params: {
  profile: DashboardProfile | null;
  assistant: AssistantProfile | null;
  services: Service[];
  slots: Availability[];
  bookings: Booking[];
  hasReviewInvitation?: boolean;
}): SpaceChecklistItem[] {
  const { profile, assistant, services, slots, bookings, hasReviewInvitation = false } = params;
  const now = new Date();

  const activeServices = services.filter((service) => service.is_active);
  const futureOpenSlots = slots.filter(
    (slot) =>
      slot.is_active &&
      slot.slot_type === "open" &&
      new Date(slot.start_at).getTime() > now.getTime()
  );
  const hasCadreAccueil = Boolean(
    profile?.public_headline?.trim() ||
      profile?.bio?.trim() ||
      profile?.venue_details?.trim() ||
      profile?.access_details?.trim() ||
      profile?.ambience_details?.trim() ||
      profile?.service_area?.trim() ||
      profile?.equipment_provided?.trim() ||
      profile?.client_preparation?.trim() ||
      profile?.ideal_for?.trim() ||
      assistant?.practice_information?.trim() ||
      assistant?.before_session?.trim() ||
      assistant?.after_session?.trim() ||
      assistant?.booking_policy?.trim()
  );
  const hasVisibleProfile = Boolean(profile?.is_public && profile?.slug);
  const canBookOnline = Boolean(profile?.accepts_online_booking);
  const hasPublicView = Boolean(profile?.slug);
  const hasPendingDemand = bookings.some((booking) => booking.status === "pending");
  const hasPaymentAccount = Boolean(profile?.payment_account?.onboarding_status === "active");
  const hasPaymentPolicy = Boolean(
    profile &&
      (
        profile.reservation_payment_mode !== "none" ||
        profile.payment_message.trim() ||
        profile.free_cancellation_notice_hours > 0
      )
  );

  return [
    {
      key: "payment-account",
      label: "Connecter mon compte de paiement",
      description: "Préparez l’encaissement en ligne et les futurs versements praticien.",
      href: "/payments",
      ctaLabel: hasPaymentAccount ? "Voir mes règlements" : "Connecter mon compte",
      completed: hasPaymentAccount,
    },
    {
      key: "payment-policy",
      label: "Définir ma politique d’acompte",
      description: "Choisissez si vous demandez un acompte, un règlement complet ou un paiement sur place.",
      href: "/profil-public",
      ctaLabel: hasPaymentPolicy ? "Ajuster mes conditions" : "Définir mes conditions",
      completed: hasPaymentPolicy,
    },
    {
      key: "services",
      label: "Présenter au moins un soin",
      description: "Ajoutez une première prestation claire avec durée et tarif.",
      href: "/services",
      ctaLabel: activeServices.length > 0 ? "Voir mes prestations" : "Ajouter un soin",
      completed: activeServices.length > 0,
    },
    {
      key: "slots",
      label: "Ouvrir un premier créneau",
      description: "Publiez au moins une disponibilité future pour recevoir des demandes.",
      href: "/availabilities",
      ctaLabel: futureOpenSlots.length > 0 ? "Voir mon agenda" : "Ouvrir un créneau",
      completed: futureOpenSlots.length > 0,
    },
    {
      key: "setting",
      label: "Rassurer sur le cadre d’accueil",
      description: "Expliquez le déroulé, les informations utiles et vos conditions de réservation.",
      href: "/assistant",
      ctaLabel: hasCadreAccueil ? "Compléter mon accompagnement" : "Décrire mon cadre d’accueil",
      completed: hasCadreAccueil,
    },
    {
      key: "online-booking",
      label: "Rendre la réservation disponible",
      description: "Activez la prise de rendez-vous pour laisser vos clients réserver plus facilement.",
      href: "/profil-public",
      ctaLabel: canBookOnline ? "Vérifier mon profil public" : "Activer la réservation",
      completed: canBookOnline,
    },
    {
      key: "public-profile",
      label: "Vérifier ma page en tant que client",
      description: hasPendingDemand
        ? "Votre page travaille déjà pour vous. Vérifiez-la comme un client."
        : "Activez votre page publique pour être découvert et recevoir vos premières demandes.",
      href: "/profil-public",
      ctaLabel: hasPublicView
        ? "Voir mon profil en tant que client"
        : "Préparer ma page publique",
      completed: hasVisibleProfile,
    },
    {
      key: "reviews",
      label: "Inviter au moins un client à laisser un avis",
      description: "Les premiers avis rassurent et donnent confiance avant la prise de rendez-vous.",
      href: "/reviews",
      ctaLabel: hasReviewInvitation ? "Voir mes invitations" : "Préparer mes invitations",
      completed: hasReviewInvitation,
    },
  ];
}
