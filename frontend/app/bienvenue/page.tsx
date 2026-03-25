"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  CalendarPlus2,
  ChevronLeft,
  ChevronRight,
  Copy,
  Sparkles,
} from "lucide-react";

import { NuadyxLogo } from "@/components/brand/nuadyx-logo";
import { PublicProfilePreviewCard } from "@/components/public-profile/public-profile-preview-card";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FieldWrapper, Input, Select, Textarea } from "@/components/ui/field";
import { Notice } from "@/components/ui/notice";
import { Skeleton } from "@/components/ui/skeleton";
import { SwitchRow } from "@/components/ui/switch-row";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import {
  createAvailability,
  createService,
  getAssistantProfile,
  getAvailabilities,
  getDashboardProfile,
  getMe,
  getServices,
  updateAssistantProfile,
  updateDashboardProfile,
  type AssistantProfile,
  type Availability,
  type DashboardProfile,
  type Service,
} from "@/lib/api";
import { clearSession, setStoredUser } from "@/lib/auth";
import {
  activityTypeOptions,
  getProfileAwareCopy,
  getSuggestedServices,
  onboardingSteps,
  practiceModeOptions,
  type OnboardingStepKey,
} from "@/lib/onboarding";
import { rememberWelcomeNotice } from "@/lib/practitioner-space";
import { createDefaultPublicProfileDraft } from "@/lib/public-profile";
import { formatCurrency, formatDateTimeLong } from "@/lib/utils";

const ACTIVITY_HEADLINE_LIMIT = 180;

type ServiceVariantForm = {
  id: string;
  duration_minutes: number;
  price_eur: string;
};

function toLocalDateTimeInputValue(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  const hours = `${date.getHours()}`.padStart(2, "0");
  const minutes = `${date.getMinutes()}`.padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function buildDefaultSlotRange() {
  const start = new Date();
  start.setDate(start.getDate() + 1);
  start.setHours(10, 0, 0, 0);
  const end = new Date(start);
  end.setMinutes(end.getMinutes() + 60);

  return {
    start_at: toLocalDateTimeInputValue(start),
    end_at: toLocalDateTimeInputValue(end),
  };
}

function buildServiceVariant(
  duration_minutes = 60,
  price_eur = "85.00"
): ServiceVariantForm {
  return {
    id: crypto.randomUUID(),
    duration_minutes,
    price_eur,
  };
}

export default function WelcomePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<DashboardProfile | null>(null);
  const [assistant, setAssistant] = useState<AssistantProfile | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [availabilities, setAvailabilities] = useState<Availability[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [activityForm, setActivityForm] = useState({
    business_name: "",
    activity_type: "solo" as DashboardProfile["activity_type"],
    practice_mode: "studio" as DashboardProfile["practice_mode"],
    city: "",
    phone: "",
    public_headline: "",
  });
  const [activityErrors, setActivityErrors] = useState({
    business_name: "",
    public_headline: "",
  });
  const [serviceForm, setServiceForm] = useState({
    title: "",
    short_description: "",
    full_description: "",
  });
  const [serviceVariants, setServiceVariants] = useState<ServiceVariantForm[]>([
    buildServiceVariant(),
  ]);
  const [slotForm, setSlotForm] = useState({
    service: "",
    slot_type: "open" as "open" | "blocked",
    label: "",
    ...buildDefaultSlotRange(),
  });

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const me = await getMe();
        if (!active) return;

        if (me.onboarding_completed) {
          router.replace("/dashboard");
          return;
        }

        const [profileData, assistantData, servicesData, availabilitiesData] =
          await Promise.all([
            getDashboardProfile(),
            getAssistantProfile(),
            getServices(),
            getAvailabilities(),
          ]);

        if (!active) return;

        setStoredUser(me);
        setProfile(profileData);
        setAssistant(assistantData);
        setServices(servicesData);
        setAvailabilities(availabilitiesData);
        setActivityForm({
          business_name: profileData.business_name,
          activity_type: profileData.activity_type,
          practice_mode: profileData.practice_mode,
          city: profileData.city,
          phone: profileData.phone,
          public_headline: profileData.public_headline,
        });
        setError("");
      } catch {
        if (!active) return;
        clearSession();
        router.replace("/login");
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
  }, [router]);

  const activeStep = (profile?.onboarding_step ?? "welcome") as OnboardingStepKey;
  const activeStepIndex = onboardingSteps.findIndex((step) => step.key === activeStep);
  const progressPercent =
    activeStepIndex >= 0
      ? Math.round(((activeStepIndex + 1) / onboardingSteps.length) * 100)
      : 0;

  const contextualCopy = useMemo(
    () =>
      profile
        ? getProfileAwareCopy(profile)
        : {
            activityHint: "",
            settingHint: "",
          },
    [profile]
  );

  const publicDraft = useMemo(() => {
    if (!profile) {
      return null;
    }

    const publicServices = services.map((service) => ({
      id: service.id,
      professional_slug: profile.slug,
      professional_name: profile.business_name,
      title: service.title,
      short_description: service.short_description,
      full_description: service.full_description,
      duration_minutes: service.duration_minutes,
      price_eur: service.price_eur,
    }));

    return createDefaultPublicProfileDraft(profile, publicServices);
  }, [profile, services]);

  const suggestedServices = useMemo(
    () => (profile ? getSuggestedServices(profile) : []),
    [profile]
  );

  async function patchProfile(fields: Record<string, string | boolean>) {
    const payload = new FormData();
    Object.entries(fields).forEach(([key, value]) => {
      payload.append(key, String(value));
    });
    const updatedProfile = await updateDashboardProfile(payload);
    setProfile(updatedProfile);
    return updatedProfile;
  }

  async function refreshProfileData() {
    const [profileData, servicesData, availabilitiesData] = await Promise.all([
      getDashboardProfile(),
      getServices(),
      getAvailabilities(),
    ]);
    setProfile(profileData);
    setServices(servicesData);
    setAvailabilities(availabilitiesData);
  }

  async function handleAdvance(nextStep: OnboardingStepKey) {
    try {
      setSaving(true);
      setError("");
      await patchProfile({ onboarding_step: nextStep });
      setNotice("Étape enregistrée.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible d’avancer.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveActivity(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!profile) return;
    const nextErrors = {
      business_name: "",
      public_headline: "",
    };

    if (!activityForm.business_name.trim()) {
      nextErrors.business_name = "Renseignez le nom visible de votre activité.";
    }

    if (activityForm.public_headline.length > ACTIVITY_HEADLINE_LIMIT) {
      nextErrors.public_headline =
        "Utilisez une phrase plus courte: 180 caractères maximum.";
    }

    setActivityErrors(nextErrors);
    if (nextErrors.business_name || nextErrors.public_headline) {
      return;
    }

    try {
      setSaving(true);
      setError("");
      await patchProfile({
        business_name: activityForm.business_name,
        activity_type: activityForm.activity_type,
        practice_mode: activityForm.practice_mode,
        city: activityForm.city,
        phone: activityForm.phone,
        public_headline: activityForm.public_headline,
        onboarding_step: "services",
      });
      setNotice("Votre activité a été enregistrée.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible d’enregistrer votre activité.");
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateService(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      setSaving(true);
      setError("");
      await Promise.all(
        serviceVariants.map((variant, index) =>
          createService({
            ...serviceForm,
            duration_minutes: variant.duration_minutes,
            price_eur: variant.price_eur,
            sort_order: services.length + index,
          })
        )
      );
      setServiceForm({
        title: "",
        short_description: "",
        full_description: "",
      });
      setServiceVariants([buildServiceVariant()]);
      await refreshProfileData();
      setNotice("Votre soin a été ajouté avec ses différentes durées.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible d’ajouter ce soin.");
    } finally {
      setSaving(false);
    }
  }

  async function handleAddSuggestedService(index: number) {
    const suggestion = suggestedServices[index];
    if (!suggestion) return;

    try {
      setSaving(true);
      setError("");
      await createService({
        ...suggestion,
        full_description: suggestion.short_description,
        sort_order: services.length,
      });
      await refreshProfileData();
      setNotice(`“${suggestion.title}” a été ajouté à vos prestations.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible d’ajouter cette suggestion.");
    } finally {
      setSaving(false);
    }
  }

  async function handleContinueServices() {
    try {
      setSaving(true);
      setError("");
      await patchProfile({ onboarding_step: "setting" });
      setNotice("Vos prestations sont prêtes.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de continuer.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveSetting(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!assistant) return;

    const formData = new FormData(event.currentTarget);

    try {
      setSaving(true);
      setError("");
      await Promise.all([
        patchProfile({
          public_headline: String(formData.get("public_headline") || ""),
          phone: String(formData.get("phone") || ""),
          public_email: String(formData.get("public_email") || ""),
          accepts_online_booking: formData.get("accepts_online_booking") === "true",
          onboarding_step: "slots",
        }),
        updateAssistantProfile({
          activity_overview: String(formData.get("activity_overview") || ""),
          practice_information: String(formData.get("practice_information") || ""),
          before_session: String(formData.get("before_session") || ""),
          after_session: String(formData.get("after_session") || ""),
          booking_policy: String(formData.get("booking_policy") || ""),
          contact_information: String(formData.get("contact_information") || ""),
          welcome_message: String(formData.get("welcome_message") || ""),
          assistant_enabled: assistant.assistant_enabled,
          public_assistant_enabled: assistant.public_assistant_enabled,
          response_tone: assistant.response_tone,
        }),
      ]);
      setNotice("Votre cadre d’accueil a été enregistré.");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Impossible d’enregistrer ces informations."
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateSlot(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      setSaving(true);
      setError("");
      await createAvailability({
        service: slotForm.slot_type === "blocked" ? null : slotForm.service || null,
        start_at: slotForm.start_at,
        end_at: slotForm.end_at,
        slot_type: slotForm.slot_type,
        label: slotForm.slot_type === "blocked" ? slotForm.label : "",
        is_active: true,
      });
      setSlotForm({
        service: "",
        slot_type: "open",
        label: "",
        ...buildDefaultSlotRange(),
      });
      await refreshProfileData();
      setNotice("Votre créneau a été ajouté.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible d’ajouter ce créneau.");
    } finally {
      setSaving(false);
    }
  }

  async function handleContinueSlots() {
    try {
      setSaving(true);
      setError("");
      await patchProfile({ onboarding_step: "ready" });
      setNotice("Votre page est presque prête.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de continuer.");
    } finally {
      setSaving(false);
    }
  }

  async function completeOnboarding(openProfileFirst = false) {
    if (!profile) return;

    let previewWindow: Window | null = null;
    if (openProfileFirst) {
      previewWindow = window.open("", "_blank", "noopener,noreferrer");
    }

    try {
      setSaving(true);
      setError("");
      await patchProfile({
        onboarding_step: "ready",
        onboarding_completed: true,
        is_public: true,
      });
      const me = await getMe();
      setStoredUser(me);
      rememberWelcomeNotice(
        "Il ne vous reste plus qu’à présenter vos soins, ouvrir vos créneaux et découvrir votre page comme un client."
      );

      if (previewWindow) {
        previewWindow.location.href = `${window.location.origin}/${profile.slug}`;
        router.push("/dashboard");
      } else {
        router.push("/dashboard");
      }
    } catch (err) {
      previewWindow?.close();
      setError(
        err instanceof Error
          ? err.message
          : "Impossible de finaliser votre espace praticien."
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleCopyPublicLink() {
    if (!profile) return;
    await navigator.clipboard.writeText(`${window.location.origin}/${profile.slug}`);
    setNotice("Lien public copié.");
  }

  async function handleGoBack() {
    if (activeStepIndex <= 0) {
      return;
    }

    const previousStep = onboardingSteps[activeStepIndex - 1];
    if (!previousStep) {
      return;
    }

    try {
      setSaving(true);
      setError("");
      await patchProfile({ onboarding_step: previousStep.key });
      setNotice("Vous pouvez reprendre l’étape précédente.");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Impossible de revenir à l’étape précédente."
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen px-4 py-6 md:px-6">
        <div className="mx-auto max-w-6xl space-y-4">
          <Skeleton className="h-24 rounded-[2rem]" />
          <Skeleton className="h-[42rem] rounded-[2rem]" />
        </div>
      </main>
    );
  }

  if (!profile || !assistant) {
    return null;
  }

  return (
    <main className="min-h-screen px-4 py-6 text-[var(--foreground)] md:px-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="glass-panel rounded-[2rem] px-5 py-5 md:px-6">
          <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
            <div className="flex items-start gap-4">
              <NuadyxLogo showText priority className="shrink-0" />
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-[var(--primary)]/80">
                  Bienvenue
                </p>
                <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[var(--foreground)]">
                  Votre espace praticien prend forme
                </h1>
                <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--foreground-muted)]">
                  En quelques étapes, nous allons préparer votre espace, votre
                  page publique et vos premiers créneaux.
                </p>
              </div>
            </div>

            <ThemeToggle />
          </div>

          <div className="mt-6">
            <div className="flex items-center justify-between gap-4 text-sm">
              <span className="text-[var(--foreground-muted)]">
                Progression de votre mise en route
              </span>
              <span className="font-medium text-[var(--foreground)]">
                {progressPercent}%
              </span>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--surface-muted)]">
              <div
                className="h-full rounded-full bg-[linear-gradient(135deg,var(--primary),var(--accent))]"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
              {onboardingSteps.map((step, index) => (
                <div
                  key={step.key}
                  className={
                    index <= activeStepIndex
                      ? "rounded-[1.2rem] border border-[var(--primary)]/28 bg-[var(--surface-muted)] px-3 py-3 text-sm text-[var(--foreground)]"
                      : "rounded-[1.2rem] border border-[var(--border)] bg-[var(--background-soft)] px-3 py-3 text-sm text-[var(--foreground-subtle)]"
                  }
                >
                  {step.label}
                </div>
              ))}
            </div>
          </div>
        </header>

        {error ? <Notice tone="error">{error}</Notice> : null}
        {notice ? <Notice tone="success">{notice}</Notice> : null}
        {activeStep === "welcome" ? (
          <Notice tone="info">
            Votre espace praticien est prêt. Il ne vous reste plus qu’à
            présenter vos soins, ouvrir vos créneaux et découvrir votre page
            comme un client.
          </Notice>
        ) : null}

        {activeStep === "welcome" ? (
          <Card className="rounded-[2rem] p-6 md:p-8">
            <p className="text-xs uppercase tracking-[0.28em] text-[var(--primary)]/80">
              Étape 1
            </p>
            <h2 className="mt-4 text-4xl font-semibold tracking-tight text-[var(--foreground)]">
              Bienvenue dans votre espace praticien
            </h2>
            <p className="mt-4 max-w-2xl text-base leading-8 text-[var(--foreground-muted)]">
              En quelques étapes, nous allons préparer votre espace, votre page
              publique et vos premiers créneaux.
            </p>
            <div className="mt-8 grid gap-4 md:grid-cols-3">
              {[
                "Présentez votre activité de manière claire et rassurante.",
                "Ajoutez vos premiers soins sans jargon technique.",
                "Ouvrez vos premiers créneaux et découvrez votre page côté client.",
              ].map((item) => (
                <div
                  key={item}
                  className="rounded-[1.5rem] border border-[var(--border)] bg-[var(--surface-muted)] p-4 text-sm leading-7 text-[var(--foreground-muted)]"
                >
                  {item}
                </div>
              ))}
            </div>
            <div className="mt-8">
              <Button
                size="lg"
                onClick={() => void handleAdvance("activity")}
                disabled={saving}
                iconRight={<ChevronRight className="h-4 w-4" />}
              >
                Commencer
              </Button>
            </div>
          </Card>
        ) : null}

        {activeStep === "activity" ? (
          <Card className="rounded-[2rem] p-6 md:p-8">
            <p className="text-xs uppercase tracking-[0.28em] text-[var(--primary)]/80">
              Étape 2
            </p>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight text-[var(--foreground)]">
              Votre activité
            </h2>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-[var(--foreground-muted)]">
              {contextualCopy.activityHint}
            </p>

            <form onSubmit={handleSaveActivity} className="mt-8 grid gap-5">
              <div className="grid gap-5 md:grid-cols-2">
                <FieldWrapper label="Type d’activité">
                  <Select
                    name="activity_type"
                    value={activityForm.activity_type}
                    onChange={(event) =>
                      setActivityForm((current) => ({
                        ...current,
                        activity_type: event.target.value as DashboardProfile["activity_type"],
                      }))
                    }
                  >
                    {activityTypeOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </Select>
                </FieldWrapper>

                <FieldWrapper label="Façon d’exercer">
                  <Select
                    name="practice_mode"
                    value={activityForm.practice_mode}
                    onChange={(event) =>
                      setActivityForm((current) => ({
                        ...current,
                        practice_mode: event.target.value as DashboardProfile["practice_mode"],
                      }))
                    }
                  >
                    {practiceModeOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </Select>
                </FieldWrapper>
              </div>

              <div className="grid gap-5 md:grid-cols-2">
                <FieldWrapper label="Ville principale">
                  <Input
                    name="city"
                    value={activityForm.city}
                    onChange={(event) =>
                      setActivityForm((current) => ({
                        ...current,
                        city: event.target.value,
                      }))
                    }
                    required
                  />
                </FieldWrapper>

                <FieldWrapper label="Téléphone professionnel" hint="Optionnel">
                  <Input
                    name="phone"
                    value={activityForm.phone}
                    onChange={(event) =>
                      setActivityForm((current) => ({
                        ...current,
                        phone: event.target.value,
                      }))
                    }
                  />
                </FieldWrapper>
              </div>

              <FieldWrapper label="Nom affiché">
                <Input
                  name="business_name"
                  value={activityForm.business_name}
                  onChange={(event) => {
                    setActivityErrors((current) => ({ ...current, business_name: "" }));
                    setActivityForm((current) => ({
                      ...current,
                      business_name: event.target.value,
                    }));
                  }}
                  required
                />
              </FieldWrapper>
              {activityErrors.business_name ? (
                <p className="-mt-3 text-sm text-[var(--danger)]">
                  {activityErrors.business_name}
                </p>
              ) : null}

              <FieldWrapper label="Phrase courte d’accroche" hint="Optionnel">
                <Textarea
                  name="public_headline"
                  value={activityForm.public_headline}
                  rows={4}
                  className="min-h-[132px]"
                  onChange={(event) => {
                    const value = event.target.value;
                    setActivityErrors((current) => ({
                      ...current,
                      public_headline:
                        value.length > ACTIVITY_HEADLINE_LIMIT
                          ? "Utilisez une phrase plus courte: 180 caractères maximum."
                          : "",
                    }));
                    setActivityForm((current) => ({
                      ...current,
                      public_headline: value,
                    }));
                  }}
                  placeholder="Massage et bien-être sur rendez-vous"
                />
              </FieldWrapper>
              <div className="-mt-3 flex items-start justify-between gap-4 text-sm">
                <p className="text-[var(--danger)]">
                  {activityErrors.public_headline || ""}
                </p>
                <p className="shrink-0 text-[var(--foreground-subtle)]">
                  {activityForm.public_headline.length}/{ACTIVITY_HEADLINE_LIMIT}
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
                <Button
                  type="button"
                  variant="ghost"
                  size="lg"
                  disabled={saving}
                  onClick={() => void handleGoBack()}
                  iconLeft={<ChevronLeft className="h-4 w-4" />}
                >
                  Revenir en arrière
                </Button>
                <Button
                  type="submit"
                  size="lg"
                  disabled={saving}
                  iconRight={<ChevronRight className="h-4 w-4" />}
                >
                  Enregistrer et continuer
                </Button>
              </div>
            </form>
          </Card>
        ) : null}

        {activeStep === "services" ? (
          <div className="grid gap-4 xl:grid-cols-[1.02fr_0.98fr]">
            <Card className="rounded-[2rem] p-6 md:p-8">
              <p className="text-xs uppercase tracking-[0.28em] text-[var(--primary)]/80">
                Étape 3
              </p>
              <h2 className="mt-4 text-3xl font-semibold tracking-tight text-[var(--foreground)]">
                Présentez vos soins
              </h2>
              <p className="mt-4 text-sm leading-7 text-[var(--foreground-muted)]">
                Ajoutez une à trois premières prestations. Vous pourrez affiner
                leur présentation ensuite.
              </p>

              <div className="mt-6 grid gap-3">
                {suggestedServices.map((service, index) => (
                  <button
                    key={service.title}
                    type="button"
                    onClick={() => void handleAddSuggestedService(index)}
                    className="rounded-[1.5rem] border border-[var(--border)] bg-[var(--background-soft)] px-4 py-4 text-left hover:border-[var(--border-strong)] hover:bg-[var(--surface-muted)]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-base font-semibold text-[var(--foreground)]">
                          {service.title}
                        </p>
                        <p className="mt-2 text-sm leading-6 text-[var(--foreground-muted)]">
                          {service.short_description}
                        </p>
                      </div>
                      <div className="rounded-[1rem] border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2 text-right text-sm text-[var(--foreground)]">
                        <div>{formatCurrency(service.price_eur)}</div>
                        <div className="text-xs text-[var(--foreground-subtle)]">
                          {service.duration_minutes} min
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>

              <form onSubmit={handleCreateService} className="mt-8 grid gap-4">
                <FieldWrapper label="Nom du soin">
                  <Input
                    value={serviceForm.title}
                    onChange={(event) =>
                      setServiceForm((current) => ({
                        ...current,
                        title: event.target.value,
                      }))
                    }
                    required
                  />
                </FieldWrapper>

                <FieldWrapper label="Description courte">
                  <Input
                    value={serviceForm.short_description}
                    onChange={(event) =>
                      setServiceForm((current) => ({
                        ...current,
                        short_description: event.target.value,
                      }))
                    }
                    required
                  />
                </FieldWrapper>

                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-[var(--foreground)]">
                        Durées et tarifs
                      </p>
                      <p className="mt-1 text-sm text-[var(--foreground-muted)]">
                        Tu peux proposer plusieurs formats pour un même soin.
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        setServiceVariants((current) => [
                          ...current,
                          buildServiceVariant(),
                        ])
                      }
                    >
                      Ajouter une durée
                    </Button>
                  </div>

                  {serviceVariants.map((variant, index) => (
                    <div
                      key={variant.id}
                      className="grid gap-4 rounded-[1.4rem] border border-[var(--border)] bg-[var(--background-soft)] p-4 md:grid-cols-[1fr_1fr_auto]"
                    >
                      <FieldWrapper label={`Durée ${index + 1}`}>
                        <Input
                          type="number"
                          min={15}
                          step={15}
                          value={variant.duration_minutes}
                          onChange={(event) =>
                            setServiceVariants((current) =>
                              current.map((item) =>
                                item.id === variant.id
                                  ? {
                                      ...item,
                                      duration_minutes: Number(event.target.value || 0),
                                    }
                                  : item
                              )
                            )
                          }
                          required
                        />
                      </FieldWrapper>

                      <FieldWrapper label="Tarif">
                        <Input
                          type="number"
                          min={0}
                          step="0.01"
                          value={variant.price_eur}
                          onChange={(event) =>
                            setServiceVariants((current) =>
                              current.map((item) =>
                                item.id === variant.id
                                  ? { ...item, price_eur: event.target.value }
                                  : item
                              )
                            )
                          }
                          required
                        />
                      </FieldWrapper>

                      <div className="flex items-end">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={serviceVariants.length === 1}
                          onClick={() =>
                            setServiceVariants((current) =>
                              current.filter((item) => item.id !== variant.id)
                            )
                          }
                        >
                          Retirer
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>

                <FieldWrapper label="Description complémentaire" hint="Optionnel">
                  <Textarea
                    value={serviceForm.full_description}
                    onChange={(event) =>
                      setServiceForm((current) => ({
                        ...current,
                        full_description: event.target.value,
                      }))
                    }
                  />
                </FieldWrapper>

                <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <Button
                      type="button"
                      variant="ghost"
                      size="lg"
                      disabled={saving}
                      onClick={() => void handleGoBack()}
                      iconLeft={<ChevronLeft className="h-4 w-4" />}
                    >
                      Revenir en arrière
                    </Button>
                    <Button
                      type="submit"
                      variant="secondary"
                      size="lg"
                      disabled={saving}
                      iconLeft={<Sparkles className="h-4 w-4" />}
                    >
                      Ajouter ce soin
                    </Button>
                  </div>
                  <Button
                    type="button"
                    size="lg"
                    disabled={saving || services.length === 0}
                    onClick={() => void handleContinueServices()}
                    iconRight={<ChevronRight className="h-4 w-4" />}
                  >
                    Continuer
                  </Button>
                </div>
              </form>
            </Card>

            <Card className="rounded-[2rem] p-6 md:p-8">
              <p className="text-sm font-medium text-[var(--foreground)]">
                Vos soins déjà prêts
              </p>
              {services.length === 0 ? (
                <p className="mt-4 text-sm leading-7 text-[var(--foreground-muted)]">
                  Ajoutez au moins un soin pour préparer votre page publique et
                  votre prise de rendez-vous.
                </p>
              ) : (
                <div className="mt-6 space-y-3">
                  {services.map((service) => (
                    <div
                      key={service.id}
                      className="rounded-[1.4rem] border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-4"
                    >
                      <p className="text-base font-semibold text-[var(--foreground)]">
                        {service.title}
                      </p>
                      <p className="mt-2 text-sm leading-6 text-[var(--foreground-muted)]">
                        {service.short_description}
                      </p>
                      <p className="mt-3 text-sm text-[var(--foreground-subtle)]">
                        {service.duration_minutes} min · {formatCurrency(service.price_eur)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        ) : null}

        {activeStep === "setting" ? (
          <Card className="rounded-[2rem] p-6 md:p-8">
            <p className="text-xs uppercase tracking-[0.28em] text-[var(--primary)]/80">
              Étape 4
            </p>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight text-[var(--foreground)]">
              Rassurez vos futurs clients
            </h2>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-[var(--foreground-muted)]">
              {contextualCopy.settingHint}
            </p>
            <div className="mt-6 grid gap-3 md:grid-cols-3">
              {[
                "Pour un nouveau client, un acompte peut éviter les rendez-vous non honorés.",
                "Pour un client de confiance, vous pourrez plus tard autoriser une réservation sans acompte.",
                "Des conditions d’annulation simples et humaines rassurent sans durcir la relation.",
              ].map((item) => (
                <div
                  key={item}
                  className="rounded-[1.2rem] border border-[var(--border)] bg-[var(--background-soft)] px-4 py-4 text-sm leading-6 text-[var(--foreground-muted)]"
                >
                  {item}
                </div>
              ))}
            </div>

            <form onSubmit={handleSaveSetting} className="mt-8 grid gap-5">
              <div className="grid gap-5 md:grid-cols-2">
                <FieldWrapper label="Téléphone professionnel">
                  <Input name="phone" defaultValue={profile.phone} />
                </FieldWrapper>
                <FieldWrapper label="Email de contact">
                  <Input name="public_email" defaultValue={profile.public_email} />
                </FieldWrapper>
              </div>

              <FieldWrapper label="Accroche visible">
                <Input
                  name="public_headline"
                  defaultValue={profile.public_headline}
                  placeholder="Massage et bien-être sur rendez-vous"
                />
              </FieldWrapper>

              <FieldWrapper label="Présenter mon activité">
                <Textarea
                  name="activity_overview"
                  defaultValue={assistant.activity_overview}
                  placeholder="Décrivez votre approche, votre manière d’accompagner et le type d’expérience que vous souhaitez offrir."
                />
              </FieldWrapper>

              <FieldWrapper label="Cadre d’accueil">
                <Textarea
                  name="practice_information"
                  defaultValue={assistant.practice_information}
                  placeholder="Décrivez le lieu, l’ambiance, l’accessibilité, votre zone desservie ou vos conditions de déplacement."
                />
              </FieldWrapper>

              <div className="grid gap-5 md:grid-cols-2">
                <FieldWrapper label="Avant la séance">
                  <Textarea
                    name="before_session"
                    defaultValue={assistant.before_session}
                    placeholder="Ce que le client doit prévoir avant de venir ou avant votre déplacement."
                  />
                </FieldWrapper>

                <FieldWrapper label="Après la séance">
                  <Textarea
                    name="after_session"
                    defaultValue={assistant.after_session}
                    placeholder="Conseils simples après la séance, récupération, hydratation, repos..."
                  />
                </FieldWrapper>
              </div>

              <div className="grid gap-5 md:grid-cols-2">
                <FieldWrapper label="Réservation et annulation">
                  <Textarea
                    name="booking_policy"
                    defaultValue={assistant.booking_policy}
                    placeholder="Expliquez simplement votre politique de réservation, d’annulation ou de retard."
                  />
                </FieldWrapper>
                <FieldWrapper label="Informations utiles à transmettre">
                  <Textarea
                    name="contact_information"
                    defaultValue={assistant.contact_information}
                    placeholder="Code d’entrée, étage, zone desservie, matériel fourni, horaires de réponse..."
                  />
                </FieldWrapper>
              </div>

              <FieldWrapper label="Message d’accueil de votre assistant">
                <Input
                  name="welcome_message"
                  defaultValue={assistant.welcome_message}
                  placeholder="Bonjour, je peux vous aider à choisir un soin ou à réserver."
                />
              </FieldWrapper>

              <input
                type="hidden"
                name="accepts_online_booking"
                value={profile.accepts_online_booking ? "true" : "false"}
              />

              <SwitchRow
                label="Rendre la réservation disponible"
                description="Les clients pourront envoyer une demande de rendez-vous depuis votre page publique."
                checked={profile.accepts_online_booking}
                onCheckedChange={(checked) =>
                  setProfile((current) =>
                    current
                      ? { ...current, accepts_online_booking: checked }
                      : current
                  )
                }
              />

              <div className="flex justify-end">
                <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:w-full">
                  <Button
                    type="button"
                    variant="ghost"
                    size="lg"
                    disabled={saving}
                    onClick={() => void handleGoBack()}
                    iconLeft={<ChevronLeft className="h-4 w-4" />}
                  >
                    Revenir en arrière
                  </Button>
                  <Button
                    type="submit"
                    size="lg"
                    disabled={saving}
                    iconRight={<ChevronRight className="h-4 w-4" />}
                  >
                    Enregistrer et continuer
                  </Button>
                </div>
              </div>
            </form>
          </Card>
        ) : null}

        {activeStep === "slots" ? (
          <div className="grid gap-4 xl:grid-cols-[1.02fr_0.98fr]">
            <Card className="rounded-[2rem] p-6 md:p-8">
              <p className="text-xs uppercase tracking-[0.28em] text-[var(--primary)]/80">
                Étape 5
              </p>
              <h2 className="mt-4 text-3xl font-semibold tracking-tight text-[var(--foreground)]">
                Ouvrez vos premiers créneaux
              </h2>
              <p className="mt-4 text-sm leading-7 text-[var(--foreground-muted)]">
                Ajoutez quelques disponibilités réelles. Vous pourrez ensuite
                enrichir votre agenda jour par jour.
              </p>

              <form onSubmit={handleCreateSlot} className="mt-8 grid gap-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <FieldWrapper label="Type de plage">
                    <Select
                      value={slotForm.slot_type}
                      onChange={(event) =>
                        setSlotForm((current) => ({
                          ...current,
                          slot_type: event.target.value as "open" | "blocked",
                          service: event.target.value === "blocked" ? "" : current.service,
                        }))
                      }
                    >
                      <option value="open">Créneau réservable</option>
                      <option value="blocked">Plage bloquée</option>
                    </Select>
                  </FieldWrapper>

                  {slotForm.slot_type === "open" ? (
                    <FieldWrapper label="Soin lié">
                      <Select
                        value={slotForm.service}
                        onChange={(event) =>
                          setSlotForm((current) => ({
                            ...current,
                            service: event.target.value,
                          }))
                        }
                      >
                        <option value="">Tous mes soins</option>
                        {services.map((service) => (
                          <option key={service.id} value={service.id}>
                            {service.title}
                          </option>
                        ))}
                      </Select>
                    </FieldWrapper>
                  ) : (
                    <FieldWrapper label="Nom de la plage" hint="Optionnel">
                      <Input
                        value={slotForm.label}
                        onChange={(event) =>
                          setSlotForm((current) => ({
                            ...current,
                            label: event.target.value,
                          }))
                        }
                        placeholder="Pause, déplacement, fermeture..."
                      />
                    </FieldWrapper>
                  )}
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <FieldWrapper label="Début">
                    <Input
                      type="datetime-local"
                      value={slotForm.start_at}
                      onChange={(event) =>
                        setSlotForm((current) => ({
                          ...current,
                          start_at: event.target.value,
                        }))
                      }
                    />
                  </FieldWrapper>
                  <FieldWrapper label="Fin">
                    <Input
                      type="datetime-local"
                      value={slotForm.end_at}
                      onChange={(event) =>
                        setSlotForm((current) => ({
                          ...current,
                          end_at: event.target.value,
                        }))
                      }
                    />
                  </FieldWrapper>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <Button
                      type="button"
                      variant="ghost"
                      size="lg"
                      disabled={saving}
                      onClick={() => void handleGoBack()}
                      iconLeft={<ChevronLeft className="h-4 w-4" />}
                    >
                      Revenir en arrière
                    </Button>
                    <Button
                      type="submit"
                      variant="secondary"
                      size="lg"
                      disabled={saving}
                      iconLeft={<CalendarPlus2 className="h-4 w-4" />}
                    >
                      Ajouter ce créneau
                    </Button>
                  </div>
                  <Button
                    type="button"
                    size="lg"
                    disabled={saving || availabilities.length === 0}
                    onClick={() => void handleContinueSlots()}
                    iconRight={<ChevronRight className="h-4 w-4" />}
                  >
                    Continuer
                  </Button>
                </div>
              </form>
            </Card>

            <Card className="rounded-[2rem] p-6 md:p-8">
              <p className="text-sm font-medium text-[var(--foreground)]">
                Vos premiers créneaux
              </p>
              {availabilities.length === 0 ? (
                <p className="mt-4 text-sm leading-7 text-[var(--foreground-muted)]">
                  Ouvrez au moins un créneau pour rendre votre page vivante dès
                  la fin de l’accompagnement.
                </p>
              ) : (
                <div className="mt-6 space-y-3">
                  {availabilities.slice(0, 6).map((slot) => (
                    <div
                      key={slot.id}
                      className="rounded-[1.4rem] border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-4"
                    >
                      <p className="text-base font-semibold text-[var(--foreground)]">
                        {slot.slot_type === "blocked"
                          ? slot.label || "Plage bloquée"
                          : slot.service_title || "Créneau ouvert"}
                      </p>
                      <p className="mt-2 text-sm text-[var(--foreground-muted)]">
                        {formatDateTimeLong(slot.start_at)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        ) : null}

        {activeStep === "ready" ? (
          <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
            <Card className="rounded-[2rem] p-6 md:p-8">
              <p className="text-xs uppercase tracking-[0.28em] text-[var(--primary)]/80">
                Étape 6
              </p>
              <h2 className="mt-4 text-4xl font-semibold tracking-tight text-[var(--foreground)]">
                Votre page est prête
              </h2>
              <p className="mt-4 text-base leading-8 text-[var(--foreground-muted)]">
                Votre espace praticien est en place. Vous avez déjà une page
                publique, vos premiers soins et vos premiers créneaux.
              </p>

              <div className="mt-8 grid gap-3">
                {[
                  `${services.length} prestation(s) prête(s) à être présentée(s)`,
                  `${availabilities.length} créneau(x) enregistré(s) dans votre agenda`,
                  `${profile.accepts_online_booking ? "Réservation en ligne disponible" : "Réservation en ligne désactivée pour l’instant"}`,
                  "Vous pourrez maintenant connecter votre compte de paiement et préparer vos premiers avis clients.",
                ].map((item) => (
                  <div
                    key={item}
                    className="rounded-[1.4rem] border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-4 text-sm text-[var(--foreground-muted)]"
                  >
                    {item}
                  </div>
                ))}
              </div>

              <div className="mt-8 flex flex-col gap-3">
                <Button
                  variant="ghost"
                  size="lg"
                  disabled={saving}
                  onClick={() => void handleGoBack()}
                  iconLeft={<ChevronLeft className="h-4 w-4" />}
                >
                  Revenir en arrière
                </Button>
                <Button
                  size="lg"
                  disabled={saving}
                  onClick={() => void completeOnboarding(true)}
                  iconRight={<ArrowRight className="h-4 w-4" />}
                >
                  Voir mon profil en tant que client
                </Button>
                <Button
                  variant="secondary"
                  size="lg"
                  disabled={saving}
                  onClick={() => void completeOnboarding(false)}
                >
                  Accéder à mon espace praticien
                </Button>
                <Button
                  variant="ghost"
                  size="lg"
                  onClick={() => void handleCopyPublicLink()}
                  iconLeft={<Copy className="h-4 w-4" />}
                >
                  Copier mon lien public
                </Button>
              </div>
            </Card>

            {publicDraft ? (
              <PublicProfilePreviewCard
                slug={profile.slug}
                draft={publicDraft}
                onCopyLink={() => void handleCopyPublicLink()}
              />
            ) : null}
          </div>
        ) : null}

        <div className="rounded-[1.5rem] border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-4 text-sm text-[var(--foreground-muted)]">
          Vous pourrez ensuite retrouver votre page publique, vos soins, votre
          agenda et votre assistant dans votre espace praticien.
          {profile.slug ? (
            <>
              {" "}
              <Link
                href={`/${profile.slug}`}
                target="_blank"
                className="font-medium text-[var(--primary)]"
              >
                Voir mon profil en tant que client
              </Link>
            </>
          ) : null}
        </div>
      </div>
    </main>
  );
}
