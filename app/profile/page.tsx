import Link from "next/link";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { ProfileForm } from "@/components/features/profile-form";
import { ProfileRoleActions } from "@/components/features/profile-role-actions";
import { ConnectBankAccount } from "@/components/features/connect-bank-account";
import { PayoutScheduleForm } from "@/components/settings/payout-schedule-form";
import { getProfileCompletion } from "@/lib/profile-completion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ProfileCompletionMobileRing } from "@/components/features/profile-completion-mobile";
import { Camera, MapPin, Star, BadgeCheck, Phone } from "lucide-react";
import type { Database } from "@/types/supabase";
import { VerificationBadges } from "@/components/shared/verification-badges";
import { recomputeVerificationBadgesForUser, syncCurrentUserEmailVerification } from "@/lib/actions/verification";
import { getGlobalSettings } from "@/lib/actions/global-settings";
import { ensureReferralCodeForUser } from "@/lib/actions/referral-code";
import { ProfileReferralSection } from "@/components/features/profile-referral-section";

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

const ProfilePage = async () => {
  const supabase = await createServerSupabaseClient();
  await syncCurrentUserEmailVerification();

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    redirect("/login");
  }

  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", session.user.id)
    .maybeSingle();

  const profile = data as ProfileRow | null;
  const roles = (profile?.roles as string[] | null) ?? [];
  const activeRole = (profile?.active_role as "lister" | "cleaner" | null) ?? null;

  if (!profile || roles.length === 0) {
    redirect("/onboarding");
  }
  await recomputeVerificationBadgesForUser(session.user.id);
  const { data: badgeRow } = await supabase
    .from("profiles")
    .select("verification_badges")
    .eq("id", session.user.id)
    .maybeSingle();

  const { percent, message } = getProfileCompletion(profile);
  const isCleaner = roles.includes("cleaner");

  const abnDigits = (profile.abn ?? "").replace(/\D/g, "");
  const needsAbn = isCleaner && abnDigits.length !== 11;
  const portfolioCount = Array.isArray(profile.portfolio_photo_urls)
    ? profile.portfolio_photo_urls.length
    : 0;
  const needsPortfolioPhotos = isCleaner && portfolioCount === 0;
  const showCompleteProfileCard = percent < 100;

  const globalSettings = await getGlobalSettings();
  const referralEnabled = globalSettings?.referral_enabled === true;
  const appOrigin = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  let referralCode: string | null = null;
  if (referralEnabled) {
    referralCode = await ensureReferralCodeForUser(session.user.id);
  }
  const accountCreditCents =
    (profile as { account_credit_cents?: number | null }).account_credit_cents ?? 0;
  const referralTermsText = (globalSettings as { referral_terms_text?: string | null })?.referral_terms_text ?? null;
  const referrerRewardDollars = Number(globalSettings?.referral_referrer_amount ?? 20);
  const referredRewardDollars = Number(globalSettings?.referral_referred_amount ?? 10);

  const { data: cleanerReviewsData } = isCleaner
    ? await supabase
        .from("reviews")
        .select(
          "id, job_id, overall_rating, quality_of_work, reliability, communication, punctuality, review_text, review_photos, created_at, reviewer_id"
        )
        .eq("reviewee_id", session.user.id)
        .eq("reviewee_type", "cleaner")
        .order("created_at", { ascending: false })
        .limit(20)
    : { data: [] as any[] };

  const cleanerReviews = (cleanerReviewsData ?? []) as Array<{
    id: number;
    job_id: number;
    overall_rating: number;
    quality_of_work?: number | null;
    reliability?: number | null;
    communication?: number | null;
    punctuality?: number | null;
    review_text?: string | null;
    review_photos?: string[] | null;
    created_at: string;
  }>;

  const cleanerAvgFromProfile = (profile as any).cleaner_avg_rating as number | null;
  const cleanerReviewCount =
    ((profile as any).review_count as number | null) ??
    ((profile as any).cleaner_total_reviews as number | null) ??
    cleanerReviews.length;
  const cleanerAvg =
    cleanerAvgFromProfile != null
      ? Number(cleanerAvgFromProfile)
      : cleanerReviews.length
        ? cleanerReviews.reduce((acc, r) => acc + Number(r.overall_rating ?? 0), 0) /
          cleanerReviews.length
        : null;

  const averageCategory = (
    key: "quality_of_work" | "reliability" | "communication" | "punctuality"
  ) => {
    const values = cleanerReviews
      .map((r) => r[key])
      .filter((v): v is number => typeof v === "number" && v >= 1 && v <= 5);
    if (!values.length) return null;
    return values.reduce((sum, v) => sum + v, 0) / values.length;
  };
  const qualityAvg = averageCategory("quality_of_work");
  const reliabilityAvg = averageCategory("reliability");
  const communicationAvg = averageCategory("communication");
  const punctualityAvg = averageCategory("punctuality");

  const makePhotoUrl = (path: string) => {
    const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!base) return path;
    return `${base}/storage/v1/object/public/review-photos/${path}`;
  };

  return (
    <section className="page-inner space-y-8 md:space-y-6">
      <div className="flex flex-col gap-5 md:gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-bold tracking-tight md:text-3xl md:font-semibold dark:text-gray-100">
            My Profile
          </h1>
          <VerificationBadges
            badges={(badgeRow as { verification_badges?: string[] | null } | null)?.verification_badges ?? (profile as { verification_badges?: string[] | null }).verification_badges ?? []}
            showLabel
            size="lg"
          />
        </div>
        <ProfileRoleActions
          roles={roles as ("lister" | "cleaner")[]}
          activeRole={activeRole}
        />
        <div className="md:hidden">
          <ProfileCompletionMobileRing percent={percent} message={message} />
        </div>

        {showCompleteProfileCard && (
          <Card className="max-w-2xl border-2 border-primary/25 bg-primary/5 shadow-sm dark:border-primary/30 dark:bg-primary/10">
            <CardHeader className="space-y-2 pb-2">
              <CardTitle className="text-2xl font-bold tracking-tight md:text-xl">
                Complete your profile
              </CardTitle>
              <CardDescription className="text-base md:text-sm">
                One-tap shortcuts — finish these to rank higher and win more work.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 pb-6">
              <Progress
                value={percent}
                className="h-3"
                indicatorClassName={
                  percent < 40
                    ? "bg-amber-500"
                    : percent < 80
                      ? "bg-sky-500"
                      : "bg-emerald-500"
                }
              />
              <p className="text-sm font-medium text-foreground dark:text-gray-100">
                {percent}% complete
                {message ? (
                  <span className="font-normal text-muted-foreground dark:text-gray-400">
                    {" "}
                    — {message}
                  </span>
                ) : null}
              </p>
              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                {isCleaner && needsAbn && (
                  <Button
                    asChild
                    size="lg"
                    className="h-14 min-h-[56px] w-full justify-center text-base font-semibold sm:flex-1"
                  >
                    <Link href="#abn">
                      <BadgeCheck className="mr-2 h-5 w-5 shrink-0" aria-hidden />
                      Add ABN
                    </Link>
                  </Button>
                )}
                {isCleaner && (needsPortfolioPhotos || !profile.profile_photo_url?.trim()) && (
                  <Button
                    asChild
                    size="lg"
                    variant="secondary"
                    className="h-14 min-h-[56px] w-full justify-center text-base font-semibold sm:flex-1"
                  >
                    <Link href="#portfolio-photos">
                      <Camera className="mr-2 h-5 w-5 shrink-0" aria-hidden />
                      Add photos
                    </Link>
                  </Button>
                )}
                {isCleaner && (
                  <Button
                    asChild
                    size="lg"
                    variant="outline"
                    className="h-14 min-h-[56px] w-full justify-center border-2 text-base font-semibold sm:flex-1"
                  >
                    <Link href="#max_travel_km">
                      <MapPin className="mr-2 h-5 w-5 shrink-0" aria-hidden />
                      Set max travel km
                    </Link>
                  </Button>
                )}
                {!isCleaner && !profile.phone?.trim() && (
                  <Button
                    asChild
                    size="lg"
                    className="h-14 min-h-[56px] w-full justify-center text-base font-semibold sm:flex-1"
                  >
                    <Link href="#phone">
                      <Phone className="mr-2 h-5 w-5 shrink-0" aria-hidden />
                      Add phone
                    </Link>
                  </Button>
                )}
                {!isCleaner && !profile.suburb?.trim() && (
                  <Button
                    asChild
                    size="lg"
                    variant="secondary"
                    className="h-14 min-h-[56px] w-full justify-center text-base font-semibold sm:flex-1"
                  >
                    <Link href="#suburb">Add suburb</Link>
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="hidden max-w-xl border-emerald-100 bg-emerald-50/40 dark:border-emerald-800 dark:bg-emerald-950/40 md:block">
          <CardContent className="space-y-2 pt-4">
            <Progress
              value={percent}
              indicatorClassName={
                percent < 40
                  ? "bg-amber-500"
                  : percent < 80
                    ? "bg-sky-500"
                    : "bg-emerald-500"
              }
            />
            <p className="text-xs text-muted-foreground dark:text-gray-400">
              {percent === 100 ? (
                <>Profile complete! You&apos;re ready to win more jobs.</>
              ) : (
                <>
                  <span className="font-medium text-foreground dark:text-gray-100">
                    {percent}% complete
                  </span>
                  {message && <> &mdash; {message}</>}
                </>
              )}
            </p>
          </CardContent>
        </Card>
      </div>
      {referralEnabled && referralCode && (
        <ProfileReferralSection
          referralCode={referralCode}
          accountCreditCents={accountCreditCents}
          appOrigin={appOrigin}
          referralTermsText={referralTermsText}
          referrerRewardDollars={referrerRewardDollars}
          referredRewardDollars={referredRewardDollars}
        />
      )}
      {roles.includes("cleaner") && (
        <>
          <ConnectBankAccount
            userId={session.user.id}
            stripeConnectId={profile.stripe_connect_id ?? null}
            stripeOnboardingComplete={!!(profile as { stripe_onboarding_complete?: boolean }).stripe_onboarding_complete}
            isCleaner={roles.includes("cleaner")}
          />
          <div className="mt-4">
            <PayoutScheduleForm
              initial={((profile as { preferred_payout_schedule?: string }).preferred_payout_schedule as "daily" | "weekly" | "monthly" | "platform_default") ?? "platform_default"}
            />
          </div>
          <Card className="border-border bg-card/80 dark:border-gray-800 dark:bg-gray-900/80">
            <CardContent className="space-y-4 pt-4">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-3xl font-semibold text-foreground dark:text-gray-100">
                    {cleanerAvg != null ? cleanerAvg.toFixed(1) : "—"}
                  </span>
                  <div className="flex items-center gap-0.5 text-amber-500 dark:text-yellow-400">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star
                        key={s}
                        className={`h-5 w-5 ${
                          cleanerAvg != null && s <= Math.round(cleanerAvg)
                            ? "fill-current"
                            : "text-muted-foreground/40 dark:text-gray-600"
                        }`}
                      />
                    ))}
                  </div>
                </div>
                <p className="text-xs text-muted-foreground dark:text-gray-400">
                  {cleanerReviewCount ?? 0} review{(cleanerReviewCount ?? 0) === 1 ? "" : "s"}
                </p>
              </div>

              <div className="space-y-2">
                {[
                  { label: "Quality of work", value: qualityAvg },
                  { label: "Reliability", value: reliabilityAvg },
                  { label: "Communication", value: communicationAvg },
                  { label: "Punctuality", value: punctualityAvg },
                ].map((item) => (
                  <div key={item.label} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground dark:text-gray-400">{item.label}</span>
                      <span className="font-medium text-foreground dark:text-gray-100">
                        {item.value != null ? item.value.toFixed(1) : "—"}
                      </span>
                    </div>
                    <Progress value={item.value != null ? (item.value / 5) * 100 : 0} className="h-1.5" />
                  </div>
                ))}
              </div>

              {cleanerReviews.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-foreground dark:text-gray-100">
                    Recent reviews
                  </p>
                  {cleanerReviews.slice(0, 5).map((r) => (
                    <div key={r.id} className="space-y-1 rounded-md border border-border bg-background/70 p-3 dark:border-gray-700 dark:bg-gray-900/40">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground dark:text-gray-400">Job #{r.job_id}</span>
                        <span className="flex items-center gap-1 text-amber-500 dark:text-yellow-400">
                          <Star className="h-3.5 w-3.5 fill-current" />
                          <span className="text-xs font-medium">{Number(r.overall_rating).toFixed(1)}</span>
                        </span>
                      </div>
                      {r.review_text && (
                        <p className="text-xs text-foreground dark:text-gray-100">{r.review_text}</p>
                      )}
                      {Array.isArray(r.review_photos) && r.review_photos.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {r.review_photos.slice(0, 3).map((path, idx) => (
                            <div key={`${r.id}-${idx}`} className="h-14 w-16 overflow-hidden rounded-md border border-border dark:border-gray-700">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={makePhotoUrl(path)} alt="Review photo" className="h-full w-full object-cover" />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
      <div id="portfolio-photos" className="scroll-mt-28" tabIndex={-1} aria-hidden />
      <ProfileForm profile={profile} email={session.user.email ?? null} />
    </section>
  );
};

export default ProfilePage;
