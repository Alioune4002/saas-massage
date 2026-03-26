import Link from "next/link";
import { ArrowRight, Heart, MapPin, Search, Star } from "lucide-react";

import { LocationAutosuggest } from "@/components/directory/location-autosuggest";
import { LaunchInterestForm } from "@/components/marketing/launch-interest-form";
import { SiteHeader } from "@/components/marketing/site-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const clientHighlights = [
  {
    title: "Chercher par ville ou code postal",
    description:
      "Trouvez des praticiens par ville, code postal, département ou région grâce à la recherche locale NUADYX.",
    icon: Search,
  },
  {
    title: "Comparer des profils clairs",
    description:
      "Consultez la présentation, les soins, les avis, les règles de réservation et les créneaux quand ils sont disponibles.",
    icon: Star,
  },
  {
    title: "Retrouver vos praticiens favoris",
    description:
      "Conservez une liste de praticiens à retrouver facilement pour reprendre rendez-vous plus tard.",
    icon: Heart,
  },
];

export default function FindPractitionerPage() {
  return (
    <main className="min-h-screen text-[var(--foreground)]">
      <SiteHeader mode="client" />

      <section id="recherche-locale" className="px-4 pb-8 pt-6 md:px-6 md:pb-12 md:pt-10">
        <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[1.02fr_0.98fr]">
          <Card className="rounded-[2rem] p-6 md:p-8">
            <Badge tone="info">Entrée client</Badge>
            <h1 className="mt-5 text-4xl font-semibold tracking-tight text-[var(--foreground)] md:text-5xl">
              Trouvez un praticien du massage et du bien-être près de chez vous
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-[var(--foreground-muted)]">
              Recherchez dans l’annuaire par ville, code postal, département ou région.
              Parcourez les profils publics, ajoutez vos favoris et découvrez les
              praticiens déjà visibles sur NUADYX.
            </p>

            <div className="mt-6 max-w-xl">
              <LocationAutosuggest
                label="Où cherchez-vous ?"
                hint="Ville, code postal, département ou région"
              />
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Link href="/annuaire">
                <Button size="lg" iconRight={<ArrowRight className="h-4 w-4" />}>
                  Parcourir l’annuaire
                </Button>
              </Link>
              <Link href="/favoris">
                <Button size="lg" variant="secondary">
                  Voir mes favoris
                </Button>
              </Link>
            </div>
          </Card>

          <div className="grid gap-4">
            {clientHighlights.map((item) => (
              <Card key={item.title} className="rounded-[1.7rem] p-6">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] text-[var(--primary)]">
                  <item.icon className="h-5 w-5" />
                </div>
                <h2 className="mt-5 text-xl font-semibold text-[var(--foreground)]">
                  {item.title}
                </h2>
                <p className="mt-3 text-sm leading-7 text-[var(--foreground-muted)]">
                  {item.description}
                </p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 py-10 md:px-6 md:py-14">
        <div className="mx-auto max-w-7xl rounded-[2rem] border border-[var(--border)] bg-[var(--surface-muted)] px-6 py-8">
          <div className="max-w-3xl">
            <p className="text-xs uppercase tracking-[0.32em] text-[var(--primary)]/80">
              Découvrir l’annuaire
            </p>
            <h2 className="mt-4 text-4xl font-semibold tracking-tight text-[var(--foreground)]">
              Consultez les profils, les soins et les disponibilités quand elles sont ouvertes
            </h2>
            <p className="mt-4 text-sm leading-7 text-[var(--foreground-muted)]">
              L’annuaire NUADYX vous aide à comparer des profils publics plus lisibles
              qu’une simple fiche sociale. Vous pouvez ensuite réserver, envoyer une
              demande ou conserver vos praticiens préférés.
            </p>
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Link href="/annuaire">
              <Button size="lg">Voir les praticiens</Button>
            </Link>
            <Link href="/inscription">
              <Button variant="secondary" size="lg">
                Je suis praticien
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <section id="recommander" className="px-4 pb-14 pt-2 md:px-6">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-3xl">
            <p className="text-xs uppercase tracking-[0.32em] text-[var(--primary)]/80">
              Développer l’annuaire
            </p>
            <h2 className="mt-4 text-4xl font-semibold tracking-tight text-[var(--foreground)]">
              Aidez-nous à mieux couvrir votre ville
            </h2>
          </div>

          <div className="mt-8 grid gap-4 xl:grid-cols-3">
            <LaunchInterestForm
              kind="suggest_practitioner"
              title="Suggérer un praticien"
              description="Proposez un praticien à référencer. La suggestion part en revue interne avant toute action."
            />
            <LaunchInterestForm
              kind="recommend_masseur"
              title="Recommander mon masseur"
              description="Vous avez déjà un praticien de confiance ? Recommandez-le sans créer automatiquement de fiche publique."
              practitionerLabel="Nom de votre masseur"
            />
            <LaunchInterestForm
              kind="city_waitlist"
              title="Être prévenu dans ma ville"
              description="Laissez vos coordonnées si vous voulez être prévenu quand l’offre s’ouvre dans votre zone."
            />
          </div>

          <div className="mt-6 rounded-[1.7rem] border border-[var(--border)] bg-[var(--background-soft)] px-5 py-5 text-sm leading-7 text-[var(--foreground-muted)]">
            <div className="flex items-start gap-3">
              <MapPin className="mt-1 h-5 w-5 text-[var(--primary)]" />
              <p>
                Les suggestions et attentes locales aident NUADYX à prioriser les villes
                à lancer, mais ne créent jamais de faux praticiens ni de faux profils publics.
              </p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
