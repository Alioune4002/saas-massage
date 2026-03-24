"use client";

import { FormEvent } from "react";
import { MessageSquareText, SendHorizonal } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { FieldWrapper, Input } from "@/components/ui/field";
import { Notice } from "@/components/ui/notice";
import { cn } from "@/lib/utils";

type AssistantConversationCardProps = {
  title: string;
  subtitle: string;
  badgeLabel: string;
  badgeTone?: "info" | "success" | "warning" | "neutral" | "danger";
  question: string;
  answer: string;
  suggestions: string[];
  welcomeMessage?: string;
  loading?: boolean;
  error?: string;
  cautious?: boolean;
  submitLabel?: string;
  disabled?: boolean;
  disabledMessage?: string;
  onQuestionChange: (question: string) => void;
  onSubmit: () => void | Promise<void>;
};

export function AssistantConversationCard({
  title,
  subtitle,
  badgeLabel,
  badgeTone = "info",
  question,
  answer,
  suggestions,
  welcomeMessage,
  loading = false,
  error = "",
  cautious = false,
  submitLabel = "Envoyer ma question",
  disabled = false,
  disabledMessage = "",
  onQuestionChange,
  onSubmit,
}: AssistantConversationCardProps) {
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void onSubmit();
  }

  return (
    <Card>
      <CardHeader title={title} subtitle={subtitle} />

      <div className="mt-6 space-y-4">
        {welcomeMessage ? (
          <div className="rounded-[1.45rem] border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-4 text-sm leading-6 text-[var(--foreground-muted)]">
            {welcomeMessage}
          </div>
        ) : null}

        <form className="space-y-4" onSubmit={handleSubmit}>
          <FieldWrapper label="Question client">
            <Input
              value={question}
              onChange={(event) => onQuestionChange(event.target.value)}
              placeholder="Exemple : comment réserver une séance ?"
              disabled={disabled || loading}
            />
          </FieldWrapper>

          <div className="flex flex-wrap gap-2">
            {suggestions.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => onQuestionChange(item)}
                disabled={disabled || loading}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-sm",
                  question === item
                    ? "border-[var(--primary)]/38 bg-[var(--surface-muted)] text-[var(--foreground)]"
                    : "border-[var(--border)] bg-[var(--background-soft)] text-[var(--foreground-muted)]"
                )}
              >
                {item}
              </button>
            ))}
          </div>

          {disabledMessage ? <Notice tone="info">{disabledMessage}</Notice> : null}
          {error ? <Notice tone="error">{error}</Notice> : null}

          <Button
            type="submit"
            size="lg"
            className="w-full"
            disabled={disabled || loading || !question.trim()}
            iconRight={<SendHorizonal className="h-4 w-4" />}
          >
            {loading ? "Réponse en cours..." : submitLabel}
          </Button>
        </form>

        <div className="rounded-[1.6rem] border border-[var(--border)] bg-[var(--background-soft)] p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] text-[var(--primary)]">
              <MessageSquareText className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-medium text-[var(--foreground)]">
                Réponse de l’assistant
              </p>
              <Badge tone={cautious ? "warning" : badgeTone} className="mt-2">
                {cautious ? "Réponse prudente" : badgeLabel}
              </Badge>
            </div>
          </div>

          <p className="mt-5 whitespace-pre-line text-sm leading-7 text-[var(--foreground-muted)]">
            {answer}
          </p>
        </div>
      </div>
    </Card>
  );
}
