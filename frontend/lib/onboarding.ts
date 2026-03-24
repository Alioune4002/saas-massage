import type { DashboardProfile } from "@/lib/api";

export const onboardingSteps = [
  { key: "welcome", label: "Bienvenue" },
  { key: "activity", label: "Votre activité" },
  { key: "services", label: "Vos soins" },
  { key: "setting", label: "Cadre d’accueil" },
  { key: "slots", label: "Vos créneaux" },
  { key: "ready", label: "Votre page est prête" },
] as const;

export type OnboardingStepKey = (typeof onboardingSteps)[number]["key"];

export const activityTypeOptions = [
  { value: "solo", label: "Praticien solo" },
  { value: "studio", label: "Cabinet / studio" },
  { value: "spa", label: "Spa / institut" },
  { value: "team", label: "Équipe de praticiens" },
] as const;

export const practiceModeOptions = [
  { value: "studio", label: "En cabinet / studio" },
  { value: "home", label: "À domicile" },
  { value: "mobile", label: "En déplacement / itinérant" },
  { value: "corporate", label: "En entreprise / en événementiel" },
  { value: "mixed", label: "Mixte" },
] as const;

export function getProfileAwareCopy(profile: Pick<DashboardProfile, "activity_type" | "practice_mode">) {
  if (profile.practice_mode === "home") {
    return {
      activityHint:
        "Nous allons mettre en avant votre zone d’intervention, vos conditions de déplacement et les informations utiles à préparer chez le client.",
      settingHint:
        "Expliquez le matériel que vous apportez, l’espace à prévoir et la zone que vous desservez.",
    };
  }

  if (profile.practice_mode === "mobile") {
    return {
      activityHint:
        "Nous allons préparer une présentation claire de vos déplacements, de vos conditions d’intervention et de vos créneaux.",
      settingHint:
        "Précisez vos zones desservies, vos contraintes logistiques et ce que le client doit prévoir.",
    };
  }

  if (profile.activity_type === "spa" || profile.activity_type === "team") {
    return {
      activityHint:
        "Nous allons valoriser votre structure, votre accueil, votre organisation et la qualité de votre expérience client.",
      settingHint:
        "Décrivez le lieu, l’accueil, les cabines ou l’équipe pour rassurer avant la réservation.",
    };
  }

  if (profile.practice_mode === "mixed") {
    return {
      activityHint:
        "Nous allons distinguer votre accueil sur place et vos déplacements pour que vos futurs clients comprennent immédiatement votre fonctionnement.",
      settingHint:
        "Expliquez clairement quand vous recevez sur place et dans quelles conditions vous intervenez en déplacement.",
    };
  }

  return {
    activityHint:
      "Nous allons préparer un espace clair pour présenter votre lieu, vos soins et votre manière d’accueillir vos clients.",
    settingHint:
      "Décrivez votre ambiance, votre première séance et les informations utiles avant de réserver.",
  };
}

export function getSuggestedServices(profile: Pick<DashboardProfile, "activity_type">) {
  const base = [
    {
      title: "Massage relaxant",
      short_description: "Un soin enveloppant pour relâcher les tensions et retrouver du calme.",
      duration_minutes: 60,
      price_eur: "85.00",
    },
    {
      title: "Massage profond",
      short_description: "Un soin plus appuyé pour travailler les zones de tension installées.",
      duration_minutes: 60,
      price_eur: "95.00",
    },
    {
      title: "Soin personnalisé",
      short_description: "Une séance adaptée au besoin du moment, à votre rythme et à votre état.",
      duration_minutes: 75,
      price_eur: "110.00",
    },
  ];

  if (profile.activity_type === "spa") {
    return [
      ...base.slice(0, 2),
      {
        title: "Rituel corps",
        short_description: "Une expérience bien-être complète avec un temps de déconnexion prolongé.",
        duration_minutes: 90,
        price_eur: "145.00",
      },
    ];
  }

  if (profile.activity_type === "team") {
    return [
      ...base.slice(0, 2),
      {
        title: "Massage duo",
        short_description: "Une séance pensée pour accueillir deux personnes sur le même créneau.",
        duration_minutes: 60,
        price_eur: "170.00",
      },
    ];
  }

  return base;
}
