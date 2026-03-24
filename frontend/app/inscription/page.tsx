"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowRight, CheckCircle2, UserPlus2 } from "lucide-react";

import { NuadyxLogo } from "@/components/brand/nuadyx-logo";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FieldWrapper, Input } from "@/components/ui/field";
import { Notice } from "@/components/ui/notice";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { registerPractitioner } from "@/lib/api";
import { getAuthenticatedHomePath, hydrateSession } from "@/lib/auth";
import { fadeInUp, staggerContainer } from "@/lib/motion";

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    password: "",
    password_confirmation: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const result = await registerPractitioner(form);
      const user = await hydrateSession(result.token);
      router.push(getAuthenticatedHomePath(user));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Impossible de créer l’espace praticien."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden px-4 py-8 text-[var(--foreground)] md:px-6">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(124,156,255,0.22),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(143,242,203,0.18),transparent_28%)]" />

      <div className="relative mx-auto flex min-h-[calc(100vh-4rem)] max-w-6xl items-center">
        <motion.div
          className="grid w-full items-center gap-6 lg:grid-cols-[1.02fr_0.98fr]"
          variants={staggerContainer}
          initial="initial"
          animate="animate"
        >
          <motion.section
            initial={fadeInUp.initial}
            animate={fadeInUp.animate}
            transition={fadeInUp.transition}
            className="hidden lg:block"
          >
            <div className="mb-10 flex items-center justify-between gap-4">
              <NuadyxLogo priority />
              <ThemeToggle />
            </div>

            <div className="max-w-xl">
              <p className="text-sm uppercase tracking-[0.34em] text-[var(--primary)]/80">
                Créer mon espace praticien
              </p>
              <h1 className="mt-6 text-balance text-5xl font-semibold leading-[1.05] tracking-tight text-[var(--foreground)]">
                Préparez votre espace professionnel, votre page publique et vos
                premiers rendez-vous.
              </h1>
              <p className="mt-6 max-w-lg text-lg leading-8 text-[var(--foreground-muted)]">
                En quelques étapes, NUADYX vous aide à présenter vos soins,
                ouvrir vos créneaux et donner confiance dès la première visite.
              </p>
            </div>

            <div className="mt-10 space-y-3">
              {[
                "Votre page publique réservable est préparée dès le départ.",
                "Vos premiers soins et vos premiers créneaux peuvent être créés tout de suite.",
                "Le parcours s’adapte à votre façon d’exercer.",
              ].map((item) => (
                <div
                  key={item}
                  className="glass-panel flex items-center gap-3 rounded-[1.6rem] p-4 text-sm leading-6 text-[var(--foreground-muted)]"
                >
                  <CheckCircle2 className="h-4.5 w-4.5 text-[var(--primary)]" />
                  {item}
                </div>
              ))}
            </div>
          </motion.section>

          <motion.section
            initial={fadeInUp.initial}
            animate={fadeInUp.animate}
            transition={fadeInUp.transition}
          >
            <Card className="relative overflow-hidden rounded-[2rem] p-6 md:p-8">
              <div className="absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(143,242,203,0.6),transparent)]" />

              <div className="mb-8 flex items-center justify-between gap-4">
                <NuadyxLogo compact priority className="lg:hidden" />
                <div className="flex items-center gap-2">
                  <ThemeToggle compact />
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] text-[var(--primary)]">
                    <UserPlus2 className="h-5 w-5" />
                  </div>
                </div>
              </div>

              <p className="text-xs uppercase tracking-[0.34em] text-[var(--primary)]/80">
                Inscription praticien
              </p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-[var(--foreground)]">
                Créer mon espace
              </h2>
              <p className="mt-3 text-sm leading-6 text-[var(--foreground-muted)]">
                Nous créons votre compte, votre espace praticien et une base de
                profil public que vous compléterez ensuite pas à pas.
              </p>

              <form onSubmit={handleSubmit} className="mt-8 space-y-5">
                <div className="grid gap-4 sm:grid-cols-2">
                  <FieldWrapper label="Prénom">
                    <Input
                      autoComplete="given-name"
                      value={form.first_name}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          first_name: event.target.value,
                        }))
                      }
                      required
                    />
                  </FieldWrapper>

                  <FieldWrapper label="Nom">
                    <Input
                      autoComplete="family-name"
                      value={form.last_name}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          last_name: event.target.value,
                        }))
                      }
                      required
                    />
                  </FieldWrapper>
                </div>

                <FieldWrapper label="Email professionnel">
                  <Input
                    type="email"
                    autoComplete="email"
                    value={form.email}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        email: event.target.value,
                      }))
                    }
                    required
                  />
                </FieldWrapper>

                <div className="grid gap-4 sm:grid-cols-2">
                  <FieldWrapper label="Mot de passe">
                    <Input
                      type="password"
                      autoComplete="new-password"
                      value={form.password}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          password: event.target.value,
                        }))
                      }
                      required
                    />
                  </FieldWrapper>

                  <FieldWrapper label="Confirmer le mot de passe">
                    <Input
                      type="password"
                      autoComplete="new-password"
                      value={form.password_confirmation}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          password_confirmation: event.target.value,
                        }))
                      }
                      required
                    />
                  </FieldWrapper>
                </div>

                {error ? <Notice tone="error">{error}</Notice> : null}

                <Button
                  type="submit"
                  disabled={loading}
                  size="lg"
                  className="w-full"
                  iconRight={<ArrowRight className="h-4.5 w-4.5" />}
                >
                  {loading ? "Création..." : "Créer mon espace praticien"}
                </Button>
              </form>

              <div className="mt-6 text-sm text-[var(--foreground-muted)]">
                Déjà inscrit ?{" "}
                <Link href="/login" className="font-medium text-[var(--primary)]">
                  Se connecter
                </Link>
              </div>
            </Card>
          </motion.section>
        </motion.div>
      </div>
    </main>
  );
}
