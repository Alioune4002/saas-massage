"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowRight, LockKeyhole, Sparkles } from "lucide-react";

import { NuadyxLogo } from "@/components/brand/nuadyx-logo";
import { useBackendStatus } from "@/components/providers/backend-status-provider";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FieldWrapper, Input } from "@/components/ui/field";
import { Notice } from "@/components/ui/notice";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { loginWithEmailPassword } from "@/lib/api";
import { getAuthenticatedHomePath, hydrateSession } from "@/lib/auth";
import { fadeInUp, staggerContainer } from "@/lib/motion";

export default function LoginPage() {
  const router = useRouter();
  const { backendUnavailable } = useBackendStatus();

  const [email, setEmail] = useState("alioune.bsk@gmail.com");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [serviceUnavailable, setServiceUnavailable] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setServiceUnavailable(params.get("service") === "unavailable");
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (backendUnavailable) {
      setError(
        "Le service est temporairement indisponible. La connexion sécurisée reprendra dès que le backend sera revenu."
      );
      return;
    }

    setLoading(true);

    try {
      const result = await loginWithEmailPassword({ email, password });
      const user = await hydrateSession(result.token);
      router.push(getAuthenticatedHomePath(user));
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Impossible de se connecter.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden px-4 py-8 text-[var(--foreground)] md:px-6">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(124,156,255,0.22),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(143,242,203,0.18),transparent_28%)]" />

      <div className="relative mx-auto flex min-h-[calc(100vh-4rem)] max-w-6xl items-center">
        <motion.div
          className="grid w-full items-center gap-6 lg:grid-cols-[1.05fr_0.95fr]"
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
                Plateforme praticien
              </p>
              <h1 className="mt-6 text-balance text-5xl font-semibold leading-[1.05] tracking-tight text-[var(--foreground)]">
                La couche premium pour gérer une activité de massage comme un
                vrai service en ligne.
              </h1>
              <p className="mt-6 max-w-lg text-lg leading-8 text-[var(--foreground-muted)]">
                Planning, services, réservations et prochaines briques produit
                réunis dans une interface crédible, respirante et pensée pour
                être vendue.
              </p>
            </div>

            <div className="mt-10 grid gap-4 sm:grid-cols-3">
              {[
                "Image haut de gamme",
                "UX mobile-first",
                "Base prête pour la suite",
              ].map((item) => (
                <div
                  key={item}
                  className="glass-panel rounded-[1.6rem] p-4 text-sm leading-6 text-[var(--foreground-muted)]"
                >
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
                    <LockKeyhole className="h-5 w-5" />
                  </div>
                </div>
              </div>

              <p className="text-xs uppercase tracking-[0.34em] text-[var(--primary)]/80">
                Connexion sécurisée
              </p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-[var(--foreground)]">
                Accéder à NUADYX
              </h2>
              <p className="mt-3 text-sm leading-6 text-[var(--foreground-muted)]">
                Connecte-toi à ton espace professionnel pour piloter ton
                activité, ton catalogue et tes réservations.
              </p>

              {backendUnavailable || serviceUnavailable ? (
                <Notice tone="error" className="mt-4">
                  Le service backend est temporairement indisponible. Tu peux
                  consulter le site, mais la connexion sécurisée reprendra quand
                  le service sera rétabli.
                </Notice>
              ) : null}

              <p className="mt-3 text-sm leading-6 text-[var(--foreground-muted)]">
                Pas encore d’espace praticien ?{" "}
                <Link href="/inscription" className="font-medium text-[var(--primary)]">
                  Créer mon espace
                </Link>
              </p>

              <form onSubmit={handleSubmit} className="mt-8 space-y-5">
                <FieldWrapper label="Email professionnel">
                  <Input
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="email@nuadyx.app"
                    required
                  />
                </FieldWrapper>

                <FieldWrapper label="Mot de passe">
                  <Input
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Votre mot de passe"
                    required
                  />
                </FieldWrapper>

                {error ? <Notice tone="error">{error}</Notice> : null}

                <Button
                  type="submit"
                  disabled={loading || backendUnavailable}
                  size="lg"
                  className="w-full"
                  iconRight={<ArrowRight className="h-4.5 w-4.5" />}
                >
                  {loading
                    ? "Connexion..."
                    : backendUnavailable
                      ? "Service temporairement indisponible"
                      : "Accéder à l’espace pro"}
                </Button>
              </form>

              <div className="mt-8 flex items-center gap-3 rounded-[1.3rem] border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3 text-sm text-[var(--foreground-muted)]">
                <Sparkles className="h-4.5 w-4.5 text-[var(--primary)]" />
                Interface haut de gamme, pensée pour un usage quotidien.
              </div>
            </Card>
          </motion.section>
        </motion.div>
      </div>
    </main>
  );
}
