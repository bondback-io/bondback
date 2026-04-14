import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getCriticalProfileTasks } from "@/lib/profile-critical-tasks";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Star,
  BadgeCheck,
  Smartphone,
  Calendar,
  Camera,
  Shield,
} from "lucide-react";
import type { Database } from "@/types/supabase";
import { VerificationBadges } from "@/components/shared/verification-badges";
import { recomputeVerificationBadgesForUser, syncCurrentUserEmailVerification } from "@/lib/actions/verification";
import { getGlobalSettings } from "@/lib/actions/global-settings";
import { ensureReferralCodeForUser } from "@/lib/actions/referral-code";
import { ProfileReferralSectionLazy } from "@/components/profile/profile-referral-section-lazy";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { MyAccountSections } from "@/components/account/my-account-sections";
import { ProfileEssentialTaskLink } from "@/components/profile/profile-essential-task-link";
import { SettingsPaymentReturnHandler } from "@/components/settings/settings-payment-return-handler";
import type { DistanceUnitPref, ThemePreference } from "@/lib/types";
import { getAppBaseUrl } from "@/lib/site";
import { REMOTE_IMAGE_BLUR_DATA_URL } from "@/lib/remote-image-blur";
import { effectiveProfilePhotoUrl } from "@/lib/profile-display-photo";
import { REVIEWEE_IS_CLEANER_OR } from "@/lib/reviews/cleaner-review-filters";

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
  searchParams?: Promise<ProfileSearchParams>;
}) => {
  const sp = (await searchParams) ?? {};
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

  const isCleaner = roles.includes("cleaner");
  const isLister = roles.includes("lister");
  const showPaymentsTab = isLister || isCleaner;
  const isListerActive = activeRole === "lister";
  const isCleanerActive = activeRole === "cleaner";

  const criticalProfile = getCriticalProfileTasks(profile, {
    activeRole,
    isCleaner,
    isLister,
  });
  const showCompleteProfileCard = criticalProfile.tasks.length > 0;

  const globalSettings = await getGlobalSettings();
  const referralEnabled = globalSettings?.referral_enabled === true;
  const appOrigin = getAppBaseUrl();
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
        .or(REVIEWEE_IS_CLEANER_OR)
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
  /** Only set when `?tab=` is present so account sections stay collapsed by default. */
  const initialAccordion: string | null =
    tabFromQuery && tabFromQuery in TAB_TO_ACCORDION
      ? (TAB_TO_ACCORDION[tabFromQuery as keyof typeof TAB_TO_ACCORDION] ?? "personal")
      : null;

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
  const avatarUrl = effectiveProfilePhotoUrl(profile);

  return (
    <section className="page-inner !px-3 sm:!px-6 space-y-5 text-foreground md:space-y-5 dark:text-gray-100">
      <SettingsPaymentReturnHandler />

      <div className="space-y-3">
        <div className="flex flex-col gap-4 md:gap-3">
          <Card className="overflow-hidden border-border bg-card/90 shadow-sm dark:border-gray-800 dark:bg-gray-950/90">
            <CardContent className="flex flex-col gap-4 px-3 py-4 sm:flex-row sm:items-center sm:gap-6 sm:p-6">
              <Avatar className="relative h-20 w-20 shrink-0 overflow-hidden border-2 border-border dark:border-gray-700">
                {avatarUrl ? (
                  <Image
                    src={avatarUrl}
                    alt=""
                    fill
                    sizes="80px"
                    className="object-cover"
                    priority
                    quality={75}
                    placeholder="blur"
                    blurDataURL={REMOTE_IMAGE_BLUR_DATA_URL}
                    referrerPolicy="no-referrer"
                  />
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
            <Card className="max-w-2xl border border-amber-200/70 bg-gradient-to-b from-amber-50/90 to-card shadow-sm dark:border-amber-900/40 dark:from-amber-950/30 dark:to-card">
              <CardHeader className="space-y-0.5 px-5 pb-2 pt-5 sm:px-6 sm:pb-3 sm:pt-6">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <CardTitle className="text-lg font-bold leading-tight tracking-tight sm:text-xl">
                      Finish the essentials
                    </CardTitle>
                    <CardDescription className="text-sm leading-snug text-muted-foreground dark:text-gray-400">
                      {criticalProfile.role === "cleaner"
                        ? "Cleaner — add the details listers expect before you bid."
                        : "Lister — a complete profile helps cleaners trust you."}
                    </CardDescription>
                  </div>
                  <span
                    className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-900 dark:bg-amber-900/50 dark:text-amber-100"
                    aria-hidden
                  >
                    To do
                  </span>
                </div>
              </CardHeader>
              <CardContent className="space-y-2.5 px-5 pb-5 pt-0 sm:px-6 sm:pb-6">
                <div className="space-y-1.5">
                  <Progress
                    value={criticalProfile.percent}
                    className="h-2"
                    indicatorClassName={
                      criticalProfile.percent < 40
                        ? "bg-amber-500"
                        : criticalProfile.percent < 80
                          ? "bg-sky-500"
                          : "bg-emerald-500"
                    }
                  />
                  <p className="text-xs font-medium text-foreground dark:text-gray-100">
                    {criticalProfile.percent}% essentials done
                    {criticalProfile.subtitle ? (
                      <span className="font-normal text-muted-foreground dark:text-gray-400">
                        {" "}
                        · {criticalProfile.subtitle}
                      </span>
                    ) : null}
                  </p>
                </div>
                <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {criticalProfile.tasks.map((task) => {
                    const iconCls =
                      "h-3.5 w-3.5 shrink-0 text-amber-800 dark:text-amber-200/90";
                    const icon =
                      task.key === "phone" ? (
                        <Smartphone className={iconCls} aria-hidden />
                      ) : task.key === "date_of_birth" ? (
                        <Calendar className={iconCls} aria-hidden />
                      ) : task.key === "profile_photo" ? (
                        <Camera className={iconCls} aria-hidden />
                      ) : task.key === "insurance" ? (
                        <Shield className={iconCls} aria-hidden />
                      ) : (
                        <BadgeCheck className={iconCls} aria-hidden />
                      );
                    return (
                      <li key={task.key} className="min-w-0">
                        <ProfileEssentialTaskLink
                          fieldId={task.fieldId}
                          className="flex min-h-[44px] flex-col justify-center gap-0.5 rounded-lg border border-amber-200/80 bg-background/90 px-2.5 py-2 text-left shadow-sm transition-colors hover:border-amber-400/80 hover:bg-amber-50/50 active:bg-amber-100/40 dark:border-amber-800/60 dark:bg-gray-950/60 dark:hover:bg-amber-950/40"
                        >
                          <span className="flex items-center gap-1.5">
                            {icon}
                            <span className="text-[10px] font-semibold uppercase tracking-wide text-amber-900 dark:text-amber-100/90">
                              Add
                            </span>
                          </span>
                          <span className="truncate text-xs font-medium leading-tight text-foreground dark:text-gray-100">
                            {task.label}
                          </span>
                        </ProfileEssentialTaskLink>
                      </li>
                    );
                  })}
                </ul>
                <p className="text-[11px] leading-snug text-muted-foreground dark:text-gray-500 pt-0.5">
                  Open{" "}
                  <ProfileEssentialTaskLink
                    fieldId="section-personal"
                    className="font-medium text-primary underline-offset-2 hover:underline dark:text-blue-300"
                  >
                    Personal info
                  </ProfileEssentialTaskLink>{" "}
                  below to update these fields.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {referralEnabled && referralCode && (
        <ProfileReferralSectionLazy
          referralCode={referralCode}
          accountCreditCents={accountCreditCents}
          appOrigin={appOrigin}
          referralTermsText={referralTermsText}
          referrerRewardDollars={referrerRewardDollars}
          referredRewardDollars={referredRewardDollars}
        />
      )}

      <Card className="border-border bg-card/80 shadow-sm dark:border-gray-800 dark:bg-gray-950 dark:text-gray-100">
        <CardHeader className="space-y-1.5 px-5 pb-3 pt-5 sm:px-6 sm:pb-4 sm:pt-6">
          <CardTitle className="text-xl leading-snug dark:text-gray-100">Account settings</CardTitle>
          <CardDescription className="text-sm leading-snug text-muted-foreground dark:text-gray-400">
            Personal details, roles, notifications, payments, security, and help — all in one place.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-5 pb-5 pt-0 sm:px-6 sm:pb-6">
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
          <CardContent className="space-y-4 px-3 pt-4 sm:px-6">
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
                            className="relative h-14 w-16 overflow-hidden rounded-md border border-border dark:border-gray-700"
                          >
                            <Image
                              src={makePhotoUrl(path)}
                              alt="Review photo"
                              fill
                              sizes="64px"
                              className="object-cover"
                              loading="lazy"
                              quality={65}
                              placeholder="blur"
                              blurDataURL={REMOTE_IMAGE_BLUR_DATA_URL}
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
