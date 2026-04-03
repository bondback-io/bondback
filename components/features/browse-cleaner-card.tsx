"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { memo } from "react";
import { Star, Shield, FileCheck, Briefcase, Camera, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { OptimizedImage } from "@/components/ui/optimized-image";
import { VerificationBadges } from "@/components/shared/verification-badges";
import { cn } from "@/lib/utils";
import { CLEANER_TIER_META } from "@/lib/cleaner-browse-tier";
import type { BrowseCleanerRow } from "@/lib/data/browse-cleaners";
import { NEXT_IMAGE_SIZES_AVATAR_80 } from "@/lib/next-image-sizes";

function formatKm(km: number): string {
  if (km < 10) return km.toFixed(1);
  return String(Math.round(km));
}

function BrowseCleanerCardInner({ cleaner }: { cleaner: BrowseCleanerRow }) {
  const router = useRouter();
  const tierMeta = CLEANER_TIER_META[cleaner.tier];
  const name =
    cleaner.fullName?.trim() ||
    cleaner.businessName?.trim() ||
    "Cleaner";
  const rating =
    cleaner.avgRating != null && Number.isFinite(cleaner.avgRating)
      ? Math.round(cleaner.avgRating * 10) / 10
      : null;
  const bioSnippet =
    cleaner.bio && cleaner.bio.trim().length > 0
      ? cleaner.bio.trim().slice(0, 140) + (cleaner.bio.length > 140 ? "…" : "")
      : null;

  return (
    <article
      className={cn(
        "flex flex-col overflow-hidden rounded-2xl border-2 bg-card shadow-sm transition-shadow hover:shadow-md dark:bg-gray-950",
        tierMeta.ringClass,
        "ring-2"
      )}
    >
      <div className="flex flex-1 flex-col gap-3 p-4 sm:p-5">
        <div className="flex gap-3">
          <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-2xl border border-border bg-muted dark:border-gray-700">
            <OptimizedImage
              src={cleaner.profilePhotoUrl ?? "/placeholder-listing.png"}
              alt=""
              width={64}
              height={64}
              sizes={NEXT_IMAGE_SIZES_AVATAR_80}
              className="h-full w-full object-cover"
            />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={cn(
                  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-bold tracking-wide",
                  tierMeta.className
                )}
              >
                {tierMeta.short}
              </span>
              {cleaner.distanceKm != null && (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground dark:text-gray-400">
                  <MapPin className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  {formatKm(cleaner.distanceKm)} km
                </span>
              )}
            </div>
            <h2 className="mt-1.5 text-lg font-bold leading-snug tracking-tight text-foreground dark:text-gray-50 sm:text-xl">
              {name}
            </h2>
            {cleaner.businessName && cleaner.fullName && (
              <p className="text-sm font-medium text-muted-foreground dark:text-gray-400">
                {cleaner.businessName}
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-end justify-between gap-3 rounded-xl bg-amber-50/90 px-3 py-3 dark:bg-amber-950/35">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-900/80 dark:text-amber-200/90">
              Rating &amp; reviews
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              {rating != null ? (
                <>
                  <span className="text-3xl font-bold tabular-nums text-amber-950 dark:text-amber-100">
                    {rating.toFixed(1)}
                  </span>
                  <div className="flex items-center gap-0.5 text-amber-500" aria-hidden>
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star
                        key={s}
                        className={cn(
                          "h-5 w-5 sm:h-6 sm:w-6",
                          cleaner.avgRating != null && s <= Math.round(cleaner.avgRating)
                            ? "fill-amber-400 text-amber-400"
                            : "text-muted-foreground/40"
                        )}
                      />
                    ))}
                  </div>
                </>
              ) : (
                <span className="text-base font-medium text-muted-foreground dark:text-gray-400">
                  Not rated yet
                </span>
              )}
            </div>
          </div>
          <div className="text-right">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-900/80 dark:text-amber-200/90">
              Jobs completed
            </p>
            <p className="text-2xl font-bold tabular-nums text-amber-950 dark:text-amber-50">
              {cleaner.completedJobs}
            </p>
          </div>
        </div>

        <div>
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground dark:text-gray-400">
            Trust &amp; verification
          </p>
          <VerificationBadges badges={cleaner.verificationBadges} showLabel size="lg" />
        </div>

        <ul className="grid gap-2 text-sm sm:text-base">
          <li className="flex min-h-[44px] items-center gap-2 rounded-lg border border-border/80 bg-muted/40 px-3 py-2 dark:border-gray-800 dark:bg-gray-900/50">
            <FileCheck className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
            <span className="font-medium text-foreground dark:text-gray-100">
              {cleaner.hasAbn ? "ABN on file" : "No ABN on file"}
            </span>
          </li>
          <li className="flex min-h-[44px] items-center gap-2 rounded-lg border border-border/80 bg-muted/40 px-3 py-2 dark:border-gray-800 dark:bg-gray-900/50">
            <Shield className="h-5 w-5 shrink-0 text-sky-600 dark:text-sky-400" aria-hidden />
            <span className="font-medium text-foreground dark:text-gray-100">
              {cleaner.hasInsurance
                ? "Insurance policy on file"
                : "No insurance policy listed"}
            </span>
          </li>
          {cleaner.yearsExperience != null && cleaner.yearsExperience > 0 && (
            <li className="flex min-h-[44px] items-center gap-2 rounded-lg border border-border/80 bg-muted/40 px-3 py-2 dark:border-gray-800 dark:bg-gray-900/50">
              <Briefcase className="h-5 w-5 shrink-0 text-violet-600 dark:text-violet-400" aria-hidden />
              <span className="font-medium text-foreground dark:text-gray-100">
                {cleaner.yearsExperience}+ years experience
              </span>
            </li>
          )}
        </ul>

        {(cleaner.suburb || cleaner.postcode) && (
          <p className="text-sm text-muted-foreground dark:text-gray-400">
            <span className="font-medium text-foreground dark:text-gray-200">Area: </span>
            {[cleaner.suburb, cleaner.postcode].filter(Boolean).join(" ")}
            {cleaner.state ? ` · ${cleaner.state}` : ""}
          </p>
        )}

        {bioSnippet && (
          <p className="text-sm leading-relaxed text-muted-foreground dark:text-gray-400">{bioSnippet}</p>
        )}

        {cleaner.portfolioPhotoUrls.length > 0 && (
          <div>
            <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground dark:text-gray-400">
              <Camera className="h-3.5 w-3.5" aria-hidden />
              Work snapshots
            </p>
            <div className="grid grid-cols-3 gap-2">
              {cleaner.portfolioPhotoUrls.slice(0, 3).map((url, i) => (
                <div
                  key={`${url}-${i}`}
                  className="relative aspect-[4/3] overflow-hidden rounded-lg border border-border bg-muted dark:border-gray-800"
                >
                  <OptimizedImage
                    src={url}
                    alt=""
                    fill
                    sizes="(max-width: 640px) 33vw, 120px"
                    className="object-cover"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        <Button
          asChild
          size="lg"
          className="mt-auto min-h-[48px] w-full rounded-xl text-base font-semibold"
        >
          <Link
            href={`/cleaners/${cleaner.id}`}
            prefetch
            onMouseEnter={() => router.prefetch(`/cleaners/${cleaner.id}`)}
          >
            View full profile
          </Link>
        </Button>
      </div>
    </article>
  );
}

export const BrowseCleanerCard = memo(BrowseCleanerCardInner);
