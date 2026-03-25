import type {
  DashboardProfile,
  PublicProfessional,
  PublicService,
} from "@/lib/api";

export type PublicProfileThemeKey = "epure" | "chaleur" | "prestige";

export type PublicProfileDraft = {
  slug: string;
  displayName: string;
  activityType: DashboardProfile["activity_type"];
  practiceMode: DashboardProfile["practice_mode"];
  city: string;
  serviceArea: string;
  venueDetails: string;
  accessDetails: string;
  ambienceDetails: string;
  equipmentProvided: string;
  clientPreparation: string;
  idealFor: string;
  highlightPoints: string[];
  bio: string;
  headline: string;
  specialties: string[];
  themeKey: PublicProfileThemeKey;
  phone: string;
  publicEmail: string;
  websiteUrl: string;
  instagramUrl: string;
  facebookUrl: string;
  tiktokUrl: string;
  isPublic: boolean;
  acceptsOnlineBooking: boolean;
  reservationPaymentMode: DashboardProfile["reservation_payment_mode"];
  depositValueType: DashboardProfile["deposit_value_type"];
  depositValue: string;
  freeCancellationNoticeHours: number;
  keepPaymentAfterDeadline: boolean;
  paymentMessage: string;
  profileImageUrl: string;
  coverImageUrl: string;
  profileImageHint: string;
  coverImageHint: string;
  practiceInformation: string;
  beforeSession: string;
  afterSession: string;
  bookingPolicy: string;
  contactInformation: string;
  faqItems: Array<{ question: string; answer: string }>;
};

export type PublicProfileTheme = {
  key: PublicProfileThemeKey;
  label: string;
  description: string;
  heroGradient: string;
  accentBadgeClassName: string;
  spotlightClassName: string;
};

type PracticeInfoCard = {
  title: string;
  description: string;
};

const activityTypeLabels: Record<DashboardProfile["activity_type"], string> = {
  solo: "Praticien solo",
  studio: "Cabinet / studio",
  spa: "Spa / institut",
  team: "Équipe de praticiens",
};

const practiceModeLabels: Record<DashboardProfile["practice_mode"], string> = {
  studio: "En cabinet / studio",
  home: "À domicile",
  mobile: "En déplacement / itinérant",
  corporate: "En entreprise / en événementiel",
  mixed: "Mixte",
};

export const publicProfileThemes: PublicProfileTheme[] = [
  {
    key: "epure",
    label: "Épure",
    description: "Clair, précis, apaisant. Idéal pour une présence simple et raffinée.",
    heroGradient:
      "bg-[radial-gradient(circle_at_top_left,rgba(124,156,255,0.24),transparent_28%),linear-gradient(135deg,rgba(12,21,38,0.88),rgba(20,34,56,0.52))]",
    accentBadgeClassName:
      "border-[color:var(--hero-card-border)] bg-[color:var(--hero-card-surface)] text-[var(--inverse-foreground)]",
    spotlightClassName:
      "from-[rgba(124,156,255,0.18)] to-[rgba(143,242,203,0.12)]",
  },
  {
    key: "chaleur",
    label: "Chaleur",
    description: "Plus enveloppant, chaleureux et humain pour un univers bien-être.",
    heroGradient:
      "bg-[radial-gradient(circle_at_top_left,rgba(255,203,116,0.24),transparent_24%),linear-gradient(135deg,rgba(73,39,22,0.88),rgba(137,86,48,0.54))]",
    accentBadgeClassName:
      "border-[var(--hero-card-border)] bg-[rgba(255,203,116,0.18)] text-[var(--inverse-foreground)]",
    spotlightClassName:
      "from-[rgba(255,203,116,0.2)] to-[rgba(249,154,94,0.12)]",
  },
  {
    key: "prestige",
    label: "Prestige",
    description: "Plus couture, plus institutionnel, pour une image haut de gamme assumée.",
    heroGradient:
      "bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.12),transparent_24%),linear-gradient(135deg,rgba(24,28,39,0.92),rgba(55,48,71,0.62))]",
    accentBadgeClassName:
      "border-[var(--hero-card-border)] bg-[rgba(244,114,182,0.18)] text-[var(--inverse-foreground)]",
    spotlightClassName:
      "from-[rgba(244,114,182,0.18)] to-[rgba(192,132,252,0.12)]",
  },
];

function normalizeSpecialties(services: PublicService[]) {
  const titles = services
    .map((service) => service.title.trim())
    .filter(Boolean)
    .slice(0, 3);

  if (titles.length > 0) {
    return titles;
  }

  return ["Massage bien-être", "Relaxation profonde", "Accompagnement sur mesure"];
}

function normalizeHighlightPoints(
  profile: DashboardProfile | PublicProfessional,
  services: PublicService[]
) {
  const explicitPoints = profile.highlight_points?.filter(Boolean) ?? [];
  if (explicitPoints.length > 0) {
    return explicitPoints.slice(0, 3);
  }

  const derivedPoints = [
    profile.public_headline?.trim(),
    profile.service_area?.trim(),
    services[0]
      ? `${services[0].title} · ${services[0].duration_minutes} min`
      : "",
  ].filter(Boolean) as string[];

  if (derivedPoints.length > 0) {
    return derivedPoints.slice(0, 3);
  }

  return [
    "Réservation simple et claire",
    "Cadre d’accueil expliqué",
    "Accompagnement adapté au besoin du moment",
  ];
}

export function createDefaultPublicProfileDraft(
  profile: DashboardProfile | PublicProfessional,
  services: PublicService[]
): PublicProfileDraft {
  return {
    slug: profile.slug,
    displayName: profile.business_name,
    activityType: profile.activity_type,
    practiceMode: profile.practice_mode,
    city: profile.city || "Ville à préciser",
    serviceArea: profile.service_area || "",
    venueDetails: profile.venue_details || "",
    accessDetails: profile.access_details || "",
    ambienceDetails: profile.ambience_details || "",
    equipmentProvided: profile.equipment_provided || "",
    clientPreparation: profile.client_preparation || "",
    idealFor:
      profile.ideal_for ||
      "Je reçois les personnes qui cherchent un temps d’apaisement, de récupération ou un soin adapté à leur rythme.",
    highlightPoints: normalizeHighlightPoints(profile, services),
    bio:
      profile.bio ||
      "J’accompagne chaque personne avec une approche attentive, apaisante et adaptée à ses besoins du moment.",
    headline:
      profile.public_headline ||
      (profile.city
        ? `Massage et bien-être à ${profile.city}`
        : "Massage et bien-être sur rendez-vous"),
    specialties:
      profile.specialties && profile.specialties.length > 0
        ? profile.specialties
        : normalizeSpecialties(services),
    themeKey: profile.visual_theme,
    phone: profile.phone || "",
    publicEmail: profile.public_email || "",
    websiteUrl: "website_url" in profile ? profile.website_url || "" : "",
    instagramUrl: "instagram_url" in profile ? profile.instagram_url || "" : "",
    facebookUrl: "facebook_url" in profile ? profile.facebook_url || "" : "",
    tiktokUrl: "tiktok_url" in profile ? profile.tiktok_url || "" : "",
    isPublic: "is_public" in profile ? profile.is_public : true,
    acceptsOnlineBooking: profile.accepts_online_booking,
    reservationPaymentMode: profile.reservation_payment_mode,
    depositValueType: profile.deposit_value_type,
    depositValue: profile.deposit_value,
    freeCancellationNoticeHours: profile.free_cancellation_notice_hours,
    keepPaymentAfterDeadline: profile.keep_payment_after_deadline,
    paymentMessage: profile.payment_message,
    profileImageUrl: profile.profile_photo_url || "",
    coverImageUrl: profile.cover_photo_url || "",
    profileImageHint: "Photo portrait chaleureuse du praticien",
    coverImageHint: "Photo d’ambiance apaisante du cabinet ou du studio",
    practiceInformation:
      ("practice_information" in profile ? profile.practice_information : "") ||
      "Chaque séance est préparée avec attention pour offrir un cadre clair, rassurant et adapté.",
    beforeSession: "before_session" in profile ? profile.before_session : "",
    afterSession: "after_session" in profile ? profile.after_session : "",
    bookingPolicy: "booking_policy" in profile ? profile.booking_policy : "",
    contactInformation:
      "contact_information" in profile ? profile.contact_information : "",
    faqItems: "faq_items" in profile ? profile.faq_items ?? [] : [],
  };
}

export function getPublicProfileTheme(themeKey: PublicProfileThemeKey) {
  return (
    publicProfileThemes.find((theme) => theme.key === themeKey) ??
    publicProfileThemes[0]
  );
}

export function getActivityTypeLabel(activityType: DashboardProfile["activity_type"]) {
  return activityTypeLabels[activityType];
}

export function getPracticeModeLabel(practiceMode: DashboardProfile["practice_mode"]) {
  return practiceModeLabels[practiceMode];
}

export function getPracticeModeLead(draft: PublicProfileDraft) {
  switch (draft.practiceMode) {
    case "home":
      return "Intervention à domicile";
    case "mobile":
      return "Déplacement sur votre lieu";
    case "corporate":
      return "Intervention en entreprise ou en événementiel";
    case "mixed":
      return "Accueil sur place et déplacements";
    default:
      return "Accueil sur place";
  }
}

export function getPracticeInfoCards(draft: PublicProfileDraft): PracticeInfoCard[] {
  switch (draft.practiceMode) {
    case "home":
      return [
        {
          title: "Zone d’intervention",
          description:
            draft.serviceArea ||
            "La zone desservie sera précisée ici pour aider les clients à savoir si le praticien peut se déplacer chez eux.",
        },
        {
          title: "Ce que le praticien apporte",
          description:
            draft.equipmentProvided ||
            "Le matériel apporté, l’installation et les conditions pratiques seront précisés ici.",
        },
        {
          title: "Ce que vous pouvez prévoir",
          description:
            draft.clientPreparation ||
            "Le praticien indiquera ici l’espace à prévoir, le confort souhaité et les informations utiles avant sa venue.",
        },
      ];
    case "mobile":
    case "corporate":
      return [
        {
          title: "Zones desservies",
          description:
            draft.serviceArea ||
            "Les zones couvertes et les modalités de déplacement seront précisées ici.",
        },
        {
          title: "Organisation de l’intervention",
          description:
            draft.equipmentProvided ||
            "Le praticien précisera ici son matériel, son installation et les conditions d’intervention.",
        },
        {
          title: "Préparation côté client",
          description:
            draft.clientPreparation ||
            "Les informations utiles avant l’intervention seront précisées ici.",
        },
      ];
    case "mixed":
      return [
        {
          title: "Accueil sur place",
          description:
            draft.venueDetails ||
            draft.practiceInformation ||
            "Le lieu d’accueil et ses particularités seront présentés ici.",
        },
        {
          title: "Déplacements possibles",
          description:
            draft.serviceArea ||
            "Les zones desservies et les conditions de déplacement seront précisées ici.",
        },
        {
          title: "Repères utiles",
          description:
            draft.accessDetails ||
            draft.clientPreparation ||
            "Les informations pratiques avant le rendez-vous seront précisées ici.",
        },
      ];
    default:
      return [
        {
          title: draft.activityType === "spa" ? "Le lieu" : "Cadre d’accueil",
          description:
            draft.venueDetails ||
            draft.practiceInformation ||
            "Le lieu d’accueil sera décrit ici avec des repères simples et rassurants.",
        },
        {
          title: "Accès et repères",
          description:
            draft.accessDetails ||
            "Accès, stationnement, transport, étage ou interphone peuvent être précisés ici pour rassurer avant la venue.",
        },
        {
          title: draft.activityType === "spa" ? "Ambiance" : "Atmosphère",
          description:
            draft.ambienceDetails ||
            "L’ambiance du lieu, le confort et l’expérience d’accueil seront décrits ici.",
        },
      ];
  }
}

export function buildPublicProfileUrl(slug: string) {
  if (typeof window === "undefined") {
    return `/${slug}`;
  }

  return `${window.location.origin}/${slug}`;
}
