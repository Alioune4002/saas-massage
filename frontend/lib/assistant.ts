import type { AssistantProfile } from "@/lib/api";

export const assistantToneOptions = [
  {
    key: "rassurant",
    label: "Rassurant",
    description: "Calme, clair et sécurisant pour aider le client à se décider sereinement.",
  },
  {
    key: "apaisant",
    label: "Apaisant",
    description: "Doux, enveloppant et orienté bien-être pour une relation plus délicate.",
  },
  {
    key: "chaleureux",
    label: "Chaleureux",
    description: "Humain, proche et simple, comme un premier échange bien accueilli.",
  },
  {
    key: "professionnel",
    label: "Professionnel",
    description: "Structuré, net et fiable pour répondre sans détour aux questions courantes.",
  },
  {
    key: "premium",
    label: "Haut de gamme",
    description: "Soigné, net et haut de gamme pour un univers plus signature.",
  },
  {
    key: "sobre",
    label: "Sobre",
    description: "Discret, concis et rassurant pour aller à l’essentiel sans surcharge.",
  },
] as const;

export const assistantPreviewQuestions = [
  "Comment se déroule une première séance ?",
  "Que faut-il prévoir avant le rendez-vous ?",
  "Puis-je déplacer ou annuler ma réservation ?",
  "Quels types de prestations proposez-vous ?",
];

export function createDefaultAssistantDraft(
  profile?: AssistantProfile | null
): AssistantProfile {
  return {
    id: profile?.id ?? "",
    assistant_enabled: profile?.assistant_enabled ?? false,
    welcome_message:
      profile?.welcome_message ??
      "Bonjour, je peux répondre aux questions courantes sur les prestations, la réservation et le déroulé d’une séance.",
    activity_overview: profile?.activity_overview ?? "",
    general_guidance: profile?.general_guidance ?? "",
    support_style: profile?.support_style ?? "",
    practice_information: profile?.practice_information ?? "",
    faq_items: profile?.faq_items ?? [],
    before_session: profile?.before_session ?? "",
    after_session: profile?.after_session ?? "",
    service_information: profile?.service_information ?? "",
    booking_policy: profile?.booking_policy ?? "",
    contact_information: profile?.contact_information ?? "",
    business_rules: profile?.business_rules ?? "",
    guardrails:
      profile?.guardrails ??
      "Rester prudent sur toute situation liée à une grossesse, une fièvre, une blessure, une douleur importante, un traitement ou une pathologie. Ne jamais remplacer un avis médical.",
    avoid_topics: profile?.avoid_topics ?? "",
    assistant_notes: profile?.assistant_notes ?? "",
    internal_context: profile?.internal_context ?? "",
    response_tone: profile?.response_tone ?? "rassurant",
    public_assistant_enabled: profile?.public_assistant_enabled ?? false,
  };
}
