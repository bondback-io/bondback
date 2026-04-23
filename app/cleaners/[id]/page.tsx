import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { format } from "date-fns";
import {
  Star,
  ChevronRight,
  MapPin,
  FileCheck,
  Shield,
  Briefcase,
  Car,
  Wrench,
  Camera,
  Sparkles,
  ArrowLeft,
} from "lucide-react";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { OptimizedImage } from "@/components/ui/optimized-image";
import { ProfilePhotoAvatar } from "@/components/shared/profile-photo-avatar";
import { VerificationBadges } from "@/components/shared/verification-badges";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { cn } from "@/lib/utils";
import { CleanerReviewCountPreview } from "@/components/features/cleaner-review-count-preview";
import { CleanerExperienceBadge } from "@/components/shared/cleaner-experience-badge";
import { fetchCleanerReviewsForPublicProfile } from "@/lib/reviews/fetch-cleaner-reviews-for-profile";
import { formatReviewerDisplayName } from "@/lib/reviews/reviewer-display-name";
import { recomputeAllProfileReviewAggregates } from "@/lib/actions/reviews";
import { effectiveProfilePhotoUrl } from "@/lib/profile-display-photo";
import { computeCleanerBrowseTier } from "@/lib/cleaner-browse-tier";
import { CleanerTierBadge } from "@/components/features/cleaner-tier-badge";

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const admin = createSupabaseAdminClient();
  const client = (admin ?? supabase) as SupabaseClient<Database>;
  const { data: profile } = await client
    .from("profiles")
    .select("full_name")
    .eq("id", id)
    .maybeSingle();
  const name =
    (profile as { full_name?: string | null } | null)?.full_name?.trim() ||
    "Cleaner";
  const description = `View ${name}'s cleaner profile on Bond Back — bond cleaning and end of lease cleaning in Australia.`;
  return {
    title: `${name}`,
    description,
    alternates: { canonical: `/cleaners/${id}` },
    openGraph: {
      title: `${name} · Bond Back cleaner`,
      description,
      url: `/cleaners/${id}`,
    },
  };
}

export default async function CleanerProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const admin = createSupabaseAdminClient();
  const client = (admin ?? supabase) as SupabaseClient<Database>;

  const { data: profile } = await client
    .from("profiles")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!profile) {
    notFound();
  }

  const profileRow = profile as ProfileRow & {
    cleaner_total_reviews?: number | string | null;
    verification_badges?: string[] | null;
  };

  /** Denormalised profile counter — can lag after admin deletes jobs/reviews. */
  const cleanerCountRaw =
    profileRow.cleaner_total_reviews != null
      ? Number(profileRow.cleaner_total_reviews)
      : 0;
  const cleanerCount = Number.isFinite(cleanerCountRaw)
    ? Math.max(0, Math.round(cleanerCountRaw))
    : 0;

  const { count: completedJobsCount } = await client
    .from("jobs")
    .select("id", { count: "exact", head: true })
    .eq("winner_id", id)
    .eq("status", "completed");

  const reviewsSafe = (await fetchCleanerReviewsForPublicProfile(
    client,
    admin,
    id
  )) as any[];

  if (cleanerCount > 0 && reviewsSafe.length === 0) {
    void recomputeAllProfileReviewAggregates(id);
  }

  const publicReviewCount = reviewsSafe.length;
  const publicAvg =
    publicReviewCount > 0
      ? reviewsSafe.reduce(
          (sum, r) => sum + Number((r as { overall_rating?: number }).overall_rating ?? 0),
          0
        ) / publicReviewCount
      : null;

  const reviewLinkCount = publicReviewCount;

  const reviewPopoverSnippets = reviewsSafe.slice(0, 10).map((r: any) => ({
    id: String(r.id),
    text: String(r.review_text ?? "").trim(),
    author: formatReviewerDisplayName(r.reviewer) ?? null,
    createdAt: r.created_at as string,
    rating: Number(r.overall_rating),
    jobId: r.job_id != null ? Number(r.job_id) : null,
  }));
  const reviewPopoverHint =
    reviewLinkCount > reviewPopoverSnippets.length && reviewPopoverSnippets.length > 0
      ? `Showing ${reviewPopoverSnippets.length} most recent of ${reviewLinkCount} reviews.`
      : null;

  const latestWrittenReview = reviewsSafe.find(
    (r: { review_text?: string | null }) => String(r.review_text ?? "").trim().length > 0
  ) as
    | {
        review_text?: string | null;
        reviewer?: { full_name?: string | null };
        created_at?: string;
        overall_rating?: number;
      }
    | undefined;

  const avg = publicAvg;

  const fullName = profileRow.full_name as string | null;
  const businessName = profileRow.business_name as string | null;
  const suburb = profileRow.suburb as string | null;
  const postcode = profileRow.postcode as string | null;
  const state = profileRow.state as string | null;
  const years = profileRow.years_experience as number | null;
  const bio = profileRow.bio as string | null;
  const vehicleType = profileRow.vehicle_type as string | null;
  const equipmentNotes = profileRow.equipment_notes as string | null;
  const specialties = Array.isArray(profileRow.specialties)
    ? (profileRow.specialties as string[])
    : [];
  const portfolioUrls = Array.isArray(profileRow.portfolio_photo_urls)
    ? (profileRow.portfolio_photo_urls as string[]).filter(
        (u): u is string => typeof u === "string" && u.length > 0
      )
    : [];
  const profilePhotoUrl = effectiveProfilePhotoUrl({
    profile_photo_url: profileRow.profile_photo_url,
    avatar_url: profileRow.avatar_url,
  });
  const verificationBadges = profileRow.verification_badges;
  const abnDigits = (profileRow.abn ?? "").replace(/\D/g, "");
  const hasAbn = abnDigits.length === 11;
  const hasInsurance =
    ((profileRow.insurance_policy_number ?? "") as string).trim().length > 0;

  const displayName =
    fullName?.trim() || businessName?.trim() || "Cleaner";
  const starValue = avg ? Math.round(avg * 10) / 10 : null;
  const negativeStars = Math.max(
    0,
    Math.round(Number((profileRow as { negative_stars?: number | null }).negative_stars ?? 0))
  );

  const browseTier = computeCleanerBrowseTier({
    completedJobs: completedJobsCount ?? 0,
    avgRating: avg,
    reviewCount: publicReviewCount,
    badges: verificationBadges,
    hasAbn,
    hasInsurance,
    portfolioPhotoCount: portfolioUrls.length,
  });

  const avgSubScore = (key: string): number | null => {
    const vals = reviewsSafe
      .map((r: Record<string, unknown>) => r[key])
      .filter((v): v is number => typeof v === "number" && !Number.isNaN(v));
    if (vals.length === 0) return null;
    return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10;
  };

  const reviewSubDimensions = [
    { label: "Quality of work", value: avgSubScore("quality_of_work") },
    { label: "Reliability", value: avgSubScore("reliability") },
    { label: "Communication", value: avgSubScore("communication") },
    { label: "Punctuality", value: avgSubScore("punctuality") },
    { label: "Cleanliness", value: avgSubScore("cleanliness") },
  ].filter((d) => d.value != null) as { label: string; value: number }[];

  const ratingPreviewReviews = reviewsSafe.slice(0, 2);
  const moreReviews = reviewsSafe.slice(2);

  const makePhotoUrl = (path: string) => {
    const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!base) return path;
    return `${base}/storage/v1/object/public/review-photos/${path}`;
  };

  const locationLine = [suburb, postcode].filter(Boolean).join(" ");
  const locationFull = [locationLine, state].filter(Boolean).join(" · ");

  return (
    <section className="page-inner space-y-4 pb-12 pt-1 md:space-y-8 md:pt-0">
      {/* Mobile: one line back — avoids a long crumb row beside the hero */}
      <div className="md:hidden">
        <Link
          href="/cleaners"
          className="inline-flex min-h-[44px] items-center gap-2 text-sm font-medium text-muted-foreground -ml-1 px-1 hover:text-foreground dark:text-gray-400 dark:hover:text-gray-100"
        >
          <ArrowLeft className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
          Browse cleaners
        </Link>
      </div>

      <nav
        aria-label="Breadcrumb"
        className="hidden flex-wrap items-center gap-1 text-[13px] leading-tight text-muted-foreground md:flex md:gap-1.5 dark:text-gray-400"
      >
        <Link
          href="/"
          className="rounded-md font-medium text-foreground/80 underline-offset-4 hover:text-emerald-600 hover:underline dark:text-gray-200 dark:hover:text-emerald-400"
        >
          Home
        </Link>
        <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-50" aria-hidden />
        <Link
          href="/cleaners"
          className="rounded-md font-medium text-foreground/80 underline-offset-4 hover:text-emerald-600 hover:underline dark:text-gray-200 dark:hover:text-emerald-400"
        >
          Browse cleaners
        </Link>
        <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-50" aria-hidden />
        <span
          className="max-w-[min(100%,20rem)] truncate font-medium text-foreground dark:text-gray-100"
          aria-current="page"
        >
          {displayName}
        </span>
      </nav>

      <div className="overflow-hidden rounded-2xl border border-border/80 bg-gradient-to-br from-emerald-950/40 via-background to-sky-950/25 shadow-lg ring-1 ring-emerald-500/10 dark:from-emerald-950/50 dark:via-gray-950 dark:to-sky-950/20 dark:border-gray-800">
        <div className="flex flex-col gap-6 p-6 sm:p-8 md:flex-row md:items-start md:gap-10">
          <div className="mx-auto flex shrink-0 flex-col items-center md:mx-0">
            <div
              className={cn(
                "relative h-36 w-36 overflow-hidden rounded-2xl border-2 border-emerald-500/30 bg-muted shadow-md sm:h-44 sm:w-44",
                "ring-4 ring-emerald-500/10 dark:border-emerald-600/40 dark:bg-gray-900"
              )}
            >
              <ProfilePhotoAvatar
                photoUrl={profilePhotoUrl}
                displayName={displayName}
                width={176}
                height={176}
                sizes="(max-width: 768px) 144px, 176px"
                priority
                className="h-full w-full"
                initialsClassName="text-3xl font-bold sm:text-4xl text-muted-foreground/90 dark:text-gray-400"
              />
            </div>
            <div className="mt-3 flex justify-center">
              <CleanerExperienceBadge jobs={completedJobsCount ?? 0} />
            </div>
          </div>

          <div className="min-w-0 flex-1 space-y-4 text-center md:text-left">
            <div className="space-y-2">
              <h1 className="text-2xl font-bold tracking-tight text-foreground dark:text-gray-50 sm:text-3xl">
                {displayName}
              </h1>
              {businessName && fullName?.trim() && (
                <p className="text-base font-medium text-muted-foreground dark:text-gray-400">
                  {businessName}
                </p>
              )}
              <div className="flex justify-center md:justify-start">
                <CleanerTierBadge tier={browseTier} />
              </div>
            </div>

            {locationFull && (
              <p className="inline-flex items-center justify-center gap-1.5 text-sm text-muted-foreground md:justify-start dark:text-gray-400">
                <MapPin className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                {locationFull}
              </p>
            )}

            <div className="flex flex-wrap items-center justify-center gap-2 md:justify-start">
              <VerificationBadges
                badges={verificationBadges}
                showLabel
                size="lg"
              />
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3 md:justify-start">
              {publicReviewCount > 0 && starValue != null ? (
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-semibold tabular-nums text-foreground dark:text-gray-100">
                    {starValue.toFixed(1)}
                  </span>
                  <div className="flex items-center gap-0.5 text-amber-400">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star
                        key={s}
                        className={`h-4 w-4 ${
                          avg != null && s <= Math.round(avg)
                            ? "fill-amber-400"
                            : "text-muted-foreground/40"
                        }`}
                      />
                    ))}
                  </div>
                </div>
              ) : (
                <span className="text-sm font-medium text-muted-foreground dark:text-gray-400">
                  Not rated yet
                </span>
              )}
              <span className="text-xs text-muted-foreground dark:text-gray-400">
                <CleanerReviewCountPreview
                  count={reviewLinkCount}
                  snippets={reviewPopoverSnippets}
                  moreCountHint={reviewPopoverHint}
                />
              </span>
              {negativeStars > 0 ? (
                <span
                  className="text-xs font-medium text-rose-800 dark:text-rose-200"
                  title="Strikes from lister cancellations when the cleaner was non-responsive with escrow held."
                >
                  {negativeStars} negative strike{negativeStars === 1 ? "" : "s"}
                </span>
              ) : null}
            </div>

            {latestWrittenReview && String(latestWrittenReview.review_text ?? "").trim() ? (
              <figure className="rounded-xl border border-amber-500/25 bg-amber-500/[0.08] px-4 py-3 text-left dark:border-amber-900/40 dark:bg-amber-950/30">
                <figcaption className="text-[11px] font-bold uppercase tracking-wide text-amber-900/90 dark:text-amber-200/90">
                  Latest written review
                </figcaption>
                <blockquote className="mt-2 text-sm leading-relaxed text-foreground dark:text-gray-100">
                  <span className="text-muted-foreground">&ldquo;</span>
                  {String(latestWrittenReview.review_text).trim()}
                  <span className="text-muted-foreground">&rdquo;</span>
                </blockquote>
                <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground dark:text-gray-400">
                  <span>
                    — {formatReviewerDisplayName(latestWrittenReview.reviewer) ?? "Lister"}
                    {latestWrittenReview.created_at
                      ? (() => {
                          try {
                            return ` · ${format(new Date(latestWrittenReview.created_at), "d MMM yyyy")}`;
                          } catch {
                            return "";
                          }
                        })()
                      : ""}
                  </span>
                  <Link
                    href="#cleaner-rating-reputation"
                    className="font-semibold text-emerald-700 underline-offset-4 hover:underline dark:text-emerald-400"
                  >
                    All reviews
                  </Link>
                </p>
              </figure>
            ) : null}

            <ul className="grid gap-2 sm:grid-cols-2">
              <li className="flex min-h-[44px] items-center gap-2 rounded-xl border border-border/80 bg-background/60 px-3 py-2.5 text-left dark:border-gray-800 dark:bg-gray-900/60">
                <FileCheck
                  className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400"
                  aria-hidden
                />
                <span className="text-sm font-medium text-foreground dark:text-gray-100">
                  {hasAbn ? "ABN on file & verified" : "No ABN on file"}
                </span>
              </li>
              <li className="flex min-h-[44px] items-center gap-2 rounded-xl border border-border/80 bg-background/60 px-3 py-2.5 text-left dark:border-gray-800 dark:bg-gray-900/60">
                <Shield
                  className="h-5 w-5 shrink-0 text-sky-600 dark:text-sky-400"
                  aria-hidden
                />
                <span className="text-sm font-medium text-foreground dark:text-gray-100">
                  {hasInsurance
                    ? "Insurance policy on file"
                    : "No insurance listed"}
                </span>
              </li>
              {years != null && years > 0 && (
                <li className="flex min-h-[44px] items-center gap-2 rounded-xl border border-border/80 bg-background/60 px-3 py-2.5 text-left dark:border-gray-800 dark:bg-gray-900/60">
                  <Briefcase
                    className="h-5 w-5 shrink-0 text-violet-600 dark:text-violet-400"
                    aria-hidden
                  />
                  <span className="text-sm font-medium text-foreground dark:text-gray-100">
                    {years}+ years experience
                  </span>
                </li>
              )}
              {vehicleType && (
                <li className="flex min-h-[44px] items-center gap-2 rounded-xl border border-border/80 bg-background/60 px-3 py-2.5 text-left dark:border-gray-800 dark:bg-gray-900/60">
                  <Car
                    className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400"
                    aria-hidden
                  />
                  <span className="text-sm font-medium text-foreground dark:text-gray-100">
                    Vehicle: {vehicleType}
                  </span>
                </li>
              )}
            </ul>

            <div className="pt-1">
              <Link
                href="/cleaners"
                className="inline-flex items-center gap-1 text-sm font-semibold text-emerald-700 underline-offset-4 hover:underline dark:text-emerald-400"
              >
                ← Back to all cleaners
              </Link>
            </div>
          </div>
        </div>
      </div>

      {bio && bio.trim().length > 0 && (
        <Card className="border-border/80 dark:border-gray-800 dark:bg-gray-950/50">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Sparkles className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              About
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground dark:text-gray-300">
              {bio.trim()}
            </p>
          </CardContent>
        </Card>
      )}

      {(specialties.length > 0 || equipmentNotes?.trim()) && (
        <Card className="border-border/80 dark:border-gray-800 dark:bg-gray-950/50">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Wrench className="h-5 w-5 text-sky-600 dark:text-sky-400" />
              Professional profile
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {specialties.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground dark:text-gray-500">
                  Specialties
                </p>
                <div className="flex flex-wrap gap-2">
                  {specialties.map((s) => (
                    <Badge
                      key={s}
                      variant="secondary"
                      className="rounded-full px-3 py-1 text-xs font-medium"
                    >
                      {s}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            {equipmentNotes && equipmentNotes.trim().length > 0 && (
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground dark:text-gray-500">
                  Equipment &amp; approach
                </p>
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground dark:text-gray-300">
                  {equipmentNotes.trim()}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {portfolioUrls.length > 0 && (
        <Card className="border-border/80 dark:border-gray-800 dark:bg-gray-950/50">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Camera className="h-5 w-5 text-violet-600 dark:text-violet-400" />
              Portfolio &amp; past work
            </CardTitle>
            <p className="text-sm font-normal text-muted-foreground dark:text-gray-400">
              Photos from this cleaner&apos;s profile — bond cleans and end-of-lease work.
            </p>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {portfolioUrls.map((url, i) => (
                <div
                  key={`${url}-${i}`}
                  className="relative aspect-[4/3] overflow-hidden rounded-xl border border-border bg-muted dark:border-gray-800"
                >
                  <OptimizedImage
                    src={url}
                    alt=""
                    fill
                    sizes="(max-width: 640px) 50vw, 200px"
                    className="object-cover"
                  />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card
        id="cleaner-rating-reputation"
        className="scroll-mt-24 border-border/80 dark:border-gray-800 dark:bg-gray-950/50"
      >
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Rating &amp; reputation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              {starValue != null ? (
                <>
                  <span className="text-3xl font-semibold tabular-nums">
                    {starValue.toFixed(1)}
                  </span>
                  <div className="flex items-center gap-0.5 text-amber-400">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star
                        key={s}
                        className={`h-5 w-5 ${
                          avg && s <= Math.round(avg)
                            ? "fill-amber-400"
                            : "text-muted-foreground"
                        }`}
                      />
                    ))}
                  </div>
                </>
              ) : (
                <span className="text-sm text-muted-foreground">
                  Not rated yet
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              <CleanerReviewCountPreview
                count={reviewLinkCount}
                snippets={reviewPopoverSnippets}
                moreCountHint={reviewPopoverHint}
              />
              {completedJobsCount != null && completedJobsCount > 0 && (
                <>
                  {" "}
                  · {completedJobsCount} completed job
                  {completedJobsCount === 1 ? "" : "s"}
                </>
              )}
            </p>
          </div>

          {reviewSubDimensions.length > 0 && (
            <div className="space-y-2 border-t border-border/80 pt-4 dark:border-gray-800">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground dark:text-gray-500">
                Average scores (from lister reviews)
              </p>
              <dl className="grid gap-2 sm:grid-cols-2">
                {reviewSubDimensions.map(({ label, value }) => (
                  <div
                    key={label}
                    className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-muted/30 px-3 py-2 dark:border-gray-800 dark:bg-gray-900/40"
                  >
                    <dt className="text-xs text-muted-foreground dark:text-gray-400">{label}</dt>
                    <dd className="flex items-center gap-1 shrink-0">
                      <span className="text-sm font-semibold tabular-nums text-foreground dark:text-gray-100">
                        {value.toFixed(1)}
                      </span>
                      <Star
                        className="h-3.5 w-3.5 fill-amber-400 text-amber-400 dark:fill-amber-500 dark:text-amber-500"
                        aria-hidden
                      />
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          )}

          {ratingPreviewReviews.length > 0 && (
            <div className="space-y-3 border-t border-border/80 pt-4 dark:border-gray-800">
              <div className="flex flex-wrap items-end justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground dark:text-gray-500">
                  Latest feedback
                </p>
                {reviewsSafe.length > 2 ? (
                  <a
                    href="#cleaner-more-reviews"
                    className="text-xs font-semibold text-emerald-700 underline-offset-4 hover:underline dark:text-emerald-400"
                  >
                    All reviews ({reviewsSafe.length})
                  </a>
                ) : null}
              </div>
              <ul className="space-y-3">
                {ratingPreviewReviews.map((r: any) => (
                  <li
                    key={r.id}
                    className="space-y-2 rounded-xl border border-border/80 bg-background/80 px-3 py-3 dark:border-gray-800 dark:bg-gray-900/50"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground dark:text-gray-100">
                          {formatReviewerDisplayName(r.reviewer) ?? "Lister"}
                        </p>
                        <div className="mt-0.5 flex items-center gap-1 text-amber-400">
                          {[1, 2, 3, 4, 5].map((s) => (
                            <Star
                              key={s}
                              className={`h-3.5 w-3.5 ${
                                s <= (r.overall_rating as number)
                                  ? "fill-amber-400"
                                  : "text-muted-foreground/40"
                              }`}
                            />
                          ))}
                        </div>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-0.5 text-right">
                        <time
                          className="text-[10px] text-muted-foreground tabular-nums dark:text-gray-500"
                          dateTime={r.created_at}
                        >
                          {(() => {
                            try {
                              return format(new Date(r.created_at), "d MMM yyyy");
                            } catch {
                              return "";
                            }
                          })()}
                        </time>
                        <span className="text-[10px] text-muted-foreground dark:text-gray-500">
                          Job #{r.job_id}
                        </span>
                      </div>
                    </div>
                    {r.review_text?.trim() ? (
                      <p className="text-sm leading-relaxed text-muted-foreground dark:text-gray-300">
                        {String(r.review_text).trim()}
                      </p>
                    ) : (
                      <p className="text-xs italic text-muted-foreground dark:text-gray-500">
                        No written comment for this review.
                      </p>
                    )}
                    {Array.isArray(r.review_photos) && r.review_photos.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {r.review_photos.slice(0, 4).map((path: string, idx: number) => (
                          <div
                            key={`${path}-${idx}`}
                            className="relative h-16 w-20 overflow-hidden rounded-md border border-border bg-muted/40 dark:border-gray-700"
                          >
                            <OptimizedImage
                              src={makePhotoUrl(path)}
                              alt=""
                              width={80}
                              height={64}
                              sizes="80px"
                              quality={70}
                              className="h-full w-full object-cover"
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>

      {moreReviews.length > 0 && (
        <Card
          id="cleaner-more-reviews"
          className="scroll-mt-24 border-border/80 dark:border-gray-800 dark:bg-gray-950/50"
        >
          <CardHeader>
            <CardTitle className="text-lg">More reviews</CardTitle>
            <p className="text-sm font-normal text-muted-foreground dark:text-gray-400">
              Older feedback from property listers.
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            {moreReviews.map((r) => (
              <div
                key={r.id}
                className="space-y-1 rounded-md border border-border/80 bg-background/70 px-3 py-2 text-xs dark:border-gray-800 dark:bg-gray-900/40"
              >
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="font-semibold">
                      {formatReviewerDisplayName(r.reviewer) ?? "Lister"}
                    </p>
                    <div className="flex items-center gap-1 text-amber-400">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Star
                          key={s}
                          className={`h-3 w-3 ${
                            s <= (r.overall_rating as number)
                              ? "fill-amber-400"
                              : "text-muted-foreground"
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    Job #{r.job_id}
                  </p>
                </div>
                {String(r.review_text ?? "").trim() ? (
                  <p className="text-[11px] leading-relaxed text-foreground dark:text-gray-200">
                    {String(r.review_text).trim()}
                  </p>
                ) : (
                  <p className="text-[11px] italic text-muted-foreground dark:text-gray-500">
                    No written comment for this review.
                  </p>
                )}
                {Array.isArray(r.review_photos) &&
                  r.review_photos.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {r.review_photos.slice(0, 3).map((path: string, idx: number) => (
                        <div
                          key={`${path}-${idx}`}
                          className="h-14 w-16 overflow-hidden rounded-md border bg-muted/40"
                        >
                          <OptimizedImage
                            src={makePhotoUrl(path)}
                            alt="Review"
                            width={64}
                            height={56}
                            sizes="64px"
                            quality={70}
                            className="h-full w-full object-cover"
                          />
                        </div>
                      ))}
                    </div>
                  )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </section>
  );
}
