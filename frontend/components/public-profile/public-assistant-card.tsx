"use client";

import type { AssistantReply, PublicAssistant } from "@/lib/api";

import { AssistantConversationCard } from "@/components/assistant/assistant-conversation-card";

type PublicAssistantCardProps = {
  assistant: PublicAssistant;
  question: string;
  reply: AssistantReply;
  loading: boolean;
  error: string;
  onQuestionChange: (question: string) => void;
  onSubmit: () => void | Promise<void>;
};

export function PublicAssistantCard({
  assistant,
  question,
  reply,
  loading,
  error,
  onQuestionChange,
  onSubmit,
}: PublicAssistantCardProps) {
  return (
    <AssistantConversationCard
      title="Assistant virtuel du praticien"
      subtitle="Même quand le praticien est indisponible, cet assistant peut répondre aux questions fréquentes, donner les infos pratiques utiles et vous aider à réserver plus sereinement."
      badgeLabel="Disponible 24h/24"
      question={question}
      answer={reply.answer}
      suggestions={assistant.starter_questions}
      welcomeMessage={assistant.welcome_message}
      loading={loading}
      error={error}
      cautious={reply.cautious}
      submitLabel="Obtenir une réponse"
      onQuestionChange={onQuestionChange}
      onSubmit={onSubmit}
    />
  );
}
