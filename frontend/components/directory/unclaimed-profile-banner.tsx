"use client";

import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";

type UnclaimedProfileBannerProps = {
  slug: string;
  profileId: string;
};

export function UnclaimedProfileBanner({
  slug,
  profileId,
}: UnclaimedProfileBannerProps) {
  return (
    <Notice tone="info">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="font-medium text-[var(--foreground)]">
            Vous êtes ce praticien ? Revendiquez cette fiche pour la compléter et la gérer.
          </p>
          <p className="mt-1 text-sm text-[var(--foreground-muted)]">
            Certaines informations peuvent être incomplètes ou non mises à jour.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Link href={`/revendiquer?profile=${profileId}`}>
            <Button size="md">Revendiquer cette fiche</Button>
          </Link>
          <Link href={`/demander-suppression/${slug}`}>
            <Button size="md" variant="secondary">
              Demander une correction ou suppression
            </Button>
          </Link>
        </div>
      </div>
    </Notice>
  );
}
