"use client";

import { type FormEvent, useEffect, useState } from "react";
import { Plus, Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { FieldWrapper, Input, Textarea } from "@/components/ui/field";
import { Notice } from "@/components/ui/notice";
import { SectionHeading } from "@/components/ui/section-heading";
import { Skeleton } from "@/components/ui/skeleton";
import { createService, getServices, type CreateServicePayload, type Service } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";

type ServiceVariantForm = {
  id: string;
  duration_minutes: number;
  price_eur: string;
};

function buildServiceVariant(
  duration_minutes = 60,
  price_eur = "95.00"
): ServiceVariantForm {
  return {
    id: crypto.randomUUID(),
    duration_minutes,
    price_eur,
  };
}

export default function ServicesPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [form, setForm] = useState<CreateServicePayload>({
    title: "",
    short_description: "",
    full_description: "",
    duration_minutes: 60,
    price_eur: "95.00",
    is_active: true,
    sort_order: 0,
  });
  const [variants, setVariants] = useState<ServiceVariantForm[]>([
    buildServiceVariant(),
  ]);

  async function load() {
    try {
      setLoading(true);
      const data = await getServices();
      setServices(data);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de charger les services.");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!form.title.trim() || !form.short_description.trim()) {
      setError("Titre et description courte sont requis.");
      return;
    }

    try {
      setSubmitting(true);
      await Promise.all(
        variants.map((variant, index) =>
          createService({
            ...form,
            duration_minutes: variant.duration_minutes,
            price_eur: variant.price_eur,
            sort_order: services.length + index + 1,
          })
        )
      );
      setForm({
        title: "",
        short_description: "",
        full_description: "",
        duration_minutes: 60,
        price_eur: "95.00",
        is_active: true,
        sort_order: services.length + 1,
      });
      setVariants([buildServiceVariant()]);
      setSuccess("Prestation ajoutée avec ses différentes durées.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Création impossible.");
    } finally {
      setSubmitting(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  return (
    <div className="space-y-6">
      <SectionHeading
        eyebrow="Prestations"
        title="Mes prestations"
        description="Présente tes soins avec des intitulés rassurants, des durées lisibles et des tarifs clairs pour donner envie de réserver."
        action={
          <Button
            size="lg"
            iconLeft={<Plus className="h-4 w-4" />}
            onClick={() =>
              document.getElementById("service-form")?.scrollIntoView({
                behavior: "smooth",
                block: "start",
              })
            }
          >
            Ajouter une prestation
          </Button>
        }
      />

      {error ? <Notice tone="error">{error}</Notice> : null}
      {success ? <Notice tone="success">{success}</Notice> : null}

      <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        <Card id="service-form">
          <CardHeader
            title="Ajouter une prestation"
            subtitle="Un formulaire simple et valorisant pour présenter clairement chaque soin proposé."
          />
          <form onSubmit={handleCreate} className="mt-6 grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <FieldWrapper label="Nom de la prestation">
                <Input
                  value={form.title}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      title: event.target.value,
                    }))
                  }
                  placeholder="Massage signature deep tissue"
                  required
                />
              </FieldWrapper>
            </div>

            <div className="md:col-span-2">
              <FieldWrapper label="Description courte" hint="255 caractères">
                <Input
                  value={form.short_description}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      short_description: event.target.value,
                    }))
                  }
                  placeholder="Une séance intense pour libérer tensions et fatigue musculaire."
                  required
                />
              </FieldWrapper>
            </div>

            <div className="md:col-span-2 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-[var(--foreground)]">
                    Durées et tarifs
                  </p>
                  <p className="mt-1 text-sm text-[var(--foreground-muted)]">
                    Tu peux proposer plusieurs formats pour une même prestation.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    setVariants((current) => [...current, buildServiceVariant()])
                  }
                >
                  Ajouter une durée
                </Button>
              </div>

              {variants.map((variant, index) => (
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
                        setVariants((current) =>
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
                    />
                  </FieldWrapper>

                  <FieldWrapper label="Prix TTC">
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={variant.price_eur}
                      onChange={(event) =>
                        setVariants((current) =>
                          current.map((item) =>
                            item.id === variant.id
                              ? { ...item, price_eur: event.target.value }
                              : item
                          )
                        )
                      }
                    />
                  </FieldWrapper>

                  <div className="flex items-end">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={variants.length === 1}
                      onClick={() =>
                        setVariants((current) =>
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

            <div className="md:col-span-2">
              <FieldWrapper label="Description complète">
                <Textarea
                  value={form.full_description}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      full_description: event.target.value,
                    }))
                  }
                  placeholder="Décris l'expérience, les bénéfices et le déroulé de la séance."
                />
              </FieldWrapper>
            </div>

            <div className="md:col-span-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm leading-6 text-[var(--foreground-muted)]">
                Les nouveaux services sont créés actifs pour accélérer la mise en
                ligne de tes prestations.
              </p>
              <Button type="submit" size="lg" disabled={submitting}>
                {submitting ? "Création..." : "Enregistrer la prestation"}
              </Button>
            </div>
          </form>
        </Card>

        <Card>
          <CardHeader
            title="Prestations déjà en ligne"
            subtitle="Retrouve tes prestations dans une présentation claire, rassurante et facile à parcourir."
          />

          {loading ? (
            <div className="mt-6 space-y-4">
              {Array.from({ length: 3 }).map((_, index) => (
                <Skeleton key={index} className="h-40 rounded-[1.6rem]" />
              ))}
            </div>
          ) : services.length === 0 ? (
            <div className="mt-6">
              <EmptyState
                eyebrow="Prestations vides"
                title="Ajouter la première prestation"
                description="Crée une première fiche avec un nom clair, une durée et un tarif compréhensibles. Ta page publique gagnera immédiatement en crédibilité."
                actionLabel="Ajouter une prestation"
                onAction={() =>
                  document.getElementById("service-form")?.scrollIntoView({
                    behavior: "smooth",
                    block: "start",
                  })
                }
                icon={<Sparkles className="h-5 w-5" />}
              />
            </div>
          ) : (
            <div className="mt-6 grid gap-4">
              {services.map((service) => (
                <div
                  key={service.id}
                  className="rounded-[1.6rem] border border-[var(--border)] bg-[var(--surface-muted)] p-5"
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-xl font-semibold text-[var(--foreground)]">
                          {service.title}
                        </h3>
                        <Badge tone={service.is_active ? "success" : "neutral"}>
                          {service.is_active ? "Actif" : "Brouillon"}
                        </Badge>
                      </div>
                      <p className="mt-3 text-sm leading-6 text-[var(--foreground-muted)]">
                        {service.short_description}
                      </p>
                    </div>
                    <div className="rounded-[1.2rem] border border-[var(--border)] bg-[var(--background-soft)] px-4 py-3 text-right">
                      <p className="text-xs uppercase tracking-[0.24em] text-[var(--foreground-subtle)]">
                        Tarif
                      </p>
                      <p className="mt-2 text-xl font-semibold text-[var(--foreground)]">
                        {formatCurrency(service.price_eur)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 flex flex-wrap gap-2">
                    <Badge tone="info">{service.duration_minutes} min</Badge>
                    <Badge>Ordre {service.sort_order}</Badge>
                  </div>

                  {service.full_description ? (
                    <p className="mt-4 text-sm leading-6 text-[var(--foreground-muted)]">
                      {service.full_description}
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
