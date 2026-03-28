"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowUpRight,
  BookOpenCheck,
  CalendarClock,
  CalendarRange,
  CheckCircle2,
  Sparkles,
  WalletCards,
} from "lucide-react";

import { SpaceReadinessCard } from "@/components/dashboard/space-readiness-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Notice } from "@/components/ui/notice";
import { SectionHeading } from "@/components/ui/section-heading";
import { Skeleton } from "@/components/ui/skeleton";
import { StatCard } from "@/components/ui/stat-card";
import {
  getAssistantProfile,
  getAvailabilities,
  getBookings,
  getDashboardProfile,
  getReviewInvitations,
  getServices,
  type AssistantProfile,
  type Availability,
  type Booking,
  type DashboardProfile,
  type ReviewInvitation,
  type Service,
} from "@/lib/api";
import { fadeInUp, staggerContainer } from "@/lib/motion";
import {
  getBookingPaymentTone,
  getPaymentStatusLabel,
} from "@/lib/payments";
import {
  buildSpaceChecklist,
  consumeWelcomeNotice,
} from "@/lib/practitioner-space";
import { getStoredUser } from "@/lib/auth";
import {
  formatDateTime,
  formatTime,
  getDurationMinutes,
} from "@/lib/utils";

export default function DashboardPage() {
  const [profile, setProfile] = useState<DashboardProfile | null>(null);
  const [assistant, setAssistant] = useState<AssistantProfile | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [slots, setSlots] = useState<Availability[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [reviewInvitations, setReviewInvitations] = useState<ReviewInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copyNotice, setCopyNotice] = useState("");
  const [welcomeNotice, setWelcomeNotice] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const [profileData, assistantData, servicesData, slotsData, bookingsData, reviewInvitationsData] =
          await Promise.all([
            getDashboardProfile(),
            getAssistantProfile(),
            getServices(),
            getAvailabilities(),
            getBookings(),
            getReviewInvitations(),
          ]);

        if (!active) return;

        setProfile(profileData);
        setAssistant(assistantData);
        setServices(servicesData);
        setSlots(slotsData);
        setBookings(bookingsData);
        setReviewInvitations(reviewInvitationsData);
        setError("");
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Impossible de charger le dashboard.");
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    setWelcomeNotice(consumeWelcomeNotice());
    setIsAdmin(getStoredUser()?.role === "admin");
    void load();
    return () => {
      active = false;
    };
  }, []);

  const upcomingSlots = slots.filter(
    (slot) => slot.is_active && new Date(slot.start_at) >= new Date()
  );
  const pendingBookings = bookings.filter((booking) => booking.status === "pending");
  const blockedPayouts = bookings.filter(
    (booking) => booking.payout_status === "payout_blocked"
  );
  const securedBookings = bookings.filter(
    (booking) => booking.payment_status === "payment_captured"
  );
  const nextSlot = upcomingSlots[0];
  const latestBooking = bookings[0];
  const checklistItems = buildSpaceChecklist({
    profile,
    assistant,
    services,
    slots,
    bookings,
    hasReviewInvitation: reviewInvitations.length > 0,
  });
  const checklistCompleted = checklistItems.filter((item) => item.completed).length;
  async function handleCopyPublicLink() {
    if (!profile?.slug) {
      return;
    }

    await navigator.clipboard.writeText(
      `${window.location.origin}/${profile.slug}`
    );
    setCopyNotice("Lien du profil public copié.");
  }

  return (
    <div className="space-y-6">
      <SectionHeading
        eyebrow="Pilotage"
        title={
          profile?.business_name
            ? `Bonjour ${profile.business_name}`
            : "Piloter mon activité"
        }
        description="Retrouve en un coup d’œil tes prestations, tes créneaux, tes réservations clients et la visibilité de ton profil public."
        action={
          <div className="flex flex-col gap-3 sm:flex-row">
            {isAdmin ? (
              <Link href="/admin">
                <Button variant="ghost" size="lg">
                  Ouvrir l’admin
                </Button>
              </Link>
            ) : null}
            {profile?.slug ? (
              <Link href={`/${profile.slug}`} target="_blank">
                <Button
                  variant="secondary"
                  size="lg"
                  iconRight={<ArrowUpRight className="h-4 w-4" />}
                >
                  Voir mon profil en tant que client
                </Button>
              </Link>
            ) : null}
            <Button variant="ghost" size="lg" onClick={handleCopyPublicLink}>
              Copier mon lien public
            </Button>
          </div>
        }
      />

      {error ? <Notice tone="error">{error}</Notice> : null}
      {copyNotice ? <Notice tone="success">{copyNotice}</Notice> : null}
      {welcomeNotice ? (
        <Notice tone="success">
          <div className="space-y-2">
            <p className="font-medium">Votre espace praticien est prêt.</p>
            <p className="text-sm opacity-90">
              {welcomeNotice}
            </p>
          </div>
        </Notice>
      ) : null}

      {loading ? (
        <div className="grid gap-4 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-40 rounded-[1.75rem]" />
          ))}
        </div>
      ) : (
        <motion.div
          className="grid gap-4 xl:grid-cols-4"
          variants={staggerContainer}
          initial="initial"
          animate="animate"
        >
          <motion.div
            initial={fadeInUp.initial}
            animate={fadeInUp.animate}
            transition={fadeInUp.transition}
          >
            <StatCard
              label="Prestations actives"
              value={`${services.filter((service) => service.is_active).length}`}
              hint="Prestations visibles et prêtes à être réservées."
              icon={<Sparkles className="h-5 w-5" />}
            />
          </motion.div>
          <motion.div
            initial={fadeInUp.initial}
            animate={fadeInUp.animate}
            transition={fadeInUp.transition}
          >
            <StatCard
              label="Créneaux ouverts"
              value={`${upcomingSlots.length}`}
              hint="Créneaux futurs encore ouverts à la réservation."
              icon={<CalendarClock className="h-5 w-5" />}
            />
          </motion.div>
          <motion.div
            initial={fadeInUp.initial}
            animate={fadeInUp.animate}
            transition={fadeInUp.transition}
          >
            <StatCard
              label="Demandes à traiter"
              value={`${pendingBookings.length}`}
              hint="Réservations clientes en attente de réponse."
              icon={<BookOpenCheck className="h-5 w-5" />}
            />
          </motion.div>
          <motion.div
            initial={fadeInUp.initial}
            animate={fadeInUp.animate}
            transition={fadeInUp.transition}
          >
            <StatCard
              label="Réservations sécurisées"
              value={`${securedBookings.length}`}
              hint="Demandes déjà protégées par un acompte ou un règlement."
              icon={<WalletCards className="h-5 w-5" />}
            />
          </motion.div>
        </motion.div>
      )}

      {pendingBookings.length > 0 ? (
        <Card className="border-[color:var(--warning)]/24 bg-[color:var(--warning)]/10">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.26em] text-[color:var(--warning)]">
                Nouvelle activité
              </p>
              <h2 className="mt-3 text-2xl font-semibold text-[var(--foreground)]">
                {pendingBookings.length} demande
                {pendingBookings.length > 1 ? "s" : ""} de rendez-vous à traiter
              </h2>
              <p className="mt-2 text-sm leading-6 text-[var(--foreground-muted)]">
                Vos clients attendent une réponse. Confirmez rapidement les
                séances pour rassurer et éviter les demandes perdues.
              </p>
            </div>
            <Link href="/bookings" className="shrink-0">
              <Button size="lg">Voir les demandes en attente</Button>
            </Link>
          </div>
        </Card>
      ) : null}

      {blockedPayouts.length > 0 ? (
        <Notice tone="info">
          {blockedPayouts.length} réservation
          {blockedPayouts.length > 1 ? "s gardent" : " garde"} un versement
          bloqué. Vérifiez les signalements, les remboursements à reprendre ou
          le compte Stripe du praticien.
        </Notice>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <SpaceReadinessCard items={checklistItems} />

        <Card>
          <CardHeader
            title="Vue activité"
            subtitle="Les prochains points d’attention de l’activité."
          />
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div className="rounded-[1.4rem] border border-[var(--border)] bg-[var(--surface-muted)] p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium text-[var(--foreground)]">Prochain créneau</p>
                <Badge tone="info">Planning</Badge>
              </div>
              {nextSlot ? (
                <div className="mt-4 space-y-2">
                  <p className="text-xl font-semibold text-[var(--foreground)]">
                    {formatDateTime(nextSlot.start_at)}
                  </p>
                  <p className="text-sm text-[var(--foreground-muted)]">
                    {getDurationMinutes(nextSlot.start_at, nextSlot.end_at)} min
                    · fin à {formatTime(nextSlot.end_at)}
                  </p>
                </div>
              ) : (
                <p className="mt-4 text-sm leading-6 text-[var(--foreground-muted)]">
                  Aucun créneau à venir. Ajoute des disponibilités pour fluidifier
                  la prise de rendez-vous.
                </p>
              )}
            </div>

            <div className="rounded-[1.4rem] border border-[var(--border)] bg-[var(--surface-muted)] p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium text-[var(--foreground)]">
                  Dernière réservation client
                </p>
                <Badge tone={latestBooking?.status === "pending" ? "warning" : "success"}>
                  {latestBooking?.status ?? "Aucune"}
                </Badge>
              </div>
              {latestBooking ? (
                <div className="mt-4 space-y-2">
                  <p className="text-xl font-semibold text-[var(--foreground)]">
                    {latestBooking.client_first_name} {latestBooking.client_last_name}
                  </p>
                  <p className="text-sm text-[var(--foreground-muted)]">
                    {latestBooking.service_title} · {formatDateTime(latestBooking.start_at)}
                  </p>
                  <div className="pt-2">
                    <Badge tone={getBookingPaymentTone(latestBooking.payment_status)}>
                      {getPaymentStatusLabel(latestBooking.payment_status)}
                    </Badge>
                  </div>
                  <p className="text-sm text-[var(--foreground-muted)]">
                    {latestBooking.payment_summary}
                  </p>
                </div>
              ) : (
                <p className="mt-4 text-sm leading-6 text-[var(--foreground-muted)]">
                  Aucun historique pour le moment. L’écran est prêt à mettre en
                  avant les prochaines réservations.
                </p>
              )}
            </div>
          </div>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <Card>
          <CardHeader
            title="Profil professionnel"
            subtitle="Ce que les clients voient sur ta page publique."
          />
          <div className="mt-6 space-y-4 text-sm">
            <div className="flex items-center justify-between gap-3 rounded-[1.2rem] border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3">
              <span className="text-[var(--foreground-subtle)]">Nom affiché</span>
              <span className="text-right font-medium text-[var(--foreground)]">
                {profile?.business_name ?? "Non renseigné"}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3 rounded-[1.2rem] border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3">
              <span className="text-[var(--foreground-subtle)]">Slug public</span>
              <span className="font-mono text-[var(--foreground)]">
                {profile?.slug ?? "nuadyx"}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3 rounded-[1.2rem] border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3">
              <span className="text-[var(--foreground-subtle)]">Ville</span>
              <span className="text-right font-medium text-[var(--foreground)]">
                {profile?.city || "À compléter"}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3 rounded-[1.2rem] border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3">
              <span className="text-[var(--foreground-subtle)]">Réservation en ligne</span>
              <Badge tone={profile?.accepts_online_booking ? "success" : "neutral"}>
                {profile?.accepts_online_booking ? "Active" : "Inactive"}
              </Badge>
            </div>
            <div className="flex items-center justify-between gap-3 rounded-[1.2rem] border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3">
              <span className="text-[var(--foreground-subtle)]">Mise en route</span>
              <Badge tone={checklistCompleted === checklistItems.length ? "success" : "warning"}>
                {checklistCompleted}/{checklistItems.length}
              </Badge>
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Ce qui se passe dans l’espace"
            subtitle="Un résumé visible pour ne rien laisser filer."
          />
          <div className="mt-6 grid gap-3">
            <div className="rounded-[1.3rem] border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium text-[var(--foreground)]">
                  Demandes de rendez-vous
                </p>
                <Badge tone={pendingBookings.length > 0 ? "warning" : "success"}>
                  {pendingBookings.length > 0 ? "Action attendue" : "À jour"}
                </Badge>
              </div>
              <p className="mt-3 text-sm leading-6 text-[var(--foreground-muted)]">
                {pendingBookings.length > 0
                  ? `${pendingBookings.length} demande${pendingBookings.length > 1 ? "s" : ""} attend${pendingBookings.length > 1 ? "ent" : ""} votre retour.`
                  : "Aucune demande en attente pour le moment."}
              </p>
            </div>
            <div className="rounded-[1.3rem] border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-4">
              <div className="flex items-center gap-2 text-[var(--foreground)]">
                <CheckCircle2 className="h-4.5 w-4.5 text-[var(--primary)]" />
                <p className="text-sm font-medium">Communication client</p>
              </div>
              <p className="mt-3 text-sm leading-6 text-[var(--foreground-muted)]">
                Chaque nouvelle demande, confirmation et annulation peut
                désormais déclencher un message clair pour rassurer vos clients
                et structurer votre suivi.
              </p>
            </div>
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader
          title="Pistes prioritaires"
          subtitle="Les écrans déjà branchés te donnent une base claire pour présenter tes soins et gérer ton activité."
        />
        <div className="mt-6 grid gap-3 md:grid-cols-3">
          {[
            {
              title: "Structurer l’offre",
              description:
                "Affiner titres, durées et descriptions pour rendre les prestations plus claires et plus désirables.",
              icon: Sparkles,
            },
            {
              title: "Ouvrir mes créneaux",
              description:
                "Publier des créneaux lisibles et réguliers pour faciliter la réservation autonome.",
              icon: CalendarRange,
            },
            {
              title: "Répondre aux demandes",
              description:
                "Confirmer les réservations rapidement pour renforcer la confiance et la qualité perçue.",
              icon: BookOpenCheck,
            },
          ].map((item) => (
            <div
              key={item.title}
              className="rounded-[1.5rem] border border-[var(--border)] bg-[var(--surface-muted)] p-4"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--background-soft)] text-[var(--primary)]">
                <item.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 text-lg font-semibold text-[var(--foreground)]">{item.title}</h3>
              <p className="mt-2 text-sm leading-6 text-[var(--foreground-muted)]">
                {item.description}
              </p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
