/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import {
  Copy,
  ExternalLink,
  MapPin,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  buildPublicProfileUrl,
  getActivityTypeLabel,
  getPracticeModeLabel,
  getPublicProfileTheme,
  type PublicProfileDraft,
} from "@/lib/public-profile";
import { buildPublicPaymentPreview } from "@/lib/payments";
import { cn, getInitials } from "@/lib/utils";

type PublicProfilePreviewCardProps = {
  slug: string;
  draft: PublicProfileDraft;
  onCopyLink?: () => void;
};

export function PublicProfilePreviewCard({
  slug,
  draft,
  onCopyLink,
}: PublicProfilePreviewCardProps) {
  const theme = getPublicProfileTheme(draft.themeKey);
  const publicUrl = buildPublicProfileUrl(slug);
  const paymentPreview = buildPublicPaymentPreview(
    {
      reservation_payment_mode: draft.reservationPaymentMode,
      deposit_value_type: draft.depositValueType,
      deposit_value: draft.depositValue,
      free_cancellation_notice_hours: draft.freeCancellationNoticeHours,
      keep_payment_after_deadline: draft.keepPaymentAfterDeadline,
      payment_message: draft.paymentMessage,
    },
    null
  );

  return (
    <Card className="overflow-hidden rounded-[1.9rem] p-0">
      <div className={cn("relative h-40 px-6 py-5", theme.heroGradient)}>
        {draft.coverImageUrl ? (
          <img
            src={draft.coverImageUrl}
            alt={`Couverture de ${draft.displayName}`}
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : null}
        <div className="absolute inset-0 bg-[linear-gradient(180deg,var(--hero-scrim),var(--hero-scrim-strong))]" />
        <div className="flex h-full items-end justify-between gap-4">
          <div className="flex items-end gap-4">
            <div className="relative flex h-20 w-20 items-center justify-center overflow-hidden rounded-[1.8rem] border border-[var(--hero-card-border)] bg-[var(--hero-card-surface)] text-2xl font-semibold text-[var(--inverse-foreground)] shadow-[var(--shadow-md)]">
              {draft.profileImageUrl ? (
                <img
                  src={draft.profileImageUrl}
                  alt={draft.displayName}
                  className="h-full w-full object-cover"
                />
              ) : (
                getInitials(draft.displayName)
              )}
            </div>
            <div className="relative pb-1 text-[var(--inverse-foreground)]">
              <p className="text-sm uppercase tracking-[0.24em] text-[var(--inverse-foreground-subtle)]">
                Profil public
              </p>
              <h3 className="mt-2 text-2xl font-semibold">{draft.displayName}</h3>
            </div>
          </div>
          <Badge className={cn("relative", theme.accentBadgeClassName)}>
            {theme.label}
          </Badge>
        </div>
      </div>

      <div className="p-6">
        <p className="text-base font-medium text-[var(--foreground)]">
          {draft.headline}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-[var(--foreground-muted)]">
          <MapPin className="h-4 w-4" />
          {draft.city}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Badge tone="neutral">{getActivityTypeLabel(draft.activityType)}</Badge>
          <Badge tone="neutral">{getPracticeModeLabel(draft.practiceMode)}</Badge>
        </div>
        <p className="mt-4 text-sm leading-7 text-[var(--foreground-muted)]">
          {draft.bio}
        </p>

        <div className="mt-5 flex flex-wrap gap-2">
          {draft.specialties.slice(0, 3).map((specialty) => (
            <Badge key={specialty} tone="info">
              <Sparkles className="mr-1 h-3.5 w-3.5" />
              {specialty}
            </Badge>
          ))}
        </div>

        <div className="mt-5 rounded-[1.35rem] border border-[var(--border)] bg-[var(--background-soft)] px-4 py-4">
          <div className="flex items-center gap-2 text-[var(--foreground)]">
            <ShieldCheck className="h-4.5 w-4.5 text-[var(--primary)]" />
            <p className="text-sm font-medium">Points forts visibles</p>
          </div>
          <div className="mt-3 grid gap-2">
            {draft.highlightPoints.slice(0, 3).map((point) => (
              <p
                key={point}
                className="rounded-[1rem] border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2 text-sm text-[var(--foreground-muted)]"
              >
                {point}
              </p>
            ))}
          </div>
        </div>

        <div className="mt-5 rounded-[1.35rem] border border-[var(--border)] bg-[var(--background-soft)] px-4 py-4">
          <p className="text-sm font-medium text-[var(--foreground)]">
            Règlement et annulation
          </p>
          <p className="mt-3 text-sm leading-6 text-[var(--foreground-muted)]">
            {paymentPreview.title}
          </p>
          <p className="mt-2 text-sm leading-6 text-[var(--foreground-muted)]">
            {paymentPreview.cancellationSummary}
          </p>
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Link href={`/${slug}`} target="_blank" className="sm:flex-1">
            <Button
              size="lg"
              className="w-full"
              iconRight={<ExternalLink className="h-4 w-4" />}
            >
              Voir mon profil en tant que client
            </Button>
          </Link>
          <Button
            variant="secondary"
            size="lg"
            className="sm:flex-1"
            onClick={onCopyLink}
            iconLeft={<Copy className="h-4 w-4" />}
          >
            Copier mon lien
          </Button>
        </div>

        <p className="mt-4 text-xs text-[var(--foreground-subtle)]">
          {publicUrl}
        </p>
      </div>
    </Card>
  );
}
