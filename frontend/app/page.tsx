import Link from "next/link";
import {
  ArrowRight,
  Bot,
  CalendarClock,
  CheckCircle2,
  LayoutDashboard,
  Sparkles,
  WalletCards,
} from "lucide-react";

import { DashboardPreview } from "@/components/marketing/dashboard-preview";
import { SiteHeader } from "@/components/marketing/site-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const featureCards = [
  {
    title: "Gestion des services",
    description:
      "Catalogue structuré, prix clairs, descriptions cohérentes et meilleure perception de valeur.",
    icon: Sparkles,
  },
  {
    title: "Disponibilités / planning",
    description:
      "Créneaux lisibles, confortables sur mobile et simples à maintenir au quotidien.",
    icon: CalendarClock,
  },
  {
    title: "Réservations",
    description:
      "Pipeline clair pour confirmer, suivre et professionnaliser chaque demande cliente.",
    icon: LayoutDashboard,
  },
  {
    title: "Espace pro",
    description:
      "Une base produit crédible pour opérer, vendre et préparer les prochains modules métier.",
    icon: WalletCards,
  },
  {
    title: "Assistant métier",
    description:
      "Prévu pour enrichir l’expérience avec aide opérationnelle, automation et accompagnement.",
    icon: Bot,
  },
  {
    title: "Expérience premium",
    description:
      "Rendu cohérent desktop/mobile, thème clair/sombre et navigation pensée comme un vrai produit.",
    icon: CheckCircle2,
  },
];

const audiences = [
  "Praticiens indépendants en massage et bien-être",
  "Studios premium qui veulent structurer leur offre",
  "Professionnels qui veulent passer d’un outil bricolé à un produit vendable",
];

const steps = [
  {
    title: "Configure ton espace",
    description:
      "Crée ton catalogue, pose ta présence et prépare un espace pro crédible.",
  },
  {
    title: "Publie ton planning",
    description:
      "Ouvre tes créneaux, structure tes disponibilités et simplifie la prise de rendez-vous.",
  },
  {
    title: "Pilote ton activité",
    description:
      "Suis tes réservations, professionnalise la relation client et prépare la croissance.",
  },
];

const trustPoints = [
  "Interface premium pensée pour être commercialisée",
  "Architecture claire pour modules futurs: facturation, assistant, automatisations",
  "Expérience mobile-first sans sacrifier le confort sur ordinateur",
  "Mode clair / sombre cohérent pour usage quotidien prolongé",
];

export default function HomePage() {
  return (
    <main className="min-h-screen text-[var(--foreground)]">
      <SiteHeader />

      <section className="px-4 pb-8 pt-6 md:px-6 md:pb-12 md:pt-10">
        <div className="mx-auto grid max-w-7xl items-center gap-8 lg:grid-cols-[1.02fr_0.98fr] lg:gap-10">
          <div>
            <Badge tone="info">Plateforme premium pour massage & bien-être</Badge>
            <h1 className="mt-6 text-balance text-5xl font-semibold leading-[1.02] tracking-tight text-[var(--foreground)] md:text-6xl">
              NUADYX aide les professionnels du massage à opérer comme une
              marque premium.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-[var(--foreground-muted)]">
              Créez votre espace professionnel, présentez vos soins, ouvrez vos
              créneaux et recevez vos demandes de rendez-vous dans une expérience
              pensée pour le massage et le bien-être.
            </p>

            <div className="mt-8 grid gap-3 sm:grid-cols-2 xl:flex xl:flex-wrap">
              <Link href="/inscription" className="w-full xl:w-auto">
                <Button
                  size="lg"
                  className="w-full xl:w-auto"
                  iconRight={<ArrowRight className="h-4 w-4" />}
                >
                  Créer mon espace
                </Button>
              </Link>
              <Link href="/praticiens" className="w-full xl:w-auto">
                <Button variant="secondary" size="lg" className="w-full xl:w-auto">
                  Découvrir un exemple de page praticien
                </Button>
              </Link>
              <a href="#overview" className="w-full xl:w-auto">
                <Button variant="ghost" size="lg" className="w-full xl:w-auto">
                  Découvrir la plateforme
                </Button>
              </a>
              <Link href="/login" className="w-full xl:w-auto">
                <Button variant="secondary" size="lg" className="w-full xl:w-auto">
                  Se connecter
                </Button>
              </Link>
            </div>

            <div className="mt-10 grid gap-3 sm:grid-cols-3">
              {[
                ["+ premium", "Une présence plus crédible dès le premier contact"],
                ["+ fluide", "Navigation pensée pour le doigt et l’usage quotidien"],
                ["+ durable", "Une base prête pour la facturation, l’assistant et la croissance"],
              ].map(([label, text]) => (
                <Card key={label} className="rounded-[1.6rem] p-4">
                  <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--primary)]/80">
                    {label}
                  </p>
                  <p className="mt-3 text-sm leading-6 text-[var(--foreground-muted)]">
                    {text}
                  </p>
                </Card>
              ))}
            </div>
          </div>

          <div id="overview">
            <DashboardPreview />
          </div>
        </div>
      </section>

      <section className="px-4 py-8 md:px-6 md:py-10">
        <div className="mx-auto max-w-7xl rounded-[2rem] border border-[var(--border)] bg-[var(--surface-muted)] px-6 py-5">
          <div className="flex flex-col gap-4 text-sm text-[var(--foreground-muted)] md:flex-row md:items-center md:justify-between">
            <p className="uppercase tracking-[0.26em] text-[var(--primary)]/75">
              Conçu pour un vrai produit commercialisable
            </p>
            <div className="flex flex-wrap gap-4">
              <span>Planning premium</span>
              <span>Réservations lisibles</span>
              <span>Expérience claire / sombre</span>
              <span>Base produit crédible</span>
            </div>
          </div>
        </div>
      </section>

      <section id="benefices" className="px-4 py-10 md:px-6 md:py-14">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-3xl">
            <p className="text-xs uppercase tracking-[0.32em] text-[var(--primary)]/80">
              Fonctionnalités clés
            </p>
            <h2 className="mt-4 text-4xl font-semibold tracking-tight text-[var(--foreground)]">
              Tout ce qu’il faut pour gérer une activité premium sans perdre en
              lisibilité.
            </h2>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {featureCards.map((item) => (
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

      <section id="pour-qui" className="px-4 py-10 md:px-6 md:py-14">
        <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <Card className="rounded-[1.9rem]">
            <p className="text-xs uppercase tracking-[0.32em] text-[var(--primary)]/80">
              Pour qui
            </p>
            <h2 className="mt-4 text-3xl font-semibold text-[var(--foreground)]">
              NUADYX s’adresse aux pros qui veulent passer au niveau produit.
            </h2>
            <p className="mt-4 text-sm leading-7 text-[var(--foreground-muted)]">
              Pas un simple tableau de bord générique: une base pensée pour
              les réalités du massage, du bien-être et de la relation client.
            </p>
          </Card>

          <div className="grid gap-4 md:grid-cols-3">
            {audiences.map((item) => (
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
              Comment ça marche
            </p>
            <h2 className="mt-4 text-4xl font-semibold tracking-tight text-[var(--foreground)]">
              Une mise en route simple, avec une structure prête pour durer.
            </h2>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {steps.map((item, index) => (
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

      <section id="pricing" className="px-4 py-10 md:px-6 md:py-14">
        <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[0.86fr_1.14fr]">
          <Card className="rounded-[1.9rem]">
            <Badge tone="success">Tarification à venir</Badge>
            <h2 className="mt-5 text-3xl font-semibold text-[var(--foreground)]">
              Tarification pensée pour un service premium, pas pour un outil bricolé.
            </h2>
            <p className="mt-4 text-sm leading-7 text-[var(--foreground-muted)]">
              La structure produit est prête pour accueillir offres, upsells,
              billing et différents niveaux d’usage.
            </p>
          </Card>

          <div className="grid gap-4 md:grid-cols-3">
            {[
              ["Essentiel", "À venir", "Pour lancer une activité avec un espace pro propre."],
              ["Pro", "À venir", "Pour structurer planning, réservations et expérience client."],
              ["Studio", "Sur mesure", "Pour équipes, parcours avancés et modules complémentaires."],
            ].map(([title, price, text]) => (
              <Card key={title} className="rounded-[1.7rem] p-5">
                <p className="text-sm uppercase tracking-[0.22em] text-[var(--primary)]/80">
                  {title}
                </p>
                <p className="mt-4 text-3xl font-semibold text-[var(--foreground)]">
                  {price}
                </p>
                <p className="mt-3 text-sm leading-7 text-[var(--foreground-muted)]">
                  {text}
                </p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 py-10 md:px-6 md:py-14">
        <div className="mx-auto max-w-7xl rounded-[2rem] border border-[var(--border)] bg-[var(--surface-muted)] px-6 py-8">
          <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
            <div>
              <p className="text-xs uppercase tracking-[0.32em] text-[var(--primary)]/80">
                Confiance produit
              </p>
              <h2 className="mt-4 text-4xl font-semibold tracking-tight text-[var(--foreground)]">
                NUADYX donne une impression sérieuse avant même la première démo.
              </h2>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {trustPoints.map((item) => (
                <div
                  key={item}
                  className="rounded-[1.4rem] border border-[var(--border)] bg-[var(--background-soft)] px-4 py-4 text-sm leading-7 text-[var(--foreground-muted)]"
                >
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <footer className="px-4 pb-8 pt-6 md:px-6">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 rounded-[1.8rem] border border-[var(--border)] bg-[var(--surface-muted)] px-5 py-5 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold text-[var(--foreground)]">NUADYX</p>
            <p className="mt-1 text-sm text-[var(--foreground-muted)]">
              Plateforme premium pour professionnels du massage et du bien-être.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 md:flex">
            <Link href="/login" className="w-full md:w-auto">
              <Button variant="secondary" size="md" className="w-full md:w-auto">
                Se connecter
              </Button>
            </Link>
            <Link href="/inscription" className="w-full md:w-auto">
              <Button size="md" className="w-full md:w-auto">
                Créer mon espace
              </Button>
            </Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
