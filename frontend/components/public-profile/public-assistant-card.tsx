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
      title="Assistant du praticien"
      subtitle="Posez une question sur les prestations, la réservation ou le déroulé d’une séance."
      badgeLabel="Réponse automatique"
      question={question}
      answer={reply.answer}
      suggestions={assistant.starter_questions}
      welcomeMessage={assistant.welcome_message}
      loading={loading}
      error={error}
      cautious={reply.cautious}
      submitLabel="Poser ma question"
      onQuestionChange={onQuestionChange}
      onSubmit={onSubmit}
    />
  );
}
