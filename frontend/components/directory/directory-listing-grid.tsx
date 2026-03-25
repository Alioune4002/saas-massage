"use client";

import Link from "next/link";
import { MapPin, ShieldCheck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Notice } from "@/components/ui/notice";
import { Skeleton } from "@/components/ui/skeleton";
import { type DirectoryListing } from "@/lib/api";
import { MASSAGE_CATEGORY_LABELS } from "@/lib/directory";
import { getPublicProfileTheme } from "@/lib/public-profile";
import { getInitials } from "@/lib/utils";

type DirectoryListingGridProps = {
  items: DirectoryListing[];
  loading: boolean;
  emptyMessage?: string;
};

export function DirectoryListingGrid({
  items,
  loading,
  emptyMessage = "Aucun praticien encore référencé. Soyez le premier à créer votre page.",
}: DirectoryListingGridProps) {
  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton key={index} className="h-80 rounded-[1.8rem]" />
        ))}
      </div>
    );
  }

  if (!items.length) {
    return <Notice tone="info">{emptyMessage}</Notice>;
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {items.map((item) => {
        const theme = getPublicProfileTheme(
          item.visual_theme === "chaleur" || item.visual_theme === "prestige"
            ? item.visual_theme
            : "epure"
        );

        return (
          <Card key={`${item.listing_kind}-${item.id}`} className="overflow-hidden rounded-[1.8rem] p-0">
            <div className={`relative h-36 ${theme.heroGradient}`}>
              <div className="absolute inset-0 bg-[linear-gradient(180deg,var(--hero-scrim),var(--hero-scrim-strong))]" />
              <div className="relative flex h-full items-end justify-between p-5">
                <div className="flex items-center gap-3 text-[var(--inverse-foreground)]">
                  <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-[1.25rem] border border-[var(--hero-card-border)] bg-[var(--hero-card-surface-strong)] text-lg font-semibold">
                    {item.profile_photo_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.profile_photo_url}
                        alt={item.business_name}
                        loading="lazy"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      getInitials(item.business_name)
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs uppercase tracking-[0.22em] text-[var(--inverse-foreground-subtle)]">
                      {item.listing_kind === "claimed" ? "Page praticien" : "Fiche à compléter"}
                    </p>
                    <p className="mt-1 truncate text-lg font-semibold">
                      {item.business_name}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4 p-5">
              <div className="flex items-center gap-2 text-sm text-[var(--foreground-muted)]">
                <MapPin className="h-4 w-4" />
                {item.service_area || item.city || "Ville à préciser"}
              </div>

              {item.public_headline ? (
                <p className="text-base font-medium text-[var(--foreground)]">
                  {item.public_headline}
                </p>
              ) : null}

              <p className="text-sm leading-7 text-[var(--foreground-muted)]">
                {item.bio ||
                  (item.listing_kind === "claimed"
                    ? "Découvrez une page praticien NUADYX pensée pour présenter les soins et faciliter les demandes de rendez-vous."
                    : "Informations de base publiées pour aider le praticien à revendiquer et compléter sa fiche." )}
              </p>

              <div className="flex flex-wrap gap-2">
                {item.verification_badge ? (
                  <Badge tone="success">
                    <ShieldCheck className="mr-1 h-3.5 w-3.5" />
                    {item.verification_badge.label}
                  </Badge>
                ) : null}
                {item.massage_categories.slice(0, 2).map((category) => (
                  <Badge key={category} tone="info">
                    {MASSAGE_CATEGORY_LABELS[category] || category}
                  </Badge>
                ))}
                {item.specialties.slice(0, item.massage_categories.length ? 1 : 3).map((specialty) => (
                  <Badge key={specialty}>{specialty}</Badge>
                ))}
              </div>

              {item.claim_notice ? (
                <Notice tone="info">{item.claim_notice}</Notice>
              ) : null}

              <Link href={item.listing_url} className="inline-flex w-full">
                <Button size="lg" className="w-full">
                  {item.listing_kind === "claimed"
                    ? "Voir la page praticien"
                    : "Voir la fiche et la revendiquer"}
                </Button>
              </Link>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
