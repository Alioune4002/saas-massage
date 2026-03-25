"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Globe, Instagram, Mail, MapPin, Phone } from "lucide-react";

import { PublicProfilePage } from "@/components/public-profile/public-profile-page";
import { UnclaimedProfileBanner } from "@/components/directory/unclaimed-profile-banner";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Notice } from "@/components/ui/notice";
import { Skeleton } from "@/components/ui/skeleton";
import {
  getUnifiedPublicPractitioner,
  type UnifiedPublicPractitioner,
} from "@/lib/api";

type PublicPractitionerRoutePageProps = {
  slug: string;
};

export function PublicPractitionerRoutePage({
  slug,
}: PublicPractitionerRoutePageProps) {
  const [data, setData] = useState<UnifiedPublicPractitioner | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        setLoading(true);
        const result = await getUnifiedPublicPractitioner(slug);
        if (!active) {
          return;
        }
        setData(result);
        setError("");
      } catch (err) {
        if (!active) {
          return;
        }
        setError(err instanceof Error ? err.message : "Fiche indisponible.");
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
  }, [slug]);

  if (loading) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-8 md:px-6">
        <Skeleton className="h-16 rounded-[1.8rem]" />
        <Skeleton className="mt-4 h-64 rounded-[2rem]" />
      </main>
    );
  }

  if (error || !data) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-10 md:px-6">
        <Notice tone="error">{error || "Ce profil n’est pas disponible."}</Notice>
      </main>
    );
  }

  if (data.kind === "claimed" && data.claimed_profile) {
    return <PublicProfilePage slug={slug} />;
  }

  const profile = data.imported_profile;
  if (!profile) {
    return null;
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 md:px-6">
      <UnclaimedProfileBanner slug={slug} profileId={profile.id} />

      <Card className="mt-6 rounded-[2rem] p-6 md:p-8">
        <Badge tone="info">Fiche non revendiquée</Badge>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight text-[var(--foreground)] md:text-5xl">
          {profile.business_name || profile.public_name}
        </h1>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-[var(--foreground-muted)]">
          {profile.bio_short || profile.public_status_note || "Certaines informations sont encore à confirmer par le praticien."}
        </p>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div className="space-y-3 text-sm text-[var(--foreground-muted)]">
            <p className="flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              {profile.city || "Ville à confirmer"}
              {profile.region ? `, ${profile.region}` : ""}
            </p>
            {profile.phone_public ? (
              <p className="flex items-center gap-2">
                <Phone className="h-4 w-4" />
                {profile.phone_public}
              </p>
            ) : null}
            {profile.email_public ? (
              <p className="flex items-center gap-2">
                <Mail className="h-4 w-4" />
                {profile.email_public}
              </p>
            ) : null}
            {profile.website_url ? (
              <p className="flex items-center gap-2">
                <Globe className="h-4 w-4" />
                <a href={profile.website_url} target="_blank" rel="noreferrer" className="underline">
                  Site web
                </a>
              </p>
            ) : null}
            {profile.instagram_url ? (
              <p className="flex items-center gap-2">
                <Instagram className="h-4 w-4" />
                <a href={profile.instagram_url} target="_blank" rel="noreferrer" className="underline">
                  Instagram
                </a>
              </p>
            ) : null}
          </div>

          <div className="space-y-3">
            <p className="text-sm font-medium text-[var(--foreground)]">
              Prestations ou approches référencées
            </p>
            <div className="flex flex-wrap gap-2">
              {profile.service_tags_json.length ? (
                profile.service_tags_json.map((tag) => <Badge key={tag}>{tag}</Badge>)
              ) : (
                <Badge tone="info">Informations à compléter</Badge>
              )}
            </div>
            <p className="pt-4 text-xs leading-6 text-[var(--foreground-subtle)]">
              Cette fiche est publiée de manière contrôlée à partir d’une source autorisée.
              Elle peut être corrigée, revendiquée ou retirée sur demande.
            </p>
          </div>
        </div>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link href={`/revendiquer?profile=${profile.id}`}>
            <Badge className="px-4 py-2 text-sm">Revendiquer cette fiche</Badge>
          </Link>
          <Link href={`/demander-suppression/${profile.slug}`}>
            <Badge tone="warning" className="px-4 py-2 text-sm">
              Demander une suppression
            </Badge>
          </Link>
        </div>
      </Card>
    </main>
  );
}
