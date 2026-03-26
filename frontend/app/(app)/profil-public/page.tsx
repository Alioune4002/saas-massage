/* eslint-disable @next/next/no-img-element */

"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ImagePlus, Sparkles } from "lucide-react";

import { PublicProfilePreviewCard } from "@/components/public-profile/public-profile-preview-card";
import { ThemeChoiceCard } from "@/components/public-profile/theme-choice-card";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { FieldWrapper, Input, Select, Textarea } from "@/components/ui/field";
import { Notice } from "@/components/ui/notice";
import { SectionHeading } from "@/components/ui/section-heading";
import { Skeleton } from "@/components/ui/skeleton";
import { SwitchRow } from "@/components/ui/switch-row";
import {
  getDashboardProfile,
  getServices,
  updateDashboardProfile,
  type DashboardProfile,
  type PublicService,
} from "@/lib/api";
import {
  activityTypeOptions,
  getProfileAwareCopy,
  practiceModeOptions,
} from "@/lib/onboarding";
import {
  buildPublicProfileUrl,
  createDefaultPublicProfileDraft,
  publicProfileThemes,
  type PublicProfileDraft,
} from "@/lib/public-profile";

export default function PublicProfileSettingsPage() {
  const [profile, setProfile] = useState<DashboardProfile | null>(null);
  const [services, setServices] = useState<PublicService[]>([]);
  const [draft, setDraft] = useState<PublicProfileDraft | null>(null);
  const [defaultDraft, setDefaultDraft] = useState<PublicProfileDraft | null>(null);
  const [profilePhotoFile, setProfilePhotoFile] = useState<File | null>(null);
  const [coverPhotoFile, setCoverPhotoFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        setLoading(true);
        const [profileData, servicesData] = await Promise.all([
          getDashboardProfile(),
          getServices(),
        ]);

        if (!active) {
          return;
        }

        const publicServices: PublicService[] = servicesData.map((service) => ({
          id: service.id,
          professional_slug: profileData.slug,
          professional_name: profileData.business_name,
          title: service.title,
          short_description: service.short_description,
          full_description: service.full_description,
          service_category: service.service_category,
          duration_minutes: service.duration_minutes,
          price_eur: service.price_eur,
        }));

        const defaultDraft = createDefaultPublicProfileDraft(
          profileData,
          publicServices
        );
        setProfile(profileData);
        setServices(publicServices);
        setDefaultDraft(defaultDraft);
        setDraft(defaultDraft);
        setError("");
      } catch (err) {
        if (!active) {
          return;
        }

        setError(
          err instanceof Error
            ? err.message
            : "Impossible de charger le profil public."
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

  const publicUrl = useMemo(
    () => (profile ? buildPublicProfileUrl(profile.slug) : ""),
    [profile]
  );
  const isVerifiedForPayments = Boolean(profile?.verification?.badge_is_active);
  const allowedDepositOptions = useMemo(
    () => (isVerifiedForPayments ? ["20.00", "30.00", "50.00"] : ["20.00"]),
    [isVerifiedForPayments]
  );
  const contextualCopy = useMemo(
    () => {
      if (!draft) {
        return {
          activityHint: "",
          settingHint: "",
        };
      }

      return getProfileAwareCopy({
        activity_type: draft.activityType,
        practice_mode: draft.practiceMode,
      });
    },
    [draft]
  );
  const rankingChecklist = useMemo(() => {
    const signals = profile?.ranking_signals?.completeness_signals;
    if (!signals) {
      return [];
    }

    const labels: Array<[keyof typeof signals, string]> = [
      ["bio", "Ajouter une présentation claire"],
      ["headline", "Renseigner une accroche visible"],
      ["city", "Préciser la ville principale"],
      ["photos", "Ajouter une photo de profil ou de couverture"],
      ["services", "Publier au moins une prestation"],
      ["availabilities", "Ouvrir des créneaux"],
      ["specialties", "Renseigner vos spécialités"],
      ["contact", "Ajouter un contact public"],
      ["booking_rules", "Expliquer vos règles de réservation"],
    ];

    return labels
      .filter(([key]) => !signals[key])
      .map(([, label]) => label)
      .slice(0, 4);
  }, [profile]);

  async function handleCopyLink() {
    if (!publicUrl) {
      return;
    }

    await navigator.clipboard.writeText(publicUrl);
    setNotice("Lien public copié.");
  }

  async function handleSaveDraft() {
    if (!profile || !draft) {
      return;
    }

    try {
      setSaving(true);
      setError("");

      const payload = new FormData();
      payload.append("business_name", draft.displayName);
      payload.append("slug", draft.slug);
      payload.append("owner_first_name", profile.owner_first_name);
      payload.append("owner_last_name", profile.owner_last_name);
      payload.append("login_email", profile.login_email);
      payload.append("activity_type", draft.activityType);
      payload.append("practice_mode", draft.practiceMode);
      payload.append("city", draft.city);
      payload.append("service_area", draft.serviceArea);
      payload.append("venue_details", draft.venueDetails);
      payload.append("access_details", draft.accessDetails);
      payload.append("ambience_details", draft.ambienceDetails);
      payload.append("equipment_provided", draft.equipmentProvided);
      payload.append("client_preparation", draft.clientPreparation);
      payload.append("ideal_for", draft.idealFor);
      payload.append("highlight_points", JSON.stringify(draft.highlightPoints));
      payload.append("bio", draft.bio);
      payload.append("public_headline", draft.headline);
      payload.append("specialties", JSON.stringify(draft.specialties));
      payload.append("visual_theme", draft.themeKey);
      payload.append("phone", draft.phone);
      payload.append("public_email", draft.publicEmail);
      payload.append("website_url", draft.websiteUrl);
      payload.append("instagram_url", draft.instagramUrl);
      payload.append("facebook_url", draft.facebookUrl);
      payload.append("tiktok_url", draft.tiktokUrl);
      payload.append("is_public", String(draft.isPublic));
      payload.append(
        "accepts_online_booking",
        String(draft.acceptsOnlineBooking)
      );
      payload.append("reservation_payment_mode", draft.reservationPaymentMode);
      payload.append("deposit_value_type", draft.depositValueType);
      payload.append("deposit_value", draft.depositValue || "0.00");
      payload.append(
        "free_cancellation_notice_hours",
        String(draft.freeCancellationNoticeHours)
      );
      payload.append(
        "keep_payment_after_deadline",
        String(draft.keepPaymentAfterDeadline)
      );
      payload.append("payment_message", draft.paymentMessage);

      if (profilePhotoFile) {
        payload.append("profile_photo", profilePhotoFile);
      }

      if (coverPhotoFile) {
        payload.append("cover_photo", coverPhotoFile);
      }

      if (!draft.profileImageUrl && !profilePhotoFile) {
        payload.append("remove_profile_photo", "true");
      }

      if (!draft.coverImageUrl && !coverPhotoFile) {
        payload.append("remove_cover_photo", "true");
      }

      const updatedProfile = await updateDashboardProfile(payload);
      const nextDraft = createDefaultPublicProfileDraft(updatedProfile, services);

      setProfile(updatedProfile);
      setDefaultDraft(nextDraft);
      setDraft(nextDraft);
      setProfilePhotoFile(null);
      setCoverPhotoFile(null);
      setNotice("Mon profil public a été enregistré.");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Impossible d’enregistrer le profil public."
      );
    } finally {
      setSaving(false);
    }
  }

  function handleResetDraft() {
    if (!profile || !defaultDraft) {
      return;
    }

    setProfilePhotoFile(null);
    setCoverPhotoFile(null);
    setNotice("Aperçu réinitialisé sur la version enregistrée.");
    setDraft(defaultDraft);
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-28 rounded-[2rem]" />
        <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
          <Skeleton className="h-[34rem] rounded-[2rem]" />
          <Skeleton className="h-[34rem] rounded-[2rem]" />
        </div>
      </div>
    );
  }

  if (!profile || !draft) {
    return (
      <div className="space-y-6">
        <SectionHeading
          eyebrow="Mon profil public"
          title="Mon profil public"
          description="Prépare la page réservable qui présentera ton univers et tes prestations."
        />
        <Notice tone="error">{error || "Profil introuvable."}</Notice>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SectionHeading
        eyebrow="Visibilité en ligne"
        title="Mon profil public"
        description="Prépare une page praticien réservable, rassurante et simple à partager pendant le lancement."
        action={
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button variant="secondary" size="lg" onClick={handleCopyLink}>
              Copier mon lien public
            </Button>
            <Link href={`/${profile.slug}`} target="_blank">
              <Button size="lg">Voir mon profil en tant que client</Button>
            </Link>
          </div>
        }
      />

      {error ? <Notice tone="error">{error}</Notice> : null}
      {notice ? <Notice tone="success">{notice}</Notice> : null}
      <Notice tone="info">
        Les textes, visuels, options de visibilité et thème visuel sont
        enregistrés sur ton profil. Cette page pilote désormais la version
        publique réellement affichée à tes clients.
      </Notice>

      {profile ? (
        <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
          <Card>
            <CardHeader
              title="Mise en avant dans l’annuaire"
              subtitle="NUADYX privilégie les profils complets, actifs et fiables. Ce cadrage sert à mieux guider tes prochaines améliorations."
            />

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div className="rounded-[var(--radius-lg)] border border-border/70 bg-surface-subtle p-4">
                <p className="text-sm text-muted-foreground">Complétude du profil</p>
                <p className="mt-2 text-3xl font-semibold text-foreground">
                  {profile.profile_completeness_score}%
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Présentation, services, contacts, photos et règles de réservation.
                </p>
              </div>

              <div className="rounded-[var(--radius-lg)] border border-border/70 bg-surface-subtle p-4">
                <p className="text-sm text-muted-foreground">Visibilité estimée</p>
                <p className="mt-2 text-3xl font-semibold text-foreground">
                  {profile.profile_visibility_score}%
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Activité, fiabilité, créneaux, avis et statut vérifié renforcent la présence locale.
                </p>
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Prochaines améliorations utiles"
              subtitle="Pas de promesse magique : ces signaux servent surtout à rendre le profil plus clair, plus fiable et plus facile à recommander."
            />

            <div className="mt-6 grid gap-3">
              {rankingChecklist.length > 0 ? (
                rankingChecklist.map((item) => (
                  <div
                    key={item}
                    className="rounded-[var(--radius-md)] border border-border/70 bg-white/70 px-4 py-3 text-sm text-foreground shadow-[var(--shadow-soft)]"
                  >
                    {item}
                  </div>
                ))
              ) : (
                <div className="rounded-[var(--radius-md)] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
                  Ton profil coche déjà les principaux signaux de base. Continue surtout à garder des créneaux à jour et une expérience fiable.
                </div>
              )}

              <div className="rounded-[var(--radius-md)] border border-border/70 bg-surface-subtle px-4 py-3 text-sm text-muted-foreground">
                Les profils vérifiés, avec peu d’annulations et une activité régulière, sont mieux placés pour gagner en visibilité pendant le lancement.
              </div>
            </div>
          </Card>
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[1.02fr_0.98fr]">
        <div className="space-y-4">
          <Card>
            <CardHeader
              title="Informations du compte"
              subtitle="Modifie ici le nom du titulaire du compte et l’email de connexion utilisé pour accéder à ton espace."
            />

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <FieldWrapper label="Prénom du titulaire">
                <Input
                  value={profile.owner_first_name}
                  onChange={(event) =>
                    setProfile((current) =>
                      current
                        ? { ...current, owner_first_name: event.target.value }
                        : current
                    )
                  }
                />
              </FieldWrapper>

              <FieldWrapper label="Nom du titulaire">
                <Input
                  value={profile.owner_last_name}
                  onChange={(event) =>
                    setProfile((current) =>
                      current
                        ? { ...current, owner_last_name: event.target.value }
                        : current
                    )
                  }
                />
              </FieldWrapper>

              <div className="md:col-span-2">
                <FieldWrapper label="Email de connexion">
                  <Input
                    type="email"
                    value={profile.login_email}
                    onChange={(event) =>
                      setProfile((current) =>
                        current
                          ? { ...current, login_email: event.target.value }
                          : current
                      )
                    }
                  />
                </FieldWrapper>
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader
              title="L’essentiel visible"
              subtitle="Aide les futurs clients à comprendre immédiatement qui tu es, comment tu exerces et dans quel cadre tu reçois."
            />

            <div className="mt-6 grid gap-4">
              <div className="grid gap-4 md:grid-cols-2">
                <FieldWrapper
                  label="Type d’activité"
                  hint="Solo, studio, spa ou équipe"
                >
                  <Select
                    value={draft.activityType}
                    onChange={(event) =>
                      setDraft((current) =>
                        current
                          ? {
                              ...current,
                              activityType: event.target.value as PublicProfileDraft["activityType"],
                            }
                          : current
                      )
                    }
                  >
                    {activityTypeOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </Select>
                </FieldWrapper>

                <FieldWrapper
                  label="Façon d’exercer"
                  hint="Lieu principal ou mode d’intervention"
                >
                  <Select
                    value={draft.practiceMode}
                    onChange={(event) =>
                      setDraft((current) =>
                        current
                          ? {
                              ...current,
                              practiceMode: event.target.value as PublicProfileDraft["practiceMode"],
                            }
                          : current
                      )
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

              <FieldWrapper label="Lien public" hint="nuadyx.app/votre-lien">
                <Input
                  value={draft.slug}
                  onChange={(event) =>
                    setDraft((current) =>
                      current ? { ...current, slug: event.target.value } : current
                    )
                  }
                />
              </FieldWrapper>

              <FieldWrapper label="Nom affiché">
                <Input
                  value={draft.displayName}
                  onChange={(event) =>
                    setDraft((current) =>
                      current
                        ? { ...current, displayName: event.target.value }
                        : current
                    )
                  }
                />
              </FieldWrapper>

              <div className="grid gap-4 md:grid-cols-2">
                <FieldWrapper label="Ville principale">
                  <Input
                    value={draft.city}
                    onChange={(event) =>
                      setDraft((current) =>
                        current ? { ...current, city: event.target.value } : current
                      )
                    }
                  />
                </FieldWrapper>

                <FieldWrapper
                  label="Zone desservie"
                  hint="Utile si tu te déplaces ou interviens à domicile"
                >
                  <Input
                    value={draft.serviceArea}
                    onChange={(event) =>
                      setDraft((current) =>
                        current
                          ? { ...current, serviceArea: event.target.value }
                          : current
                      )
                    }
                    placeholder="Brest centre, Guilers, Plouzané"
                  />
                </FieldWrapper>
              </div>

              <FieldWrapper label="Accroche visible">
                <Input
                  value={draft.headline}
                  onChange={(event) =>
                    setDraft((current) =>
                      current
                        ? { ...current, headline: event.target.value }
                        : current
                    )
                  }
                  placeholder="Massage et bien-être sur rendez-vous"
                />
              </FieldWrapper>

              <FieldWrapper
                label="Pour qui ou pour quoi je reçois"
                hint="Aide le client à se reconnaître dans ta pratique"
              >
                <Textarea
                  value={draft.idealFor}
                  onChange={(event) =>
                    setDraft((current) =>
                      current
                        ? { ...current, idealFor: event.target.value }
                        : current
                    )
                  }
                  placeholder="Explique en quelques phrases pour quels besoins, rythmes ou recherches tu accueilles tes clients."
                />
              </FieldWrapper>

              <FieldWrapper
                label="Spécialités"
                hint="Sépare les éléments par une virgule"
              >
                <Input
                  value={draft.specialties.join(", ")}
                  onChange={(event) =>
                    setDraft((current) =>
                      current
                        ? {
                            ...current,
                            specialties: event.target.value
                              .split(",")
                              .map((value) => value.trim())
                              .filter(Boolean),
                          }
                        : current
                    )
                  }
                  placeholder="Massage relaxant, récupération, drainage"
                />
              </FieldWrapper>

              <FieldWrapper
                label="3 points forts"
                hint="Un point par ligne pour rassurer rapidement"
              >
                <Textarea
                  value={draft.highlightPoints.join("\n")}
                  onChange={(event) =>
                    setDraft((current) =>
                      current
                        ? {
                            ...current,
                            highlightPoints: event.target.value
                              .split("\n")
                              .map((value) => value.trim())
                              .filter(Boolean)
                              .slice(0, 3),
                          }
                        : current
                    )
                  }
                  placeholder={"Cadre apaisant et confidentiel\nRéservation claire et rapide\nSoin adapté au besoin du moment"}
                />
              </FieldWrapper>

              <FieldWrapper label="Présentation">
                <Textarea
                  value={draft.bio}
                  onChange={(event) =>
                    setDraft((current) =>
                      current ? { ...current, bio: event.target.value } : current
                    )
                  }
                  placeholder="Présente ton approche, ton cadre et ce que tes clients viennent chercher."
                />
              </FieldWrapper>

              <Notice tone="info" className="text-[var(--foreground-muted)]">
                {contextualCopy.activityHint}
              </Notice>
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Lieu, accès et cadre"
              subtitle="Rassure sur l’accueil, l’ambiance et les repères utiles avant la venue."
            />

            <div className="mt-6 grid gap-4">
              <FieldWrapper
                label="Lieu principal d’accueil"
                hint="Explique où tu reçois ou comment se passe l’accueil"
              >
                <Textarea
                  value={draft.venueDetails}
                  onChange={(event) =>
                    setDraft((current) =>
                      current
                        ? { ...current, venueDetails: event.target.value }
                        : current
                    )
                  }
                  placeholder="Explique en quelques phrases comment tu reçois tes clients, le type de lieu, l’ambiance générale ou le cadre."
                />
              </FieldWrapper>

              <FieldWrapper
                label="Accès et informations pratiques"
                hint="Parking, transport, étage, interphone, code, accessibilité..."
              >
                <Textarea
                  value={draft.accessDetails}
                  onChange={(event) =>
                    setDraft((current) =>
                      current
                        ? { ...current, accessDetails: event.target.value }
                        : current
                    )
                  }
                  placeholder="Si tu reçois en cabinet, rassure sur l’accès. Si tu te déplaces, précise les conditions utiles avant la venue."
                />
              </FieldWrapper>

              <FieldWrapper
                label="Ambiance et cadre"
                hint="Ce qui rend l’expérience particulière"
              >
                <Textarea
                  value={draft.ambienceDetails}
                  onChange={(event) =>
                    setDraft((current) =>
                      current
                        ? { ...current, ambienceDetails: event.target.value }
                        : current
                    )
                  }
                  placeholder="Parle de l’ambiance du lieu, du calme, du confort, du soin apporté à l’accueil."
                />
              </FieldWrapper>

              <Notice tone="info" className="text-[var(--foreground-muted)]">
                {contextualCopy.settingHint}
              </Notice>
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Contact et liens publics"
              subtitle="Ajoute les coordonnées et liens que tu souhaites afficher à tes clients."
            />

            <div className="mt-6 grid gap-4">
              <div className="grid gap-4 md:grid-cols-2">
                <FieldWrapper label="Téléphone public">
                  <Input
                    value={draft.phone}
                    onChange={(event) =>
                      setDraft((current) =>
                        current ? { ...current, phone: event.target.value } : current
                      )
                    }
                    placeholder="06 00 00 00 00"
                  />
                </FieldWrapper>

                <FieldWrapper label="Email public">
                  <Input
                    type="email"
                    value={draft.publicEmail}
                    onChange={(event) =>
                      setDraft((current) =>
                        current
                          ? { ...current, publicEmail: event.target.value }
                          : current
                      )
                    }
                    placeholder="bonjour@nuadyx.com"
                  />
                </FieldWrapper>
              </div>

              <FieldWrapper
                label="Site web"
                hint="Tu peux coller ton domaine même sans https://"
              >
                <Input
                  value={draft.websiteUrl}
                  onChange={(event) =>
                    setDraft((current) =>
                      current
                        ? { ...current, websiteUrl: event.target.value }
                        : current
                    )
                  }
                  placeholder="mon-site.fr"
                />
              </FieldWrapper>

              <div className="grid gap-4 md:grid-cols-3">
                <FieldWrapper label="Instagram">
                  <Input
                    value={draft.instagramUrl}
                    onChange={(event) =>
                      setDraft((current) =>
                        current
                          ? { ...current, instagramUrl: event.target.value }
                          : current
                      )
                    }
                    placeholder="instagram.com/moncompte"
                  />
                </FieldWrapper>

                <FieldWrapper label="Facebook">
                  <Input
                    value={draft.facebookUrl}
                    onChange={(event) =>
                      setDraft((current) =>
                        current
                          ? { ...current, facebookUrl: event.target.value }
                          : current
                      )
                    }
                    placeholder="facebook.com/moncompte"
                  />
                </FieldWrapper>

                <FieldWrapper label="TikTok">
                  <Input
                    value={draft.tiktokUrl}
                    onChange={(event) =>
                      setDraft((current) =>
                        current
                          ? { ...current, tiktokUrl: event.target.value }
                          : current
                      )
                    }
                    placeholder="tiktok.com/@moncompte"
                  />
                </FieldWrapper>
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Informations utiles avant la séance"
              subtitle="Aide le client à savoir quoi prévoir et ce que tu apportes selon ta façon d’exercer."
            />

            <div className="mt-6 grid gap-4">
              <FieldWrapper
                label="Ce que j’apporte"
                hint="Particulièrement utile à domicile ou en déplacement"
              >
                <Textarea
                  value={draft.equipmentProvided}
                  onChange={(event) =>
                    setDraft((current) =>
                      current
                        ? { ...current, equipmentProvided: event.target.value }
                        : current
                    )
                  }
                  placeholder="Table, huile, serviettes, musique, installation, matériel spécifique..."
                />
              </FieldWrapper>

              <FieldWrapper
                label="Ce que le client doit prévoir"
                hint="Espace minimum, tenue, consignes utiles, préparation"
              >
                <Textarea
                  value={draft.clientPreparation}
                  onChange={(event) =>
                    setDraft((current) =>
                      current
                        ? { ...current, clientPreparation: event.target.value }
                        : current
                    )
                  }
                  placeholder="Explique simplement ce qui aide à bien préparer la séance."
                />
              </FieldWrapper>
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Photos et ambiance"
              subtitle="Structure déjà les emplacements qui accueilleront tes visuels pour rendre la page plus émotionnelle."
            />

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <div className="rounded-[1.5rem] border border-dashed border-[var(--border)] bg-[var(--background-soft)] p-5">
                <div className="flex items-center gap-3">
                  <ImagePlus className="h-5 w-5 text-[var(--primary)]" />
                  <p className="text-sm font-medium text-[var(--foreground)]">
                    Photo de profil
                  </p>
                </div>
                {draft.profileImageUrl ? (
                  <img
                    src={draft.profileImageUrl}
                    alt={draft.displayName}
                    className="mt-4 h-28 w-28 rounded-[1.4rem] object-cover"
                  />
                ) : (
                  <p className="mt-3 text-sm leading-6 text-[var(--foreground-muted)]">
                    {draft.profileImageHint}
                  </p>
                )}
                <input
                  type="file"
                  accept="image/*"
                  className="mt-4 block w-full text-sm text-[var(--foreground-muted)] file:mr-4 file:rounded-xl file:border-0 file:bg-[var(--surface-muted)] file:px-3 file:py-2 file:text-sm file:font-medium file:text-[var(--foreground)]"
                  onChange={(event) => {
                    const file = event.target.files?.[0] ?? null;
                    setProfilePhotoFile(file);
                    if (file) {
                      setDraft((current) =>
                        current
                          ? {
                              ...current,
                              profileImageUrl: URL.createObjectURL(file),
                            }
                          : current
                      );
                    }
                  }}
                />
                {draft.profileImageUrl ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-3"
                    onClick={() => {
                      setProfilePhotoFile(null);
                      setDraft((current) =>
                        current ? { ...current, profileImageUrl: "" } : current
                      );
                    }}
                  >
                    Retirer la photo de profil
                  </Button>
                ) : null}
              </div>

              <div className="rounded-[1.5rem] border border-dashed border-[var(--border)] bg-[var(--background-soft)] p-5">
                <div className="flex items-center gap-3">
                  <ImagePlus className="h-5 w-5 text-[var(--primary)]" />
                  <p className="text-sm font-medium text-[var(--foreground)]">
                    Photo de couverture
                  </p>
                </div>
                {draft.coverImageUrl ? (
                  <img
                    src={draft.coverImageUrl}
                    alt={`Couverture de ${draft.displayName}`}
                    className="mt-4 h-28 w-full rounded-[1.4rem] object-cover"
                  />
                ) : (
                  <p className="mt-3 text-sm leading-6 text-[var(--foreground-muted)]">
                    {draft.coverImageHint}
                  </p>
                )}
                <input
                  type="file"
                  accept="image/*"
                  className="mt-4 block w-full text-sm text-[var(--foreground-muted)] file:mr-4 file:rounded-xl file:border-0 file:bg-[var(--surface-muted)] file:px-3 file:py-2 file:text-sm file:font-medium file:text-[var(--foreground)]"
                  onChange={(event) => {
                    const file = event.target.files?.[0] ?? null;
                    setCoverPhotoFile(file);
                    if (file) {
                      setDraft((current) =>
                        current
                          ? {
                              ...current,
                              coverImageUrl: URL.createObjectURL(file),
                            }
                          : current
                      );
                    }
                  }}
                />
                {draft.coverImageUrl ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-3"
                    onClick={() => {
                      setCoverPhotoFile(null);
                      setDraft((current) =>
                        current ? { ...current, coverImageUrl: "" } : current
                      );
                    }}
                  >
                    Retirer la photo de couverture
                  </Button>
                ) : null}
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Règlement à la réservation"
              subtitle="Décide si tu demandes un acompte, un paiement total ou aucun règlement à l’avance."
            />

            <div className="mt-6 grid gap-4">
              <FieldWrapper label="Mode de réservation">
                <Select
                  value={draft.reservationPaymentMode}
                  onChange={(event) =>
                    setDraft((current) =>
                      current
                        ? {
                            ...current,
                            reservationPaymentMode: event.target.value as PublicProfileDraft["reservationPaymentMode"],
                            depositValueType: "percentage",
                            depositValue:
                              event.target.value === "deposit"
                                ? allowedDepositOptions.includes(current.depositValue)
                                  ? current.depositValue
                                  : allowedDepositOptions[0] || "20.00"
                                : "0.00",
                          }
                        : current
                    )
                  }
                >
                  <option value="none">Sans paiement à la réservation</option>
                  <option value="deposit">Demander un acompte pour réserver ce créneau</option>
                  <option value="full" disabled={!isVerifiedForPayments}>
                    Demander le paiement total à la réservation
                  </option>
                </Select>
              </FieldWrapper>

              {draft.reservationPaymentMode === "deposit" ? (
                <div className="grid gap-4">
                  <FieldWrapper
                    label="Acompte demandé à la réservation"
                    hint={
                      isVerifiedForPayments
                        ? "Options NUADYX v1 : 20 %, 30 % ou 50 %."
                        : "Pendant le lancement, un praticien non vérifié est limité à 20 %."
                    }
                  >
                    <Select
                      value={draft.depositValue}
                      onChange={(event) =>
                        setDraft((current) =>
                          current
                            ? {
                                ...current,
                                depositValueType: "percentage",
                                depositValue: event.target.value,
                              }
                            : current
                        )
                      }
                    >
                      {allowedDepositOptions.map((option) => (
                        <option key={option} value={option}>
                          {option.replace(".00", "")} %
                        </option>
                      ))}
                    </Select>
                  </FieldWrapper>
                </div>
              ) : null}

              {!isVerifiedForPayments ? (
                <Notice tone="info">
                  Pendant le lancement, le paiement total à la réservation est réservé aux praticiens vérifiés. L’acompte en ligne reste limité à 20 % tant que la vérification n’est pas finalisée.
                </Notice>
              ) : null}

              <div className="grid gap-4 md:grid-cols-2">
                <FieldWrapper label="Annulation sans frais jusqu’à..." hint="En heures">
                  <Input
                    type="number"
                    min="1"
                    step="1"
                    value={draft.freeCancellationNoticeHours}
                    onChange={(event) =>
                      setDraft((current) =>
                        current
                          ? {
                              ...current,
                              freeCancellationNoticeHours: Number(event.target.value || 24),
                            }
                          : current
                      )
                    }
                  />
                </FieldWrapper>

                <SwitchRow
                  label={
                    draft.reservationPaymentMode === "full"
                      ? "Conserver le règlement passé ce délai"
                      : "Conserver l’acompte passé ce délai"
                  }
                  description="Permet d’afficher une règle simple et claire au client."
                  checked={draft.keepPaymentAfterDeadline}
                  onCheckedChange={(checked) =>
                    setDraft((current) =>
                      current
                        ? { ...current, keepPaymentAfterDeadline: checked }
                        : current
                    )
                  }
                />
              </div>

              <FieldWrapper
                label="Message rassurant affiché au client"
                hint="Visible avant la validation du rendez-vous"
              >
                <Input
                  value={draft.paymentMessage}
                  onChange={(event) =>
                    setDraft((current) =>
                      current
                        ? { ...current, paymentMessage: event.target.value }
                        : current
                    )
                  }
                  placeholder="Votre acompte permet de réserver votre créneau."
                />
              </FieldWrapper>
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Visibilité et réservation"
              subtitle="Prépare le comportement futur de ta page publique sans entrer dans un jargon technique."
            />

            <div className="mt-6 space-y-4">
              <SwitchRow
                label="Afficher mon profil dans l’annuaire"
                description="Tu peux masquer temporairement ta page sans perdre tes contenus ni tes réglages."
                checked={draft.isPublic}
                onCheckedChange={(checked) =>
                  setDraft((current) =>
                    current ? { ...current, isPublic: checked } : current
                  )
                }
              />
              <SwitchRow
                label="Rendre mon profil réservable"
                description="Afficher la réservation en ligne avec les créneaux ouverts."
                checked={draft.acceptsOnlineBooking}
                onCheckedChange={(checked) =>
                  setDraft((current) =>
                    current
                      ? { ...current, acceptsOnlineBooking: checked }
                      : current
                  )
                }
              />
            </div>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader
              title="Style visuel"
              subtitle="Choisis un rendu cohérent pour ta page praticien publique."
            />
            <div className="mt-6 grid gap-4">
              {publicProfileThemes.map((theme) => (
                <ThemeChoiceCard
                  key={theme.key}
                  theme={theme}
                  selected={draft.themeKey === theme.key}
                  onSelect={() =>
                    setDraft((current) =>
                      current ? { ...current, themeKey: theme.key } : current
                    )
                  }
                />
              ))}
            </div>
          </Card>

          <PublicProfilePreviewCard
            slug={profile.slug}
            draft={draft}
            onCopyLink={handleCopyLink}
          />

          <Card>
            <CardHeader
              title="Préparation de l’assistant"
              subtitle="Prépare l’emplacement de l’assistant public sans promettre plus que ce qui est déjà actif."
            />
            <div className="mt-5 rounded-[1.5rem] border border-[var(--border)] bg-[var(--surface-muted)] p-5">
              <div className="flex items-start gap-3">
                <Sparkles className="mt-0.5 h-5 w-5 text-[var(--primary)]" />
                <div>
                  <p className="text-sm font-medium text-[var(--foreground)]">
                    Futur assistant du praticien
                  </p>
                  <p className="mt-2 text-sm leading-6 text-[var(--foreground-muted)]">
                    Il pourra répondre aux questions sur les prestations, la
                    préparation, les disponibilités et le cadre d’accueil à partir
                    des contenus fournis par le praticien.
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Button size="lg" onClick={handleSaveDraft} disabled={saving}>
                {saving ? "Enregistrement..." : "Enregistrer mon profil public"}
              </Button>
              <Button variant="secondary" size="lg" onClick={handleResetDraft}>
                Réinitialiser
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
