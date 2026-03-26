import Link from "next/link";
import {
  ArrowRight,
  Bot,
  CalendarClock,
  CheckCircle2,
  Globe2,
  Link2,
  Search,
  ShieldCheck,
  Star,
} from "lucide-react";

import { DashboardPreview } from "@/components/marketing/dashboard-preview";
import { SiteHeader } from "@/components/marketing/site-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const proofPoints = [
  "Une page professionnelle sans créer de site",
  "Un lien simple à partager à vos clients",
  "Des demandes de rendez-vous claires et organisées",
];

const whyJoin = [
  {
    title: "Être visible",
    description:
      "Apparaissez dans un annuaire dédié au massage et au bien-être. Vos futurs clients peuvent vous trouver plus facilement.",
    icon: Search,
  },
  {
    title: "Partager votre page",
    description:
      "Un lien simple à envoyer sur WhatsApp, Instagram ou SMS pour présenter vos soins sans refaire un site complet.",
    icon: Link2,
  },
  {
    title: "Recevoir des demandes de rendez-vous",
    description:
      "Vos clients peuvent demander un créneau ou réserver plus simplement, avec des informations plus lisibles et mieux organisées.",
    icon: CalendarClock,
  },
  {
    title: "Rassurer dès le premier contact",
    description:
      "Votre profil, vos prestations et les avis créent un cadre clair et professionnel dès la première visite.",
    icon: Star,
  },
];

const setupSteps = [
  {
    title: "Créez votre page",
    description: "Ajoutez vos soins, votre présentation et la manière dont vous exercez.",
  },
  {
    title: "Ouvrez vos créneaux",
    description: "Indiquez vos disponibilités pour faciliter les demandes de rendez-vous.",
  },
  {
    title: "Recevez vos demandes",
    description: "Les clients peuvent réserver ou demander un créneau plus clairement.",
  },
];

const practitionerBenefits = [
  "Vos prestations avec durées et tarifs",
  "Votre présentation et votre univers",
  "Vos photos et votre ambiance",
  "Vos créneaux disponibles",
  "Vos conditions de réservation",
  "Vos avis clients",
  "Votre lien public partageable",
];

const visibilitySignals = [
  {
    title: "Un profil complet inspire davantage confiance",
    description:
      "Présentation, photos, prestations, créneaux et règles de réservation forment une page plus claire pour les clients.",
    icon: ShieldCheck,
  },
  {
    title: "L’activité régulière aide à remonter",
    description:
      "Les praticiens actifs, fiables et réactifs peuvent être mieux mis en avant dans l’annuaire au fil du temps.",
    icon: CalendarClock,
  },
  {
    title: "Les premiers inscrits profitent du lancement",
    description:
      "Pendant la phase de lancement, les premiers profils bien renseignés gagnent plus facilement en visibilité locale.",
    icon: Globe2,
  },
];

export default function HomePage() {
  return (
    <main className="min-h-screen text-[var(--foreground)]">
      <SiteHeader mode="practitioner" />

      <section className="px-4 pb-8 pt-6 md:px-6 md:pb-12 md:pt-10">
        <div className="mx-auto grid max-w-7xl items-center gap-8 lg:grid-cols-[1.02fr_0.98fr] lg:gap-10">
          <div>
            <Badge tone="info">Gratuit pendant le lancement</Badge>
            <h1 className="mt-6 max-w-3xl text-5xl font-semibold leading-[1.02] tracking-tight text-[var(--foreground)] md:text-6xl">
              Votre page praticien sans créer un site
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-[var(--foreground-muted)]">
              NUADYX vous aide à présenter vos soins, ouvrir vos créneaux, partager
              un lien public et recevoir vos demandes de rendez-vous dans un cadre
              clair et rassurant.
            </p>

            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              <Link href="/inscription" className="w-full">
                <Button
                  size="lg"
                  className="w-full"
                  iconRight={<ArrowRight className="h-4 w-4" />}
                >
                  Créer ma page praticien
                </Button>
              </Link>
              <Link href="/trouver-un-praticien" className="w-full">
                <Button variant="secondary" size="lg" className="w-full">
                  Voir un exemple de page
                </Button>
              </Link>
            </div>

            <div className="mt-10 grid gap-3 sm:grid-cols-3">
              {proofPoints.map((point) => (
                <Card key={point} className="rounded-[1.6rem] p-4">
                  <p className="text-sm font-medium leading-6 text-[var(--foreground)]">
                    {point}
                  </p>
                </Card>
              ))}
            </div>
          </div>

          <div>
            <DashboardPreview />
          </div>
        </div>
      </section>

      <section id="pourquoi-rejoindre" className="px-4 py-10 md:px-6 md:py-14">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-3xl">
            <p className="text-xs uppercase tracking-[0.32em] text-[var(--primary)]/80">
              Pourquoi rejoindre NUADYX
            </p>
            <h2 className="mt-4 text-4xl font-semibold tracking-tight text-[var(--foreground)]">
              Pourquoi rejoindre NUADYX maintenant ?
            </h2>
            <p className="mt-4 text-sm leading-7 text-[var(--foreground-muted)]">
              NUADYX est en phase de lancement. Les premiers praticiens inscrits
              bénéficient d’une visibilité prioritaire dans l’annuaire et posent
              les bases de leur présence en ligne.
            </p>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {whyJoin.map((item) => (
              <Card key={item.title} className="rounded-[1.7rem]">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] text-[var(--primary)]">
                  <item.icon className="h-5 w-5" />
                </div>
                <h3 className="mt-5 text-xl font-semibold text-[var(--foreground)]">
                  {item.title}
                </h3>
                <p className="mt-3 text-sm leading-7 text-[var(--foreground-muted)]">
                  {item.description}
                </p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section id="comment-ca-marche" className="px-4 py-10 md:px-6 md:py-14">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-3xl">
            <p className="text-xs uppercase tracking-[0.32em] text-[var(--primary)]/80">
              Comment ça marche
            </p>
            <h2 className="mt-4 text-4xl font-semibold tracking-tight text-[var(--foreground)]">
              Une mise en place simple en quelques minutes
            </h2>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {setupSteps.map((item, index) => (
              <Card key={item.title} className="rounded-[1.7rem] p-6">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] text-sm font-semibold text-[var(--foreground)]">
                  0{index + 1}
                </div>
                <h3 className="mt-5 text-xl font-semibold text-[var(--foreground)]">
                  {item.title}
                </h3>
                <p className="mt-3 text-sm leading-7 text-[var(--foreground-muted)]">
                  {item.description}
                </p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 py-10 md:px-6 md:py-14">
        <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[0.92fr_1.08fr]">
          <Card className="rounded-[1.9rem]">
            <p className="text-xs uppercase tracking-[0.32em] text-[var(--primary)]/80">
              Votre page praticien
            </p>
            <h2 className="mt-4 text-4xl font-semibold tracking-tight text-[var(--foreground)]">
              Une page qui travaille pour vous
            </h2>
            <p className="mt-4 text-sm leading-7 text-[var(--foreground-muted)]">
              Votre page NUADYX peut remplacer un mini site vitrine : elle regroupe
              votre présentation, vos soins, vos photos, vos créneaux et vos règles
              de réservation au même endroit.
            </p>
          </Card>

          <div className="grid gap-4 sm:grid-cols-2">
            {practitionerBenefits.map((item) => (
              <Card key={item} className="rounded-[1.7rem] p-5">
                <p className="text-sm leading-7 text-[var(--foreground)]">{item}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 py-10 md:px-6 md:py-14">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-3xl">
            <p className="text-xs uppercase tracking-[0.32em] text-[var(--primary)]/80">
              Visibilité progressive
            </p>
            <h2 className="mt-4 text-4xl font-semibold tracking-tight text-[var(--foreground)]">
              Plus votre page est claire, plus elle a de chances d’être mise en avant
            </h2>
            <p className="mt-4 text-sm leading-7 text-[var(--foreground-muted)]">
              NUADYX ne promet pas des résultats magiques. En revanche, un profil
              mieux renseigné, plus actif et plus fiable a plus de chances d’être
              bien visible dans l’annuaire, surtout pendant le lancement.
            </p>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {visibilitySignals.map((item) => (
              <Card key={item.title} className="rounded-[1.7rem]">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] text-[var(--primary)]">
                  <item.icon className="h-5 w-5" />
                </div>
                <h3 className="mt-5 text-xl font-semibold text-[var(--foreground)]">
                  {item.title}
                </h3>
                <p className="mt-3 text-sm leading-7 text-[var(--foreground-muted)]">
                  {item.description}
                </p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 py-10 md:px-6 md:py-14">
        <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[1.02fr_0.98fr]">
          <Card className="rounded-[1.9rem]">
            <p className="text-xs uppercase tracking-[0.32em] text-[var(--primary)]/80">
              Pensé pour le quotidien
            </p>
            <h2 className="mt-4 text-4xl font-semibold tracking-tight text-[var(--foreground)]">
              Une expérience simple à utiliser
            </h2>
            <div className="mt-6 grid gap-4 md:grid-cols-3">
              {[
                ["Simple sur mobile", "Gérez vos demandes et vos créneaux directement depuis votre téléphone."],
                ["Clair et lisible", "Une interface sans surcharge pour aller à l’essentiel."],
                ["Pensé pour le massage", "Pas un outil générique: une base adaptée à votre activité."],
              ].map(([title, text]) => (
                <div
                  key={title}
                  className="rounded-[1.4rem] border border-[var(--border)] bg-[var(--background-soft)] px-4 py-4"
                >
                  <p className="font-medium text-[var(--foreground)]">{title}</p>
                  <p className="mt-2 text-sm leading-6 text-[var(--foreground-muted)]">
                    {text}
                  </p>
                </div>
              ))}
            </div>
          </Card>

          <Card className="rounded-[1.9rem]">
            <p className="text-xs uppercase tracking-[0.32em] text-[var(--primary)]/80">
              Assistant virtuel
            </p>
            <div className="mt-4 flex items-start gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] text-[var(--primary)]">
                <Bot className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-3xl font-semibold text-[var(--foreground)]">
                  Répondre même quand vous n’êtes pas disponible
                </h2>
                <p className="mt-3 text-sm leading-7 text-[var(--foreground-muted)]">
                  Vous travaillez seul et vous n’avez pas d’assistant pour répondre
                  toute la journée ? Depuis votre espace, vous pouvez préparer un
                  assistant virtuel qui répond aux questions fréquentes, donne les
                  informations pratiques utiles et aide les visiteurs à passer du
                  simple intérêt à la réservation.
                </p>
              </div>
            </div>
            <div className="mt-6 space-y-3">
              {[
                "Comment se déroule une séance ?",
                "Que faut-il prévoir avant de venir ?",
                "Comment réserver ou déplacer un rendez-vous ?",
              ].map((question) => (
                <div
                  key={question}
                  className="rounded-[1.4rem] border border-[var(--border)] bg-[var(--background-soft)] px-4 py-3 text-sm text-[var(--foreground)]"
                >
                  {question}
                </div>
              ))}
            </div>
            <p className="mt-4 text-sm leading-7 text-[var(--foreground-muted)]">
              Vous restez concentré sur vos séances, pendant que votre page continue
              à rassurer, informer et convertir les visiteurs intéressés.
            </p>
          </Card>
        </div>
      </section>

      <section id="lancement" className="px-4 py-10 md:px-6 md:py-14">
        <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[0.92fr_1.08fr]">
          <Card className="rounded-[1.9rem]">
            <Badge tone="success">Gratuit pendant le lancement</Badge>
            <h2 className="mt-5 text-3xl font-semibold text-[var(--foreground)]">
              Inscription gratuite pendant le lancement
            </h2>
            <p className="mt-4 text-sm leading-7 text-[var(--foreground-muted)]">
              L’accès à NUADYX est actuellement gratuit pour les praticiens. Vous
              pouvez créer votre page, recevoir des demandes et tester la plateforme librement.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Link href="/inscription" className="w-full sm:w-auto">
                <Button size="lg" className="w-full sm:w-auto">
                  Rejoindre l’annuaire gratuitement
                </Button>
              </Link>
              <Link href="/trouver-un-praticien" className="w-full sm:w-auto">
                <Button variant="secondary" size="lg" className="w-full sm:w-auto">
                  Voir un exemple de profil public
                </Button>
              </Link>
            </div>
          </Card>

          <div className="grid gap-4 md:grid-cols-2">
            {[
              "Premiers praticiens mis en avant pendant le lancement",
              "Être visible dans l’annuaire sans créer un site complet",
              "Créer un lien public partageable dès maintenant",
              "Recevoir des demandes plus claires et plus faciles à suivre",
            ].map((item) => (
              <Card key={item} className="rounded-[1.7rem] p-5">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="mt-1 h-5 w-5 text-[var(--success)]" />
                  <p className="text-sm leading-7 text-[var(--foreground)]">{item}</p>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 py-10 md:px-6 md:py-14">
        <div className="mx-auto max-w-7xl rounded-[2rem] border border-[var(--border)] bg-[var(--surface-muted)] px-6 py-8">
          <div className="max-w-3xl">
            <p className="text-xs uppercase tracking-[0.32em] text-[var(--primary)]/80">
              Pour qui
            </p>
            <h2 className="mt-4 text-4xl font-semibold tracking-tight text-[var(--foreground)]">
              NUADYX s’adresse à vous si…
            </h2>
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {[
              "Vous êtes praticien en massage ou bien-être",
              "Vous voulez une page professionnelle sans créer un site",
              "Vous souhaitez recevoir plus de demandes de rendez-vous",
              "Vous voulez structurer votre activité simplement",
            ].map((item) => (
              <div
                key={item}
                className="rounded-[1.4rem] border border-[var(--border)] bg-[var(--background-soft)] px-4 py-4 text-sm leading-7 text-[var(--foreground)]"
              >
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 pb-14 pt-6 md:px-6">
        <div className="mx-auto max-w-7xl rounded-[2rem] border border-[var(--border)] bg-[var(--surface-muted)] px-6 py-8">
          <h2 className="text-4xl font-semibold tracking-tight text-[var(--foreground)]">
            Rejoignez les premiers praticiens NUADYX
          </h2>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-[var(--foreground-muted)]">
            Créez votre page, présentez vos soins et commencez à recevoir vos premières demandes.
          </p>
          <div className="mt-6">
            <Link href="/inscription">
              <Button size="lg" iconRight={<ArrowRight className="h-4 w-4" />}>
                Créer ma page gratuitement
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
