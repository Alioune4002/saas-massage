"use client";

import { useEffect, useState } from "react";
import { Bot, Save, ShieldCheck, Sparkles } from "lucide-react";

import { AssistantConversationCard } from "@/components/assistant/assistant-conversation-card";
import { AssistantFaqEditor } from "@/components/assistant/assistant-faq-editor";
import { ToneChoiceCard } from "@/components/assistant/tone-choice-card";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { FieldWrapper, Input, Textarea } from "@/components/ui/field";
import { Notice } from "@/components/ui/notice";
import { SectionHeading } from "@/components/ui/section-heading";
import { Skeleton } from "@/components/ui/skeleton";
import { SwitchRow } from "@/components/ui/switch-row";
import {
  askDashboardAssistant,
  getAssistantProfile,
  updateAssistantProfile,
  type AssistantProfile,
  type AssistantReply,
} from "@/lib/api";
import {
  assistantPreviewQuestions,
  assistantToneOptions,
  createDefaultAssistantDraft,
} from "@/lib/assistant";

const defaultReply: AssistantReply = {
  answer:
    "Enregistre d’abord quelques informations sur ton activité, puis teste une question pour voir comment ton assistant répondra réellement.",
  cautious: false,
};

export default function AssistantPage() {
  const [assistant, setAssistant] = useState<AssistantProfile | null>(null);
  const [draft, setDraft] = useState<AssistantProfile | null>(null);
  const [testQuestion, setTestQuestion] = useState(assistantPreviewQuestions[0]);
  const [testReply, setTestReply] = useState<AssistantReply>(defaultReply);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [testError, setTestError] = useState("");

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        setLoading(true);
        const assistantData = await getAssistantProfile();

        if (!active) {
          return;
        }

        const nextDraft = createDefaultAssistantDraft(assistantData);
        setAssistant(assistantData);
        setDraft(nextDraft);
        setError("");
      } catch (err) {
        if (!active) {
          return;
        }

        setError(
          err instanceof Error
            ? err.message
            : "Impossible de charger mon assistant."
        );
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, []);

  async function handleSave() {
    if (!draft) {
      return;
    }

    try {
      setSaving(true);
      const updatedAssistant = await updateAssistantProfile({
        assistant_enabled: draft.assistant_enabled,
        welcome_message: draft.welcome_message,
        activity_overview: draft.activity_overview,
        general_guidance: draft.general_guidance,
        support_style: draft.support_style,
        practice_information: draft.practice_information,
        faq_items: draft.faq_items,
        before_session: draft.before_session,
        after_session: draft.after_session,
        service_information: draft.service_information,
        booking_policy: draft.booking_policy,
        contact_information: draft.contact_information,
        business_rules: draft.business_rules,
        guardrails: draft.guardrails,
        avoid_topics: draft.avoid_topics,
        assistant_notes: draft.assistant_notes,
        internal_context: draft.internal_context,
        response_tone: draft.response_tone,
        public_assistant_enabled: draft.public_assistant_enabled,
      });

      const nextDraft = createDefaultAssistantDraft(updatedAssistant);
      setAssistant(updatedAssistant);
      setDraft(nextDraft);
      setSuccess("Mon assistant a été enregistré.");
      setError("");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Impossible d’enregistrer mon assistant."
      );
      setSuccess("");
    } finally {
      setSaving(false);
    }
  }

  async function handleTest() {
    if (!testQuestion.trim()) {
      setTestError("Saisis une question à tester.");
      return;
    }

    try {
      setTesting(true);
      setTestError("");
      const reply = await askDashboardAssistant(testQuestion);
      setTestReply(reply);
    } catch (err) {
      setTestError(
        err instanceof Error
          ? err.message
          : "Impossible de tester mon assistant."
      );
    } finally {
      setTesting(false);
    }
  }

  function handleReset() {
    setDraft(createDefaultAssistantDraft(assistant));
    setSuccess("Version réinitialisée sur la dernière sauvegarde.");
    setError("");
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-28 rounded-[2rem]" />
        <div className="grid gap-4 xl:grid-cols-[1.04fr_0.96fr]">
          <Skeleton className="h-[44rem] rounded-[2rem]" />
          <Skeleton className="h-[44rem] rounded-[2rem]" />
        </div>
      </div>
    );
  }

  if (!draft) {
    return <Notice tone="error">{error || "Assistant introuvable."}</Notice>;
  }

  return (
    <div className="space-y-6">
      <SectionHeading
        eyebrow="Mon assistant"
        title="Répondre automatiquement aux questions courantes"
        description="Prépare un assistant virtuel crédible, prudent et fidèle à ta manière d’accueillir. Il pourra répondre aux questions clients quand tu es déjà en séance."
        action={
          <Button
            size="lg"
            onClick={handleSave}
            disabled={saving}
            iconLeft={<Save className="h-4 w-4" />}
          >
            {saving ? "Enregistrement..." : "Enregistrer mon assistant"}
          </Button>
        }
      />

      {error ? <Notice tone="error">{error}</Notice> : null}
      {success ? <Notice tone="success">{success}</Notice> : null}

      <div className="grid gap-4 xl:grid-cols-[1.04fr_0.96fr]">
        <div className="space-y-4">
          <Card>
            <CardHeader
              title="Activation et message d’accueil"
              subtitle="Décide si ton assistant peut répondre, puis prépare le premier message que verront tes clients."
            />

            <div className="mt-6 space-y-4">
              <SwitchRow
                label="Activer l’assistant"
                description="Autoriser NUADYX à répondre automatiquement aux questions courantes à partir des informations enregistrées."
                checked={draft.assistant_enabled}
                onCheckedChange={(checked) =>
                  setDraft((current) =>
                    current ? { ...current, assistant_enabled: checked } : current
                  )
                }
              />
              <SwitchRow
                label="Afficher l’assistant sur mon profil public"
                description="Rendre le widget visible sur ta page publique quand tu seras prêt à le montrer à tes clients."
                checked={draft.public_assistant_enabled}
                onCheckedChange={(checked) =>
                  setDraft((current) =>
                    current
                      ? { ...current, public_assistant_enabled: checked }
                      : current
                  )
                }
              />

              <FieldWrapper label="Message d’accueil">
                <Input
                  value={draft.welcome_message}
                  onChange={(event) =>
                    setDraft((current) =>
                      current
                        ? { ...current, welcome_message: event.target.value }
                        : current
                    )
                  }
                  placeholder="Bonjour, je peux répondre à vos questions sur les prestations, la réservation et le déroulé d’une séance."
                />
              </FieldWrapper>
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Présenter mon activité"
              subtitle="Aide l’assistant à parler de toi, de ton univers et de la manière dont tu accompagnes tes clients."
            />

            <div className="mt-6 grid gap-4">
              <FieldWrapper label="Présentation du praticien">
                <Textarea
                  value={draft.activity_overview}
                  onChange={(event) =>
                    setDraft((current) =>
                      current
                        ? { ...current, activity_overview: event.target.value }
                        : current
                    )
                  }
                  placeholder="Présente ton activité, ton approche et ce que tes clients viennent chercher auprès de toi."
                />
              </FieldWrapper>

              <FieldWrapper label="Manière d’accueillir les clients">
                <Textarea
                  value={draft.support_style}
                  onChange={(event) =>
                    setDraft((current) =>
                      current
                        ? { ...current, support_style: event.target.value }
                        : current
                    )
                  }
                  placeholder="Explique comment tu reçois, écoutes et adaptes tes séances."
                />
              </FieldWrapper>

              <FieldWrapper label="Informations pratiques">
                <Textarea
                  value={draft.practice_information}
                  onChange={(event) =>
                    setDraft((current) =>
                      current
                        ? { ...current, practice_information: event.target.value }
                        : current
                    )
                  }
                  placeholder="Précise le cadre d’accueil, l’ambiance du lieu, la zone desservie ou les détails utiles d’accès."
                />
              </FieldWrapper>
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Réponses fréquentes"
              subtitle="Prépare ce que l’assistant dira aux questions que tes clients reviennent souvent poser."
            />
            <div className="mt-6">
              <AssistantFaqEditor
                items={draft.faq_items}
                onChange={(items) =>
                  setDraft((current) =>
                    current ? { ...current, faq_items: items } : current
                  )
                }
              />
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Prestations, réservation et informations utiles"
              subtitle="Donne à l’assistant les précisions à transmettre sur tes soins, la réservation et le contact."
            />

            <div className="mt-6 grid gap-4">
              <FieldWrapper label="Précisions sur les prestations">
                <Textarea
                  value={draft.service_information}
                  onChange={(event) =>
                    setDraft((current) =>
                      current
                        ? { ...current, service_information: event.target.value }
                        : current
                    )
                  }
                  placeholder="Explique comment orienter un client entre tes prestations ou ce qui distingue ta pratique."
                />
              </FieldWrapper>

              <FieldWrapper label="Façon de réserver">
                <Textarea
                  value={draft.booking_policy}
                  onChange={(event) =>
                    setDraft((current) =>
                      current
                        ? { ...current, booking_policy: event.target.value }
                        : current
                    )
                  }
                  placeholder="Explique comment réserver, déplacer ou annuler un rendez-vous."
                />
              </FieldWrapper>

              <FieldWrapper label="Informations utiles à transmettre">
                <Textarea
                  value={draft.contact_information}
                  onChange={(event) =>
                    setDraft((current) =>
                      current
                        ? { ...current, contact_information: event.target.value }
                        : current
                    )
                  }
                  placeholder="Téléphone, email, indications pratiques ou précisions d’accueil."
                />
              </FieldWrapper>
            </div>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader
              title="Style de réponse"
              subtitle="Choisis l’orientation du ton pour que les réponses ressemblent vraiment à ton univers."
            />
            <div className="mt-6 grid gap-4">
              {assistantToneOptions.map((tone) => (
                <ToneChoiceCard
                  key={tone.key}
                  label={tone.label}
                  description={tone.description}
                  selected={draft.response_tone === tone.key}
                  onSelect={() =>
                    setDraft((current) =>
                      current ? { ...current, response_tone: tone.key } : current
                    )
                  }
                />
              ))}
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Consignes de réponse"
              subtitle="Précise ce que ton assistant doit mettre en avant et ce qu’il doit garder en tête."
            />

            <div className="mt-6 grid gap-4">
              <FieldWrapper label="Consignes générales">
                <Textarea
                  value={draft.general_guidance}
                  onChange={(event) =>
                    setDraft((current) =>
                      current
                        ? { ...current, general_guidance: event.target.value }
                        : current
                    )
                  }
                  placeholder="Exemple : rester simple, rassurant, ne jamais presser le client, proposer de contacter le praticien en cas d’hésitation."
                />
              </FieldWrapper>

              <FieldWrapper label="Règles métier">
                <Textarea
                  value={draft.business_rules}
                  onChange={(event) =>
                    setDraft((current) =>
                      current
                        ? { ...current, business_rules: event.target.value }
                        : current
                    )
                  }
                  placeholder="Exemple : rappeler que la réservation est confirmée après validation, ne jamais promettre un résultat, toujours inviter à signaler une contre-indication."
                />
              </FieldWrapper>

              <FieldWrapper label="Questions auxquelles il ne faut pas répondre">
                <Textarea
                  value={draft.avoid_topics}
                  onChange={(event) =>
                    setDraft((current) =>
                      current ? { ...current, avoid_topics: event.target.value } : current
                    )
                  }
                  placeholder="Sépare les sujets sensibles par des virgules ou des retours à la ligne."
                />
              </FieldWrapper>

              <FieldWrapper label="Message libre sur mon activité">
                <Textarea
                  value={draft.assistant_notes}
                  onChange={(event) =>
                    setDraft((current) =>
                      current
                        ? { ...current, assistant_notes: event.target.value }
                        : current
                    )
                  }
                  placeholder="Ajoute ici un contexte libre que ton assistant pourra utiliser pour mieux te représenter."
                />
              </FieldWrapper>
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Prudence et garde-fous"
              subtitle="Verrouille les sujets sensibles pour éviter les réponses floues ou inadaptées."
            />

            <div className="mt-6 grid gap-4">
              <FieldWrapper label="Précautions générales">
                <Textarea
                  value={draft.before_session}
                  onChange={(event) =>
                    setDraft((current) =>
                      current ? { ...current, before_session: event.target.value } : current
                    )
                  }
                  placeholder="Ce qu’un client doit savoir avant la séance."
                />
              </FieldWrapper>

              <FieldWrapper label="Après la séance">
                <Textarea
                  value={draft.after_session}
                  onChange={(event) =>
                    setDraft((current) =>
                      current ? { ...current, after_session: event.target.value } : current
                    )
                  }
                  placeholder="Ce qu’il est utile de transmettre après une séance."
                />
              </FieldWrapper>

              <FieldWrapper label="Garde-fous">
                <Textarea
                  value={draft.guardrails}
                  onChange={(event) =>
                    setDraft((current) =>
                      current ? { ...current, guardrails: event.target.value } : current
                    )
                  }
                  placeholder="Indique ici les sujets qui exigent prudence et redirection vers le praticien ou un professionnel de santé."
                />
              </FieldWrapper>

              <FieldWrapper label="Note interne de contexte" hint="Visible seulement côté praticien">
                <Textarea
                  value={draft.internal_context}
                  onChange={(event) =>
                    setDraft((current) =>
                      current
                        ? { ...current, internal_context: event.target.value }
                        : current
                    )
                  }
                  placeholder="Ajoute un contexte interne utile pour la suite du produit."
                />
              </FieldWrapper>
            </div>
          </Card>

          <AssistantConversationCard
            title="Tester mon assistant"
            subtitle="Pose une vraie question et vérifie la réponse produite à partir des données enregistrées."
            badgeLabel="Réponse réelle"
            question={testQuestion}
            answer={testReply.answer}
            suggestions={assistantPreviewQuestions}
            welcomeMessage={draft.welcome_message}
            loading={testing}
            error={testError}
            cautious={testReply.cautious}
            disabled={!draft.assistant_enabled}
            disabledMessage={
              !draft.assistant_enabled
                ? "Active d’abord ton assistant puis enregistre-le pour lancer un test réel."
                : ""
            }
            submitLabel="Tester cette réponse"
            onQuestionChange={setTestQuestion}
            onSubmit={handleTest}
          />

          <Card>
            <CardHeader
              title="Ce que ton assistant sait déjà faire"
              subtitle="Une première base réellement utile, prudente et prête à être enrichie."
            />
            <div className="mt-5 space-y-4">
              <div className="rounded-[1.5rem] border border-[var(--border)] bg-[var(--surface-muted)] p-5">
                <div className="flex items-start gap-3">
                  <Bot className="mt-0.5 h-5 w-5 text-[var(--primary)]" />
                  <div>
                    <p className="text-sm font-medium text-[var(--foreground)]">
                      Réponses aux questions courantes
                    </p>
                    <p className="mt-2 text-sm leading-6 text-[var(--foreground-muted)]">
                      L’assistant peut déjà répondre sur les tarifs, les prestations,
                      la réservation, les créneaux, le déroulé d’une séance et les
                      informations pratiques.
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-[1.5rem] border border-[var(--border)] bg-[var(--surface-muted)] p-5">
                <div className="flex items-start gap-3">
                  <ShieldCheck className="mt-0.5 h-5 w-5 text-[var(--primary)]" />
                  <div>
                    <p className="text-sm font-medium text-[var(--foreground)]">
                      Prudence intégrée
                    </p>
                    <p className="mt-2 text-sm leading-6 text-[var(--foreground-muted)]">
                      Les sujets sensibles restent encadrés: l’assistant évite les
                      promesses thérapeutiques et redirige proprement quand la
                      question dépasse son cadre.
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-[1.5rem] border border-[var(--border)] bg-[var(--surface-muted)] p-5">
                <div className="flex items-start gap-3">
                  <Sparkles className="mt-0.5 h-5 w-5 text-[var(--primary)]" />
                  <div>
                    <p className="text-sm font-medium text-[var(--foreground)]">
                      Prêt pour la suite
                    </p>
                    <p className="mt-2 text-sm leading-6 text-[var(--foreground-muted)]">
                      L’architecture est prête pour brancher plus tard un moteur
                      plus avancé, un historique, des statistiques et des offres
                      premium.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Button
                size="lg"
                onClick={handleSave}
                disabled={saving}
                iconLeft={<Save className="h-4 w-4" />}
              >
                {saving ? "Enregistrement..." : "Enregistrer mon assistant"}
              </Button>
              <Button variant="secondary" size="lg" onClick={handleReset}>
                Réinitialiser
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
