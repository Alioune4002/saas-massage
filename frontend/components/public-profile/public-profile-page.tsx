/* eslint-disable @next/next/no-img-element */

"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  CalendarClock,
  Copy,
  Mail,
  MapPin,
  MessageSquare,
  Phone,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

import { NuadyxLogo } from "@/components/brand/nuadyx-logo";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Notice } from "@/components/ui/notice";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ApiError,
  askPublicAssistant,
  createPublicBooking,
  getPublicAvailabilities,
  getPublicAssistant,
  getPublicProfessional,
  getPublicServices,
  type AssistantReply,
  type PublicBookingCreated,
  type CreatePublicBookingPayload,
  type PublicAssistant,
  type PublicAvailability,
  type PublicProfessional,
  type PublicService,
} from "@/lib/api";
import { PublicAssistantCard } from "@/components/public-profile/public-assistant-card";
import { PublicBookingCard } from "@/components/public-profile/public-booking-card";
import { buildPublicPaymentPreview } from "@/lib/payments";
import {
  buildPublicProfileUrl,
  createDefaultPublicProfileDraft,
  getActivityTypeLabel,
  getPracticeInfoCards,
  getPracticeModeLabel,
  getPracticeModeLead,
  getPublicProfileTheme,
  type PublicProfileDraft,
} from "@/lib/public-profile";
import {
  formatCurrency,
  getInitials,
} from "@/lib/utils";

type PublicProfilePageProps = {
  slug: string;
};

export function PublicProfilePage({ slug }: PublicProfilePageProps) {
  const searchParams = useSearchParams();
  const [profile, setProfile] = useState<PublicProfessional | null>(null);
  const [services, setServices] = useState<PublicService[]>([]);
  const [slots, setSlots] = useState<PublicAvailability[]>([]);
  const [assistant, setAssistant] = useState<PublicAssistant | null>(null);
  const [draft, setDraft] = useState<PublicProfileDraft | null>(null);
  const [selectedServiceId, setSelectedServiceId] = useState("");
  const [selectedSlotId, setSelectedSlotId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [assistantQuestion, setAssistantQuestion] = useState("");
  const [assistantReply, setAssistantReply] = useState<AssistantReply>({
    answer:
      "Posez une question pour obtenir une réponse sur les prestations, la réservation ou le déroulé d’une séance.",
    cautious: false,
  });
  const [assistantError, setAssistantError] = useState("");
  const [assistantLoading, setAssistantLoading] = useState(false);
  const [bookingError, setBookingError] = useState("");
  const [bookingReceipt, setBookingReceipt] = useState<PublicBookingCreated | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [bookingForm, setBookingForm] = useState<Omit<
    CreatePublicBookingPayload,
    "professional_slug" | "service_id" | "slot_id"
  >>({
    client_first_name: "",
    client_last_name: "",
    client_email: "",
    client_phone: "",
    client_note: "",
  });
  const paymentProcessing = searchParams.get("payment") === "processing";
  const paymentCancelled = searchParams.get("payment") === "cancelled";
  const serviceUnavailable = error.includes("Service temporairement indisponible");

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        setLoading(true);
        const [profileData, servicesData, slotsData, assistantData] = await Promise.all([
          getPublicProfessional(slug),
          getPublicServices(slug),
          getPublicAvailabilities(slug),
          getPublicAssistant(slug).catch((assistantError) => {
            if (
              assistantError instanceof ApiError &&
              (assistantError.status === 403 || assistantError.status === 404)
            ) {
              return null;
            }
            throw assistantError;
          }),
        ]);

        if (!active) {
          return;
        }

        const defaultDraft = createDefaultPublicProfileDraft(profileData, servicesData);

        setProfile(profileData);
        setServices(servicesData);
        setSlots(slotsData);
        setAssistant(assistantData);
        setDraft(defaultDraft);
        setSelectedServiceId(servicesData[0]?.id ?? "");
        setAssistantQuestion(assistantData?.starter_questions[0] ?? "");
        setAssistantReply({
          answer:
            "Posez une question pour obtenir une réponse sur les prestations, la réservation ou le déroulé d’une séance.",
          cautious: false,
        });
        setError("");
      } catch (err) {
        if (!active) {
          return;
        }

        setError(
          err instanceof Error
            ? err.message
            : "Profil public introuvable."
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
  }, [slug]);

  const filteredSlots = useMemo(() => {
    if (!selectedServiceId) {
      return slots;
    }

    return slots.filter(
      (slot) => slot.service === null || slot.service === selectedServiceId
    );
  }, [selectedServiceId, slots]);

  useEffect(() => {
    if (
      selectedSlotId &&
      !filteredSlots.some((slot) => slot.id === selectedSlotId)
    ) {
      setSelectedSlotId("");
    }
  }, [filteredSlots, selectedSlotId]);

  async function handleBookingSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBookingError("");
    setBookingReceipt(null);

    if (!selectedServiceId || !selectedSlotId) {
      setBookingError("Choisis une prestation et un créneau.");
      return;
    }

    try {
      setSubmitting(true);
      const result = await createPublicBooking({
        professional_slug: slug,
        service_id: selectedServiceId,
        slot_id: selectedSlotId,
        ...bookingForm,
      });

      if (result.checkout_url) {
        window.location.href = result.checkout_url;
        return;
      }

      setBookingReceipt(result);
      setSelectedSlotId("");
      setBookingForm({
        client_first_name: "",
        client_last_name: "",
        client_email: "",
        client_phone: "",
        client_note: "",
      });

      const refreshedSlots = await getPublicAvailabilities(slug);
      setSlots(refreshedSlots);
    } catch (err) {
      setBookingError(
        err instanceof Error
          ? err.message
          : "Impossible de finaliser la demande."
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCopyLink() {
    await navigator.clipboard.writeText(buildPublicProfileUrl(slug));
  }

  async function handleAssistantSubmit() {
    if (!assistant || !assistantQuestion.trim()) {
      setAssistantError("Saisissez une question pour recevoir une réponse.");
      return;
    }

    try {
      setAssistantLoading(true);
      setAssistantError("");
      const reply = await askPublicAssistant(slug, assistantQuestion);
      setAssistantReply(reply);
    } catch (assistantErr) {
      setAssistantError(
        assistantErr instanceof Error
          ? assistantErr.message
          : "Impossible d’obtenir une réponse pour le moment."
      );
    } finally {
      setAssistantLoading(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen px-4 py-5 md:px-6">
        <div className="mx-auto max-w-7xl space-y-5">
          <Skeleton className="h-18 rounded-[1.8rem]" />
          <Skeleton className="h-80 rounded-[2rem]" />
          <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
            <Skeleton className="h-[36rem] rounded-[2rem]" />
            <Skeleton className="h-[36rem] rounded-[2rem]" />
          </div>
        </div>
      </main>
    );
  }

  if (error || !profile || !draft) {
    return (
      <main className="min-h-screen px-4 py-6 md:px-6">
        <div className="mx-auto max-w-3xl">
          <Card className="rounded-[2rem] p-8 text-center">
            <p className="text-sm uppercase tracking-[0.28em] text-[var(--primary)]/80">
              Profil public
            </p>
            <h1 className="mt-4 text-3xl font-semibold text-[var(--foreground)]">
              {serviceUnavailable
                ? "Service temporairement indisponible"
                : "Ce profil n’est pas disponible"}
            </h1>
            <p className="mt-4 text-sm leading-7 text-[var(--foreground-muted)]">
              {serviceUnavailable
                ? "La page publique n’a pas pu contacter le serveur pour le moment. Vous pouvez réessayer dans quelques instants."
                : "Le lien est peut-être incorrect ou la visibilité publique n’est pas encore activée."}
            </p>
            <Link href="/" className="mt-6 inline-flex">
              <Button iconLeft={<ArrowLeft className="h-4 w-4" />}>
                Revenir à l’accueil
              </Button>
            </Link>
          </Card>
        </div>
      </main>
    );
  }

  const theme = getPublicProfileTheme(draft.themeKey);
  const selectedService =
    services.find((service) => service.id === selectedServiceId) ?? null;
  const paymentPreview = buildPublicPaymentPreview(profile, selectedService);
  const paymentUnavailableReason =
    profile.reservation_payment_mode !== "none" &&
    (!profile.payment_account ||
      profile.payment_account.onboarding_status !== "active" ||
      !profile.payment_account.charges_enabled)
      ? "Le règlement en ligne n’est pas encore disponible pour ce praticien. Vous pourrez réserver dès que son compte de paiement sera activé."
      : "";
  const practiceInfoCards = getPracticeInfoCards(draft);
  const essentials = [
    { label: "Activité", value: getActivityTypeLabel(draft.activityType) },
    { label: "Accueil", value: getPracticeModeLabel(draft.practiceMode) },
    {
      label: draft.practiceMode === "home" || draft.practiceMode === "mobile" || draft.practiceMode === "mixed"
        ? "Zone"
        : "Ville",
      value: draft.serviceArea || draft.city,
    },
    {
      label: "Réservation",
      value: draft.acceptsOnlineBooking
        ? "Ouverte en ligne"
        : "Sur demande",
    },
  ];
  const journeySections = [
    {
      title: "Déroulé et cadre",
      content: draft.practiceInformation,
    },
    {
      title: "Avant la séance",
      content:
        draft.beforeSession ||
        draft.clientPreparation ||
        "Les informations utiles avant la séance seront précisées ici pour rassurer avant la venue.",
    },
    {
      title: "Après la séance",
      content:
        draft.afterSession ||
        "Le praticien peut préciser ici ses recommandations de confort et de récupération après la séance.",
    },
    {
      title: "Réservation et annulation",
      content:
        draft.bookingPolicy ||
        "Les conditions de réservation et les ajustements éventuels seront expliqués ici de manière simple.",
    },
  ];
  const faqItems = draft.faqItems.slice(0, 4);

  return (
    <main className="min-h-screen px-4 py-4 md:px-6">
      <div className="mx-auto max-w-7xl">
        <header className="glass-panel rounded-[1.8rem] px-4 py-3 md:px-5">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <Link href="/">
                <NuadyxLogo priority />
              </Link>
              <Badge tone="info" className="hidden md:inline-flex">
                Profil réservable 24h/24
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <ThemeToggle compact />
              <Link href="/login">
                <Button variant="secondary" size="md">
                  Espace praticien
                </Button>
              </Link>
            </div>
          </div>
        </header>

        <section
          className={`relative mt-5 overflow-hidden rounded-[2.2rem] border border-[var(--border)] ${theme.heroGradient}`}
        >
          {draft.coverImageUrl ? (
            <img
              src={draft.coverImageUrl}
              alt={`Couverture de ${draft.displayName}`}
              className="absolute inset-0 h-full w-full object-cover"
            />
          ) : null}
          <div className="absolute inset-0 bg-[linear-gradient(180deg,var(--hero-scrim),var(--hero-scrim-strong))]" />
          <div className="relative grid gap-6 px-5 py-6 md:px-8 md:py-8 lg:grid-cols-[1.08fr_0.92fr] lg:items-end">
            <div className="text-[var(--inverse-foreground)]">
              <div className="flex flex-wrap gap-2">
                <Badge className={theme.accentBadgeClassName}>
                  {draft.acceptsOnlineBooking
                    ? "Réservation en ligne ouverte"
                    : "Réservation sur demande"}
                </Badge>
                <Badge className={theme.accentBadgeClassName}>
                  {getPracticeModeLead(draft)}
                </Badge>
              </div>
              <h1 className="mt-5 text-4xl font-semibold tracking-tight md:text-5xl">
                {draft.displayName}
              </h1>
              <p className="mt-4 max-w-3xl text-lg leading-8 text-[var(--inverse-foreground-muted)]">
                {draft.headline}
              </p>
              <div className="mt-5 flex flex-wrap items-center gap-4 text-sm text-[var(--inverse-foreground-muted)]">
                <span className="inline-flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  {draft.serviceArea || draft.city}
                </span>
                {profile.phone ? (
                  <span className="inline-flex items-center gap-2">
                    <Phone className="h-4 w-4" />
                    {profile.phone}
                  </span>
                ) : null}
                {profile.public_email ? (
                  <span className="inline-flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    {profile.public_email}
                  </span>
                ) : null}
              </div>
              <p className="mt-6 max-w-2xl text-sm leading-7 text-[var(--inverse-foreground-subtle)]">
                {draft.bio}
              </p>
              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                {draft.highlightPoints.slice(0, 3).map((point) => (
                  <div
                    key={point}
                    className="rounded-[1.25rem] border border-[var(--hero-card-border-soft)] bg-[var(--hero-card-surface)] px-4 py-4 text-sm leading-6 text-[var(--inverse-foreground-muted)]"
                  >
                    {point}
                  </div>
                ))}
              </div>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <a href="#reservation">
                  <Button size="lg">Réserver une séance</Button>
                </a>
                {profile.public_email ? (
                  <a href={`mailto:${profile.public_email}`}>
                    <Button variant="secondary" size="lg">
                      Contacter le praticien
                    </Button>
                  </a>
                ) : null}
              </div>
            </div>

            <div className="relative flex justify-start lg:justify-end">
              <div className="relative w-full max-w-md rounded-[2rem] border border-[var(--hero-card-border-soft)] bg-[var(--hero-card-surface)] p-5 backdrop-blur-sm">
                <div className="flex items-start gap-4">
                  <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-[1.8rem] border border-[var(--hero-card-border)] bg-[var(--hero-card-surface-strong)] text-3xl font-semibold text-[var(--inverse-foreground)]">
                    {draft.profileImageUrl ? (
                      <img
                        src={draft.profileImageUrl}
                        alt={draft.displayName}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      getInitials(draft.displayName)
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs uppercase tracking-[0.26em] text-[var(--inverse-foreground-subtle)]">
                      L’essentiel
                    </p>
                    <p className="mt-2 text-xl font-semibold text-[var(--inverse-foreground)]">
                      {getActivityTypeLabel(draft.activityType)}
                    </p>
                    <p className="mt-2 text-sm leading-6 text-[var(--inverse-foreground-muted)]">
                      {getPracticeModeLabel(draft.practiceMode)}
                    </p>
                  </div>
                </div>

                <div className="mt-6 grid gap-3">
                  {essentials.map((item) => (
                    <div
                      key={item.label}
                      className="rounded-[1.2rem] border border-[var(--hero-card-border-soft)] bg-[var(--hero-card-muted)] px-4 py-3"
                    >
                      <p className="text-xs uppercase tracking-[0.18em] text-[var(--inverse-foreground-subtle)]">
                        {item.label}
                      </p>
                      <p className="mt-2 text-sm font-medium text-[var(--inverse-foreground)]">
                        {item.value}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {draft.specialties.map((specialty) => (
                    <span
                      key={specialty}
                      className="inline-flex items-center rounded-full border border-[var(--hero-card-border-soft)] bg-[var(--hero-card-surface)] px-3 py-1 text-sm text-[var(--inverse-foreground-muted)]"
                    >
                      {specialty}
                    </span>
                  ))}
                </div>

                <div className="mt-5 flex gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    iconLeft={<Copy className="h-4 w-4" />}
                    onClick={handleCopyLink}
                  >
                    Copier ce lien
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1.06fr_0.94fr]">
          <div className="space-y-6">
            <Card className="rounded-[2rem]">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.28em] text-[var(--primary)]/80">
                    L’essentiel
                  </p>
                  <h2 className="mt-3 text-2xl font-semibold text-[var(--foreground)]">
                    Comprendre rapidement le praticien
                  </h2>
                </div>
                <Badge tone={draft.acceptsOnlineBooking ? "success" : "neutral"}>
                  {draft.acceptsOnlineBooking
                    ? "Réservable en ligne"
                    : "Prise de contact conseillée"}
                </Badge>
              </div>
              <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                {essentials.map((item) => (
                  <div
                    key={item.label}
                    className="rounded-[1.4rem] border border-[var(--border)] bg-[var(--background-soft)] px-4 py-4"
                  >
                    <p className="text-xs uppercase tracking-[0.18em] text-[var(--foreground-subtle)]">
                      {item.label}
                    </p>
                    <p className="mt-3 text-sm font-medium leading-6 text-[var(--foreground)]">
                      {item.value}
                    </p>
                  </div>
                ))}
              </div>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div className="rounded-[1.5rem] border border-[var(--border)] bg-[var(--surface-muted)] p-5">
                  <p className="text-sm font-medium text-[var(--foreground)]">
                    Présentation
                  </p>
                  <p className="mt-3 text-sm leading-7 text-[var(--foreground-muted)]">
                    {draft.bio}
                  </p>
                </div>
                <div className="rounded-[1.5rem] border border-[var(--border)] bg-[var(--surface-muted)] p-5">
                  <p className="text-sm font-medium text-[var(--foreground)]">
                    Pour qui et dans quel esprit
                  </p>
                  <p className="mt-3 text-sm leading-7 text-[var(--foreground-muted)]">
                    {draft.idealFor}
                  </p>
                </div>
              </div>
            </Card>

            <Card className="rounded-[2rem]">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.28em] text-[var(--primary)]/80">
                    Prestations
                  </p>
                  <h2 className="mt-3 text-2xl font-semibold text-[var(--foreground)]">
                    Choisir le soin le plus adapté
                  </h2>
                </div>
                <Badge tone="success">{services.length} soin(s)</Badge>
              </div>
              <p className="mt-4 text-sm leading-7 text-[var(--foreground-muted)]">
                Chaque prestation précise sa durée, son tarif et son intention
                pour vous aider à comprendre ce qui vous convient le mieux.
              </p>
              <div className="mt-6 grid gap-4">
                {services.map((service) => (
                  <div
                    key={service.id}
                    className="rounded-[1.6rem] border border-[var(--border)] bg-[var(--background-soft)] px-5 py-5 text-left"
                  >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <h3 className="text-xl font-semibold text-[var(--foreground)]">
                          {service.title}
                        </h3>
                        <p className="mt-3 text-sm leading-7 text-[var(--foreground-muted)]">
                          {service.short_description}
                        </p>
                      </div>
                      <div className="rounded-[1.15rem] border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3 text-right">
                        <p className="text-sm font-semibold text-[var(--foreground)]">
                          {formatCurrency(service.price_eur)}
                        </p>
                        <p className="mt-1 text-xs uppercase tracking-[0.22em] text-[var(--foreground-subtle)]">
                          {service.duration_minutes} min
                        </p>
                      </div>
                    </div>
                    {service.full_description ? (
                      <p className="mt-4 text-sm leading-7 text-[var(--foreground-muted)]">
                        {service.full_description}
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
            </Card>

            <Card className="rounded-[2rem]">
              <p className="text-xs uppercase tracking-[0.28em] text-[var(--primary)]/80">
                Cadre d’accueil
              </p>
              <h2 className="mt-3 text-2xl font-semibold text-[var(--foreground)]">
                Savoir où, comment et dans quelles conditions la séance se déroule
              </h2>
              <div className="mt-6 grid gap-4 md:grid-cols-3">
                {practiceInfoCards.map((card) => (
                  <div
                    key={card.title}
                    className="rounded-[1.5rem] border border-[var(--border)] bg-[var(--surface-muted)] p-5"
                  >
                    <p className="text-sm font-medium text-[var(--foreground)]">
                      {card.title}
                    </p>
                    <p className="mt-3 text-sm leading-7 text-[var(--foreground-muted)]">
                      {card.description}
                    </p>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="rounded-[2rem]">
              <p className="text-xs uppercase tracking-[0.28em] text-[var(--primary)]/80">
                Avant et après la séance
              </p>
              <h2 className="mt-3 text-2xl font-semibold text-[var(--foreground)]">
                Réserver en confiance
              </h2>
              <div className="mt-6 grid gap-4 md:grid-cols-2">
                {journeySections.map((section) => (
                  <div
                    key={section.title}
                    className="rounded-[1.5rem] border border-[var(--border)] bg-[var(--background-soft)] p-5"
                  >
                    <p className="text-sm font-medium text-[var(--foreground)]">
                      {section.title}
                    </p>
                    <p className="mt-3 text-sm leading-7 text-[var(--foreground-muted)]">
                      {section.content}
                    </p>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="rounded-[2rem]">
              <p className="text-xs uppercase tracking-[0.28em] text-[var(--primary)]/80">
                Règlement et annulation
              </p>
              <h2 className="mt-3 text-2xl font-semibold text-[var(--foreground)]">
                Ce que vous validez au moment de réserver
              </h2>
              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <div className="rounded-[1.5rem] border border-[var(--border)] bg-[var(--surface-muted)] p-5">
                  <p className="text-sm font-medium text-[var(--foreground)]">
                    {paymentPreview.title}
                  </p>
                  <p className="mt-3 text-sm leading-7 text-[var(--foreground-muted)]">
                    {paymentPreview.description}
                  </p>
                  <p className="mt-3 text-sm leading-7 text-[var(--foreground-muted)]">
                    {paymentPreview.message}
                  </p>
                </div>
                <div className="rounded-[1.5rem] border border-[var(--border)] bg-[var(--background-soft)] p-5">
                  <p className="text-sm font-medium text-[var(--foreground)]">
                    Politique d’annulation
                  </p>
                  <p className="mt-3 text-sm leading-7 text-[var(--foreground-muted)]">
                    {paymentPreview.cancellationSummary}
                  </p>
                </div>
              </div>
            </Card>

            <Card className="rounded-[2rem]">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.28em] text-[var(--primary)]/80">
                    Questions fréquentes
                  </p>
                  <h2 className="mt-3 text-2xl font-semibold text-[var(--foreground)]">
                    Les réponses utiles avant de réserver
                  </h2>
                </div>
                {faqItems.length > 0 ? (
                  <Badge tone="info">{faqItems.length} réponse(s)</Badge>
                ) : null}
              </div>
              {faqItems.length > 0 ? (
                <div className="mt-6 grid gap-4">
                  {faqItems.map((item) => (
                    <div
                      key={item.question}
                      className="rounded-[1.5rem] border border-[var(--border)] bg-[var(--surface-muted)] p-5"
                    >
                      <p className="text-sm font-semibold text-[var(--foreground)]">
                        {item.question}
                      </p>
                      <p className="mt-3 text-sm leading-7 text-[var(--foreground-muted)]">
                        {item.answer}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-6 rounded-[1.5rem] border border-dashed border-[var(--border)] bg-[var(--background-soft)] p-5">
                  <p className="text-sm font-medium text-[var(--foreground)]">
                    Les réponses fréquentes seront bientôt visibles ici
                  </p>
                  <p className="mt-2 text-sm leading-6 text-[var(--foreground-muted)]">
                    Cette zone est prête à afficher les réponses utiles du
                    praticien pour aider le client à réserver plus sereinement.
                  </p>
                </div>
              )}
            </Card>

            <Card className="rounded-[2rem]">
              <div className="flex items-start gap-3">
                <ShieldCheck className="mt-1 h-5 w-5 text-[var(--primary)]" />
                <div>
                  <p className="text-sm font-medium text-[var(--foreground)]">
                    Une page pensée pour donner confiance
                  </p>
                  <div className="mt-3 grid gap-3 md:grid-cols-3">
                    <div className="rounded-[1.25rem] border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-4 text-sm leading-6 text-[var(--foreground-muted)]">
                      Prestations compréhensibles avec durée et tarif.
                    </div>
                    <div className="rounded-[1.25rem] border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-4 text-sm leading-6 text-[var(--foreground-muted)]">
                      Cadre d’accueil expliqué selon la façon d’exercer.
                    </div>
                    <div className="rounded-[1.25rem] border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-4 text-sm leading-6 text-[var(--foreground-muted)]">
                      Réservation simple, claire et assistant prêt si besoin.
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-4 rounded-[1.5rem] border border-[var(--border)] bg-[var(--background-soft)] p-5">
                <div className="flex items-start gap-3">
                  <MessageSquare className="mt-1 h-5 w-5 text-[var(--primary)]" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-[var(--foreground)]">
                      Avis et retours clients
                    </p>
                    {profile.review_count > 0 ? (
                      <>
                        <p className="mt-2 text-sm leading-6 text-[var(--foreground-muted)]">
                          {profile.review_count} avis publié{profile.review_count > 1 ? "s" : ""} · note moyenne{" "}
                          {profile.review_average ? `${profile.review_average}/5` : "à venir"}
                        </p>
                        <div className="mt-4 grid gap-3">
                          {profile.reviews.slice(0, 3).map((review) => (
                            <div
                              key={review.id}
                              className="rounded-[1.2rem] border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-4"
                            >
                              <div className="flex items-center justify-between gap-3">
                                <p className="font-medium text-[var(--foreground)]">
                                  {review.author_name}
                                </p>
                                <Badge>{review.rating}/5</Badge>
                              </div>
                              <p className="mt-3 text-sm leading-6 text-[var(--foreground-muted)]">
                                {review.comment}
                              </p>
                              <p className="mt-3 text-xs uppercase tracking-[0.18em] text-[var(--foreground-subtle)]">
                                {review.verification_label}
                              </p>
                            </div>
                          ))}
                        </div>
                      </>
                    ) : (
                      <p className="mt-2 text-sm leading-6 text-[var(--foreground-muted)]">
                        Les premiers retours clients viendront bientôt renforcer la confiance autour de cette page.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          </div>

          <div className="space-y-6 lg:sticky lg:top-5 lg:self-start" id="reservation">
            <Card className="rounded-[2rem]">
              <div className="flex items-center gap-3">
                <CalendarClock className="h-5 w-5 text-[var(--primary)]" />
                <div>
                  <p className="text-xs uppercase tracking-[0.26em] text-[var(--primary)]/80">
                    Réserver
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold text-[var(--foreground)]">
                    Prendre rendez-vous en confiance
                  </h2>
                </div>
              </div>
              <p className="mt-4 text-sm leading-7 text-[var(--foreground-muted)]">
                Choisissez votre prestation, un créneau encore disponible, puis
                transmettez vos informations en quelques étapes claires.
              </p>
              {paymentProcessing ? (
                <Notice tone="info" className="mt-4">
                  Votre règlement est en cours de confirmation par le prestataire
                  de paiement. Le praticien ne voit ce montant comme encaissé
                  qu’après cette confirmation.
                </Notice>
              ) : null}
              {paymentCancelled ? (
                <Notice tone="info" className="mt-4">
                  Le règlement n’a pas été finalisé. Le créneau n’est sécurisé
                  qu’après confirmation du prestataire de paiement.
                </Notice>
              ) : null}
            </Card>

            {assistant ? (
              <PublicAssistantCard
                assistant={assistant}
                question={assistantQuestion}
                reply={assistantReply}
                loading={assistantLoading}
                error={assistantError}
                onQuestionChange={setAssistantQuestion}
                onSubmit={handleAssistantSubmit}
              />
            ) : null}

            <PublicBookingCard
              acceptsOnlineBooking={draft.acceptsOnlineBooking}
              paymentUnavailableReason={paymentUnavailableReason}
              services={services}
              slots={filteredSlots}
              selectedServiceId={selectedServiceId}
              selectedSlotId={selectedSlotId}
              bookingForm={bookingForm}
              bookingError={bookingError}
              bookingReceipt={bookingReceipt}
              paymentPreview={paymentPreview}
              submitting={submitting}
              onSelectService={setSelectedServiceId}
              onSelectSlot={setSelectedSlotId}
              onBookingFormChange={(field, value) =>
                setBookingForm((current) => ({
                  ...current,
                  [field]: value,
                }))
              }
              onSubmit={handleBookingSubmit}
            />

            <Card className="rounded-[2rem]">
              <div className="flex items-center gap-3">
                <Sparkles className="h-5 w-5 text-[var(--primary)]" />
                <div>
                  <p className="text-sm font-medium text-[var(--foreground)]">
                    Besoin d’un renseignement avant de réserver ?
                  </p>
                  <p className="mt-1 text-sm leading-6 text-[var(--foreground-muted)]">
                    Utilisez l’assistant si disponible ou contactez directement
                    le praticien.
                  </p>
                </div>
              </div>
              <div className="mt-4 space-y-3 text-sm text-[var(--foreground-muted)]">
                {profile.public_email ? (
                  <p className="inline-flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    {profile.public_email}
                  </p>
                ) : null}
                {profile.phone ? (
                  <p className="inline-flex items-center gap-2">
                    <Phone className="h-4 w-4" />
                    {profile.phone}
                  </p>
                ) : null}
                {draft.contactInformation ? (
                  <p className="leading-6">{draft.contactInformation}</p>
                ) : null}
              </div>
            </Card>
          </div>
        </div>
      </div>
    </main>
  );
}
