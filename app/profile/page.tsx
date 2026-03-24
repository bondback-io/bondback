import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getProfileCompletion } from "@/lib/profile-completion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Camera, MapPin, Star, BadgeCheck, Phone } from "lucide-react";
import type { Database } from "@/types/supabase";
import { VerificationBadges } from "@/components/shared/verification-badges";
import { recomputeVerificationBadgesForUser, syncCurrentUserEmailVerification } from "@/lib/actions/verification";
import { getGlobalSettings } from "@/lib/actions/global-settings";
import { ensureReferralCodeForUser } from "@/lib/actions/referral-code";
import { ProfileReferralSection } from "@/components/features/profile-referral-section";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { MyAccountSections } from "@/components/account/my-account-sections";
import { SettingsPaymentReturnHandler } from "@/components/settings/settings-payment-return-handler";
import type { DistanceUnitPref, ThemePreference } from "@/lib/types";

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

export const metadata: Metadata = {
  title: "Account & profile",
  description:
    "Manage your Bond Back profile, payments, notifications, and preferences for bond cleaning jobs in Australia.",
  alternates: { canonical: "/profile" },
  robots: { index: false, follow: true },
};

type ProfileSearchParams = {
  tab?: string;
  payments?: string;
  export?: string;
};

const TAB_TO_ACCORDION: Record<string, string> = {
  profile: "personal",
  personal: "personal",
  roles: "roles",
  notifications: "notifications",
  preferences: "notifications",
  security: "security",
  payments: "payments",
  privacy: "help",
  help: "help",
};

const ProfilePage = async ({
  searchParams,
}: {
  searchParams?: Promise<ProfileSearchParams> | ProfileSearchParams;
}) => {
  const sp = await Promise.resolve(searchParams ?? {});
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
  const isLister = roles.includes("lister");
  const showPaymentsTab = isLister || isCleaner;
  const isListerActive = activeRole === "lister";
  const isCleanerActive = activeRole === "cleaner";

  const abnDigits = (profile.abn ?? "").replace(/\D/g, "");
  const needsAbn = isCleaner && abnDigits.length !== 11;
  const portfolioCount = Array.isArray(profile.portfolio_photo_urls) ? profile.portfolio_photo_urls.length : 0;
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
        ? cleanerReviews.reduce((acc, r) => acc + Number(r.overall_rating ?? 0), 0) / cleanerReviews.length
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

  const tabFromQuery = (sp.tab as string | undefined)?.toLowerCase();
  const initialAccordion: string =
    tabFromQuery && tabFromQuery in TAB_TO_ACCORDION
      ? (TAB_TO_ACCORDION[tabFromQuery as keyof typeof TAB_TO_ACCORDION] ?? "personal")
      : "personal";

  const notificationPrefs = (profile as { notification_preferences?: Record<string, boolean> | null })
    ?.notification_preferences ?? null;
  const emailPreferencesLocked = (profile as { email_preferences_locked?: boolean })?.email_preferences_locked ?? false;
  const profilePublic = (profile as { profile_public?: boolean })?.profile_public ?? false;

  const prefRow = profile as { theme_preference?: string | null; distance_unit?: string | null };
  const themePreference: ThemePreference =
    prefRow.theme_preference === "light" ||
    prefRow.theme_preference === "dark" ||
    prefRow.theme_preference === "system"
      ? prefRow.theme_preference
      : "system";
  const distanceUnitPref: DistanceUnitPref = prefRow.distance_unit === "mi" ? "mi" : "km";

  const displayName =
    profile.full_name?.trim() ||
    session.user.email ||
    "User";
  const initials =
    displayName
      .split(" ")
      .map((n) => n[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "BB";
  const avatarUrl = profile.profile_photo_url?.trim() || null;

  return (
    <section className="page-inner space-y-8 text-foreground md:space-y-6 dark:text-gray-100">
      <SettingsPaymentReturnHandler />

      <div className="space-y-4">
        <div className="flex flex-col gap-5 md:gap-4">
          <Card className="overflow-hidden border-border bg-card/90 shadow-sm dark:border-gray-800 dark:bg-gray-950/90">
            <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:gap-6 sm:p-6">
              <Avatar className="h-20 w-20 shrink-0 border-2 border-border dark:border-gray-700">
                {avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <AvatarFallback className="text-lg font-semibold tracking-tight">{initials}</AvatarFallback>
                )}
              </Avatar>
              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl font-bold tracking-tight sm:text-3xl dark:text-gray-100">My Account</h1>
                  <VerificationBadges
                    badges={
                      (badgeRow as { verification_badges?: string[] | null } | null)?.verification_badges ??
                      (profile as { verification_badges?: string[] | null }).verification_badges ??
                      []
                    }
                    showLabel
                    size="lg"
                  />
                </div>
                <p className="truncate text-base text-muted-foreground dark:text-gray-400">{displayName}</p>
                <div className="flex flex-wrap gap-2">
                  {isCleanerActive && (
                    <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200">
                      Cleaner
                    </Badge>
                  )}
                  {isListerActive && (
                    <Badge className="bg-sky-100 text-sky-800 dark:bg-sky-900/50 dark:text-sky-200">
                      Lister
                    </Badge>
                  )}
                  {!activeRole && (
                    <Badge variant="secondary">Set a role below</Badge>
                  )}
                </div>
              </div>
              <Button
                asChild
                size="lg"
                className="h-12 min-h-[48px] w-full shrink-0 rounded-full px-5 text-base font-semibold sm:w-auto sm:min-w-[10rem]"
              >
                <Link href="#section-personal">Edit profile</Link>
              </Button>
            </CardContent>
          </Card>

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
                    percent < 40 ? "bg-amber-500" : percent < 80 ? "bg-sky-500" : "bg-emerald-500"
                  }
                />
                <p className="text-sm font-medium text-foreground dark:text-gray-100">
                  {percent}% complete
                  {message ? (
                    <span className="font-normal text-muted-foreground dark:text-gray-400"> — {message}</span>
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
        </div>
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

      <Card className="border-border bg-card/80 shadow-sm dark:border-gray-800 dark:bg-gray-950 dark:text-gray-100">
        <CardHeader className="space-y-1 pb-2">
          <CardTitle className="text-xl dark:text-gray-100">Account settings</CardTitle>
          <CardDescription className="text-base dark:text-gray-400">
            Personal details, roles, notifications, payments, security, and help — all in one place.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 pt-0 sm:p-6">
          <MyAccountSections
            initialAccordion={initialAccordion}
            profile={profile}
            user={session.user}
            roles={roles}
            activeRole={activeRole}
            isCleaner={isCleaner}
            isLister={isLister}
            isListerActive={isListerActive}
            isCleanerActive={isCleanerActive}
            showPaymentsTab={showPaymentsTab}
            notificationPrefs={notificationPrefs}
            emailPreferencesLocked={emailPreferencesLocked}
            profilePublic={profilePublic}
            themePreference={themePreference}
            distanceUnitPref={distanceUnitPref}
          />
        </CardContent>
      </Card>

      {roles.includes("cleaner") && (
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
                <p className="text-sm font-medium text-foreground dark:text-gray-100">Recent reviews</p>
                {cleanerReviews.slice(0, 5).map((r) => (
                  <div
                    key={r.id}
                    className="space-y-1 rounded-md border border-border bg-background/70 p-3 dark:border-gray-700 dark:bg-gray-900/40"
                  >
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
                          <div
                            key={`${r.id}-${idx}`}
                            className="h-14 w-16 overflow-hidden rounded-md border border-border dark:border-gray-700"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={makePhotoUrl(path)}
                              alt="Review photo"
                              className="h-full w-full object-cover"
                            />
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
      )}
    </section>
  );
};

export default ProfilePage;
