import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import type { GlobalFeeSettings } from "@/lib/platform-fee";
import { resolvePlatformFeePercent } from "@/lib/platform-fee";
import {
  SERVICE_TYPES,
  normalizeServiceType,
  type ServiceTypeKey,
} from "@/lib/service-types";

/** Optional columns on `global_settings` (see supabase/sql/*_launch_promo.sql). */
export type LaunchPromoGlobalFields = {
  launch_promo_active?: boolean | null;
  launch_promo_ends_at?: string | null;
  launch_promo_free_job_slots?: number | null;
  launch_promo_show_bond_pro_nudge?: boolean | null;
  /** Legacy / admin UI only — fee logic does not use this for 0% (launch is all types; ongoing tier is Airbnb + recurring). */
  launch_promo_zero_fee_service_types?: string[] | null;
  /** Enforced AUD ceiling for ongoing Airbnb + recurring free tier (starting / job amount). */
  launch_promo_marketing_price_cap_aud?: number | null;
  /** Enforced per Sydney calendar month for ongoing Airbnb + recurring free tier. */
  launch_promo_marketing_monthly_airbnb_recurring_cap?: number | null;
};

export type GlobalSettingsWithLaunchPromo = GlobalFeeSettings & LaunchPromoGlobalFields;

/** Default max completed jobs at 0% during launch window (any service type). */
const DEFAULT_LAUNCH_FREE_SLOTS = 5;
const MAX_FREE_SLOTS_CAP = 20;

/** Days from signup during which launch promo may apply (alongside global window + slot count). */
export const LAUNCH_PROMO_SIGNUP_WINDOW_DAYS = 90;

const MS_PER_DAY = 86400000;

/**
 * Fallback marketing numbers when DB columns are missing (see `launchPromoMarketing*` helpers).
 */
export const LAUNCH_PROMO_MARKETING_MONTHLY_AIRBNB_RECURRING_CAP = 2;
export const LAUNCH_PROMO_MARKETING_PRICE_CAP_AUD = 350;

/** Default fee-free types when `launch_promo_zero_fee_service_types` is absent (admin copy / legacy UI). */
export const DEFAULT_LAUNCH_PROMO_ZERO_FEE_SERVICE_TYPES: readonly ServiceTypeKey[] = [
  "airbnb_turnover",
  "recurring_house_cleaning",
] as const;

const SYDNEY_TZ = "Australia/Sydney";

/** `YYYY-MM` in Australia/Sydney for calendar-month resets. */
export function calendarMonthKeyAuSydney(d: Date): string {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: SYDNEY_TZ,
    year: "numeric",
    month: "2-digit",
  });
  const parts = fmt.formatToParts(d);
  const y = parts.find((p) => p.type === "year")?.value;
  const m = parts.find((p) => p.type === "month")?.value;
  if (!y || !m) return d.toISOString().slice(0, 7);
  return `${y}-${m}`;
}

export function launchPromoZeroFeeServiceTypes(
  settings: GlobalSettingsWithLaunchPromo | null | undefined
): ServiceTypeKey[] {
  const raw = settings?.launch_promo_zero_fee_service_types;
  if (raw === undefined || raw === null) {
    return [...DEFAULT_LAUNCH_PROMO_ZERO_FEE_SERVICE_TYPES];
  }
  if (!Array.isArray(raw)) {
    return [...DEFAULT_LAUNCH_PROMO_ZERO_FEE_SERVICE_TYPES];
  }
  const set = new Set<string>();
  for (const x of raw) {
    const t = String(x ?? "").trim().toLowerCase();
    if ((SERVICE_TYPES as readonly string[]).includes(t)) set.add(t);
  }
  return SERVICE_TYPES.filter((k) => set.has(k));
}

export function launchPromoZeroFeeEligibleWithTypes(
  serviceType: string | null | undefined,
  eligibleTypes: readonly ServiceTypeKey[]
): boolean {
  const raw = String(serviceType ?? "").trim();
  if (!raw) return true;
  return eligibleTypes.includes(normalizeServiceType(raw));
}

export function launchPromoZeroFeeEligibleForServiceType(
  serviceType: string | null | undefined,
  settings?: GlobalSettingsWithLaunchPromo | null
): boolean {
  return launchPromoZeroFeeEligibleWithTypes(
    serviceType,
    launchPromoZeroFeeServiceTypes(settings ?? null)
  );
}

export function launchPromoMarketingPriceCapAud(
  settings: LaunchPromoGlobalFields | null | undefined
): number {
  const v = settings?.launch_promo_marketing_price_cap_aud;
  if (typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 999999) {
    return Math.round(v);
  }
  return LAUNCH_PROMO_MARKETING_PRICE_CAP_AUD;
}

export function launchPromoMarketingMonthlyAirbnbRecurringCap(
  settings: LaunchPromoGlobalFields | null | undefined
): number {
  const v = settings?.launch_promo_marketing_monthly_airbnb_recurring_cap;
  if (typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 100) {
    return Math.floor(v);
  }
  return LAUNCH_PROMO_MARKETING_MONTHLY_AIRBNB_RECURRING_CAP;
}

export function launchPromoFreeJobSlots(
  settings: GlobalSettingsWithLaunchPromo | null | undefined
): number {
  const raw = settings?.launch_promo_free_job_slots;
  const n =
    typeof raw === "number" && Number.isFinite(raw) ? Math.floor(raw) : DEFAULT_LAUNCH_FREE_SLOTS;
  return Math.max(1, Math.min(MAX_FREE_SLOTS_CAP, n));
}

/** Promo window is open at `now` (active flag + optional end date). */
export function isLaunchPromoWindowOpen(
  settings: LaunchPromoGlobalFields | null | undefined,
  now: Date
): boolean {
  if (!settings || settings.launch_promo_active === false) return false;
  const endRaw = settings.launch_promo_ends_at;
  if (endRaw == null || String(endRaw).trim() === "") return true;
  const endMs = new Date(endRaw).getTime();
  if (!Number.isFinite(endMs)) return true;
  return now.getTime() < endMs;
}

export function listerLaunchPromoSignupDeadline(createdAtIso: string | null | undefined): Date | null {
  if (createdAtIso == null || String(createdAtIso).trim() === "") return null;
  const ms = new Date(createdAtIso).getTime();
  if (!Number.isFinite(ms)) return null;
  return new Date(ms + LAUNCH_PROMO_SIGNUP_WINDOW_DAYS * MS_PER_DAY);
}

export function listerWithinLaunchPromoSignupWindow(
  createdAtIso: string | null | undefined,
  now: Date
): boolean {
  const end = listerLaunchPromoSignupDeadline(createdAtIso);
  if (!end) return false;
  return now.getTime() < end.getTime();
}

/**
 * Strictest end instant for the lister's launch promo: earlier of global `launch_promo_ends_at`
 * and signup + 90 days. Null if neither applies (no global end and no valid signup).
 */
export function listerLaunchPromoWindowEndDate(
  settings: LaunchPromoGlobalFields | null | undefined,
  profileCreatedAtIso: string | null | undefined
): Date | null {
  const endsMs: number[] = [];
  const personal = listerLaunchPromoSignupDeadline(profileCreatedAtIso);
  if (personal && Number.isFinite(personal.getTime())) {
    endsMs.push(personal.getTime());
  }
  const endRaw = settings?.launch_promo_ends_at;
  if (endRaw != null && String(endRaw).trim() !== "") {
    const g = new Date(endRaw).getTime();
    if (Number.isFinite(g)) endsMs.push(g);
  }
  if (endsMs.length === 0) return null;
  return new Date(Math.min(...endsMs));
}

/**
 * Whole calendar days until the lister's launch window ends (ceil), or `null` if promo closed / no end.
 */
export function launchPromoCalendarDaysRemainingForLister(
  settings: GlobalSettingsWithLaunchPromo | null | undefined,
  profileCreatedAtIso: string | null | undefined,
  now: Date
): number | null {
  if (!isLaunchPromoWindowOpen(settings, now)) return null;
  const end = listerLaunchPromoWindowEndDate(settings, profileCreatedAtIso);
  if (!end || !Number.isFinite(end.getTime())) return null;
  const ms = end.getTime() - now.getTime();
  if (ms <= 0) return 0;
  return Math.max(1, Math.ceil(ms / MS_PER_DAY));
}

export function ongoingFreeTierServiceTypes(): readonly ServiceTypeKey[] {
  return ["airbnb_turnover", "recurring_house_cleaning"] as const;
}

export function isOngoingFreeTierServiceType(serviceType: string | null | undefined): boolean {
  if (!serviceType) return false;
  return (ongoingFreeTierServiceTypes() as readonly string[]).includes(
    normalizeServiceType(serviceType)
  );
}

type ListingFeeSlice = {
  service_type?: string | null;
  reserve_cents?: number | null;
  buy_now_cents?: number | null;
  starting_price_cents?: number | null;
  current_lowest_bid_cents?: number | null;
};

export function listingJobAmountAudFromRow(
  listing: ListingFeeSlice | null | undefined,
  agreedAmountCents?: number | null
): number {
  if (agreedAmountCents != null && agreedAmountCents > 0) {
    return agreedAmountCents / 100;
  }
  if (!listing) return 0;
  const cents = [
    listing.reserve_cents,
    listing.buy_now_cents ?? 0,
    listing.starting_price_cents,
    listing.current_lowest_bid_cents ?? 0,
  ].filter((n): n is number => typeof n === "number" && Number.isFinite(n) && n > 0);
  if (cents.length === 0) return 0;
  return Math.max(...cents) / 100;
}

type ProfilePromoSlice = {
  created_at?: string | null;
  launch_promo_lister_jobs_used?: number | null;
  free_tier_airbnb_recurring_month_key?: string | null;
  free_tier_airbnb_recurring_jobs_used?: number | null;
};

export function effectiveFreeTierAirbnbRecurringJobsUsed(
  profile: ProfilePromoSlice | null | undefined,
  currentMonthKey: string
): number {
  if (!profile) return 0;
  if (String(profile.free_tier_airbnb_recurring_month_key ?? "").trim() !== currentMonthKey) {
    return 0;
  }
  const n = profile.free_tier_airbnb_recurring_jobs_used;
  return typeof n === "number" && Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
}

export function listerQualifiesForLaunchPromoZeroFee(params: {
  settings: GlobalSettingsWithLaunchPromo | null;
  profileCreatedAtIso: string | null | undefined;
  launchJobsUsed: number;
  now: Date;
}): boolean {
  const { settings, profileCreatedAtIso, launchJobsUsed, now } = params;
  if (!isLaunchPromoWindowOpen(settings, now)) return false;
  if (!listerWithinLaunchPromoSignupWindow(profileCreatedAtIso, now)) return false;
  const slots = launchPromoFreeJobSlots(settings);
  return launchJobsUsed < slots;
}

/** @deprecated Prefer `estimateListerFeePercentForDraft` or server `resolveListerPlatformFeeWithLaunchPromo`. */
export function listerQualifiesForZeroPlatformFee(params: {
  baseFeePercent: number;
  listerJobsUsed: number;
  freeSlots: number;
  promoOpen: boolean;
}): boolean {
  const { baseFeePercent, listerJobsUsed, freeSlots, promoOpen } = params;
  if (!promoOpen) return false;
  if (!(baseFeePercent > 0)) return false;
  return listerJobsUsed < freeSlots;
}

export function applyLaunchPromoToListerFeePercent(params: {
  baseFeePercent: number;
  listerJobsUsed: number;
  freeSlots: number;
  promoOpen: boolean;
}): number {
  if (
    listerQualifiesForZeroPlatformFee({
      baseFeePercent: params.baseFeePercent,
      listerJobsUsed: params.listerJobsUsed,
      freeSlots: params.freeSlots,
      promoOpen: params.promoOpen,
    })
  ) {
    return 0;
  }
  return params.baseFeePercent;
}

export async function fetchListerPromoJobsUsed(
  supabase: Pick<SupabaseClient<Database>, "from">,
  listerId: string
): Promise<number> {
  const { data, error } = await supabase
    .from("profiles")
    .select("launch_promo_lister_jobs_used")
    .eq("id", listerId)
    .maybeSingle();
  if (error || !data) return 0;
  const row = data as { launch_promo_lister_jobs_used?: number | null };
  const n = row.launch_promo_lister_jobs_used;
  return typeof n === "number" && Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
}

export async function fetchCleanerPromoJobsUsed(
  supabase: Pick<SupabaseClient<Database>, "from">,
  cleanerId: string
): Promise<number> {
  const { data, error } = await supabase
    .from("profiles")
    .select("launch_promo_cleaner_jobs_used")
    .eq("id", cleanerId)
    .maybeSingle();
  if (error || !data) return 0;
  const row = data as { launch_promo_cleaner_jobs_used?: number | null };
  const n = row.launch_promo_cleaner_jobs_used;
  return typeof n === "number" && Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
}

export type ListerZeroFeeSource = "launch_promo" | "ongoing_free_airbnb_recurring";

export type ListerPlatformFeeResolution = {
  feePercent: number;
  /** When the lister pays no platform fee (`feePercent === 0`), which program waived it (for counters). */
  zeroFeeSource: ListerZeroFeeSource | null;
};

/**
 * Single source of truth for lister fee %: launch promo (first N jobs, any type, within global + 90d),
 * then ongoing Airbnb/recurring tier (price cap + monthly limit), else base listing fee.
 */
export async function resolveListerPlatformFeeWithLaunchPromo(
  supabase: Pick<SupabaseClient<Database>, "from">,
  params: {
    listingId: string | number | null | undefined;
    listerId: string;
    settings: GlobalSettingsWithLaunchPromo | null;
    agreedAmountCents?: number | null;
    now?: Date;
  }
): Promise<ListerPlatformFeeResolution> {
  const now = params.now ?? new Date();
  const { listingId, listerId, settings, agreedAmountCents } = params;

  const listingSelect =
    listingId != null && String(listingId).trim() !== ""
      ? supabase
          .from("listings")
          .select(
            "service_type, platform_fee_percentage, reserve_cents, buy_now_cents, starting_price_cents, current_lowest_bid_cents"
          )
          .eq("id", String(listingId))
          .maybeSingle()
      : Promise.resolve({ data: null, error: null });

  const profileSelect = supabase
    .from("profiles")
    .select(
      "created_at, launch_promo_lister_jobs_used, free_tier_airbnb_recurring_month_key, free_tier_airbnb_recurring_jobs_used"
    )
    .eq("id", listerId)
    .maybeSingle();

  const [{ data: listingRow }, { data: profileData }] = await Promise.all([
    listingSelect,
    profileSelect,
  ]);

  const row = listingRow as {
    service_type?: string | null;
    platform_fee_percentage?: number | null;
    reserve_cents?: number | null;
    buy_now_cents?: number | null;
    starting_price_cents?: number | null;
    current_lowest_bid_cents?: number | null;
  } | null;

  const serviceType = row?.service_type ?? null;
  const settingsForFee = settings as GlobalFeeSettings;
  const snapshotFee = resolvePlatformFeePercent(
    row?.platform_fee_percentage,
    settingsForFee,
    serviceType
  );
  /** Standard rate for this listing’s service (ignores per-listing snapshot). Used to decide if a waiver “counts”. */
  const globalFee = resolvePlatformFeePercent(undefined, settingsForFee, serviceType);

  if (!(globalFee > 0)) {
    return { feePercent: snapshotFee, zeroFeeSource: null };
  }

  const listing: ListingFeeSlice | null = row
    ? {
        service_type: row.service_type,
        reserve_cents: row.reserve_cents,
        buy_now_cents: row.buy_now_cents,
        starting_price_cents: row.starting_price_cents,
        current_lowest_bid_cents: row.current_lowest_bid_cents,
      }
    : null;
  const profile = profileData as ProfilePromoSlice | null;

  const launchUsedRaw = profile?.launch_promo_lister_jobs_used;
  const launchUsed =
    typeof launchUsedRaw === "number" && Number.isFinite(launchUsedRaw) && launchUsedRaw >= 0
      ? Math.floor(launchUsedRaw)
      : 0;

  if (
    listerQualifiesForLaunchPromoZeroFee({
      settings,
      profileCreatedAtIso: profile?.created_at ?? null,
      launchJobsUsed: launchUsed,
      now,
    })
  ) {
    return { feePercent: 0, zeroFeeSource: "launch_promo" };
  }

  if (!isOngoingFreeTierServiceType(serviceType)) {
    return { feePercent: snapshotFee, zeroFeeSource: null };
  }

  const priceAud = listingJobAmountAudFromRow(listing, agreedAmountCents);
  if (priceAud <= 0) {
    return { feePercent: snapshotFee, zeroFeeSource: null };
  }

  const capAud = launchPromoMarketingPriceCapAud(settings);
  if (priceAud > capAud) {
    return { feePercent: snapshotFee, zeroFeeSource: null };
  }

  const monthKey = calendarMonthKeyAuSydney(now);
  const ftUsed = effectiveFreeTierAirbnbRecurringJobsUsed(profile, monthKey);
  const monthlyCap = launchPromoMarketingMonthlyAirbnbRecurringCap(settings);
  if (ftUsed < monthlyCap) {
    return { feePercent: 0, zeroFeeSource: "ongoing_free_airbnb_recurring" };
  }

  return { feePercent: snapshotFee, zeroFeeSource: null };
}

export async function fetchListerPlatformFeePercentWithLaunchPromo(
  supabase: Pick<SupabaseClient<Database>, "from">,
  listingId: string | number | null | undefined,
  listerId: string,
  settings: GlobalSettingsWithLaunchPromo | null,
  agreedAmountCents?: number | null
): Promise<number> {
  const r = await resolveListerPlatformFeeWithLaunchPromo(supabase, {
    listingId,
    listerId,
    settings,
    agreedAmountCents,
  });
  return r.feePercent;
}

/** Client-side fee preview for the new listing form (must mirror `resolveListerPlatformFeeWithLaunchPromo`). */
export function estimateListerFeePercentForDraft(params: {
  baseFeePercent: number;
  serviceType: string;
  reserveAud: number;
  profileCreatedAtIso: string;
  now: Date;
  launchPromoGlobalOpen: boolean;
  launchGlobalEndsAtMs: number | null;
  launchFreeSlots: number;
  launchJobsUsed: number;
  freeTierPriceCapAud: number;
  freeTierMonthlyCap: number;
  /** From server: jobs used this month for Airbnb/recurring free tier. */
  freeTierJobsUsedThisMonth: number;
  /** From server: Sydney YYYY-MM that `freeTierJobsUsedThisMonth` refers to. */
  freeTierMonthKeyFromServer: string;
}): number {
  const {
    baseFeePercent,
    serviceType,
    reserveAud,
    profileCreatedAtIso,
    now,
    launchPromoGlobalOpen,
    launchGlobalEndsAtMs,
    launchFreeSlots,
    launchJobsUsed,
    freeTierPriceCapAud,
    freeTierMonthlyCap,
    freeTierJobsUsedThisMonth,
    freeTierMonthKeyFromServer,
  } = params;

  if (!(baseFeePercent > 0)) return baseFeePercent;

  const globalOpen =
    launchPromoGlobalOpen &&
    (launchGlobalEndsAtMs == null || now.getTime() < launchGlobalEndsAtMs);

  if (
    globalOpen &&
    listerWithinLaunchPromoSignupWindow(profileCreatedAtIso, now) &&
    launchJobsUsed < launchFreeSlots
  ) {
    return 0;
  }

  if (!isOngoingFreeTierServiceType(serviceType)) {
    return baseFeePercent;
  }
  if (reserveAud <= 0 || reserveAud > freeTierPriceCapAud) {
    return baseFeePercent;
  }
  const keyNow = calendarMonthKeyAuSydney(now);
  const used =
    freeTierMonthKeyFromServer === keyNow ? freeTierJobsUsedThisMonth : 0;
  if (used >= freeTierMonthlyCap) return baseFeePercent;
  return 0;
}

export type LaunchPromoDashboardModel =
  | {
      phase: "active";
      used: number;
      freeSlots: number;
      endsAt: Date | null;
      showBondProNudge: boolean;
    }
  | {
      phase: "completed";
      freeSlots: number;
      showBondProNudge: boolean;
    }
  | {
      phase: "ended";
      normalFeePercent: number;
      showBondProNudge: boolean;
    };

export function launchPromoCalendarDaysRemaining(
  settings: GlobalSettingsWithLaunchPromo | null | undefined,
  now: Date
): number | null {
  if (!isLaunchPromoWindowOpen(settings, now)) return null;
  const endRaw = settings?.launch_promo_ends_at;
  if (endRaw == null || String(endRaw).trim() === "") return null;
  const endMs = new Date(endRaw).getTime();
  if (!Number.isFinite(endMs)) return null;
  const ms = endMs - now.getTime();
  if (ms <= 0) return 0;
  return Math.max(1, Math.ceil(ms / MS_PER_DAY));
}

export function launchPromoPublicBannerVisible(
  settings: GlobalSettingsWithLaunchPromo | null | undefined,
  now: Date
): boolean {
  return isLaunchPromoWindowOpen(settings, now);
}

export function buildLaunchPromoDashboardModel(params: {
  used: number;
  settings: GlobalSettingsWithLaunchPromo | null;
  now: Date;
  normalFeePercent: number;
  /** When set, `endsAt` uses min(global end, signup + 90d) for listers. */
  profileCreatedAt?: string | null;
}): LaunchPromoDashboardModel {
  const { used, settings, now, normalFeePercent, profileCreatedAt } = params;
  const freeSlots = launchPromoFreeJobSlots(settings);
  const showBondProNudge = settings?.launch_promo_show_bond_pro_nudge === true;
  const promoOpen = isLaunchPromoWindowOpen(settings, now);

  if (!promoOpen) {
    return {
      phase: "ended",
      normalFeePercent,
      showBondProNudge,
    };
  }

  if (used >= freeSlots) {
    return {
      phase: "completed",
      freeSlots,
      showBondProNudge,
    };
  }

  const endsAt = listerLaunchPromoWindowEndDate(settings, profileCreatedAt ?? null);

  return {
    phase: "active",
    used,
    freeSlots,
    endsAt,
    showBondProNudge,
  };
}

export type LaunchPromoIncrementResult =
  | { bumped: false }
  | {
      bumped: true;
      zeroFeeSource: ListerZeroFeeSource;
      /** `launch_promo_lister_jobs_used` after this completion (unchanged when bump was ongoing-only). */
      launchListerJobsUsedAfter: number;
      cleanerUsedAfter: number | null;
    };

export async function incrementLaunchPromoJobCompletionsIfNeeded(
  admin: SupabaseClient<Database>,
  params: {
    listerId: string;
    winnerId: string | null;
    appliedFeePercent: number;
    zeroFeeSource: ListerZeroFeeSource | null;
  }
): Promise<LaunchPromoIncrementResult> {
  const { listerId, winnerId, appliedFeePercent, zeroFeeSource } = params;
  if (appliedFeePercent !== 0 || !zeroFeeSource) {
    return { bumped: false };
  }
  const nowIso = new Date().toISOString();

  const readLaunchLister = async (): Promise<number> => {
    const { data: row } = await admin
      .from("profiles")
      .select("launch_promo_lister_jobs_used")
      .eq("id", listerId)
      .maybeSingle();
    const cur = (row as { launch_promo_lister_jobs_used?: number } | null)
      ?.launch_promo_lister_jobs_used;
    return typeof cur === "number" && cur >= 0 ? Math.floor(cur) : 0;
  };

  const bumpListerLaunch = async (): Promise<number> => {
    const { data: row } = await admin
      .from("profiles")
      .select("launch_promo_lister_jobs_used")
      .eq("id", listerId)
      .maybeSingle();
    const cur = (row as { launch_promo_lister_jobs_used?: number } | null)
      ?.launch_promo_lister_jobs_used;
    const n = typeof cur === "number" && cur >= 0 ? cur : 0;
    const next = n + 1;
    await admin
      .from("profiles")
      .update({
        launch_promo_lister_jobs_used: next,
        updated_at: nowIso,
      } as never)
      .eq("id", listerId);
    return next;
  };

  const bumpListerFreeTier = async (): Promise<void> => {
    const monthKey = calendarMonthKeyAuSydney(new Date());
    const { data: row } = await admin
      .from("profiles")
      .select("free_tier_airbnb_recurring_month_key, free_tier_airbnb_recurring_jobs_used")
      .eq("id", listerId)
      .maybeSingle();
    const r = row as {
      free_tier_airbnb_recurring_month_key?: string | null;
      free_tier_airbnb_recurring_jobs_used?: number | null;
    } | null;
    const storedKey = r?.free_tier_airbnb_recurring_month_key;
    let next = 1;
    if (String(storedKey ?? "").trim() === monthKey) {
      const cur = r?.free_tier_airbnb_recurring_jobs_used;
      const n = typeof cur === "number" && cur >= 0 ? cur : 0;
      next = n + 1;
    }
    await admin
      .from("profiles")
      .update({
        free_tier_airbnb_recurring_month_key: monthKey,
        free_tier_airbnb_recurring_jobs_used: next,
        updated_at: nowIso,
      } as never)
      .eq("id", listerId);
  };

  const bumpCleaner = async (cleanerId: string): Promise<number> => {
    const { data: row } = await admin
      .from("profiles")
      .select("launch_promo_cleaner_jobs_used")
      .eq("id", cleanerId)
      .maybeSingle();
    const cur = (row as { launch_promo_cleaner_jobs_used?: number } | null)
      ?.launch_promo_cleaner_jobs_used;
    const n = typeof cur === "number" && cur >= 0 ? cur : 0;
    const next = n + 1;
    await admin
      .from("profiles")
      .update({
        launch_promo_cleaner_jobs_used: next,
        updated_at: nowIso,
      } as never)
      .eq("id", cleanerId);
    return next;
  };

  let launchListerJobsUsedAfter: number;
  if (zeroFeeSource === "launch_promo") {
    launchListerJobsUsedAfter = await bumpListerLaunch();
  } else {
    await bumpListerFreeTier();
    launchListerJobsUsedAfter = await readLaunchLister();
  }

  const w = winnerId != null ? String(winnerId).trim() : "";
  const cleanerUsedAfter = w ? await bumpCleaner(w) : null;
  return {
    bumped: true,
    zeroFeeSource,
    launchListerJobsUsedAfter,
    cleanerUsedAfter,
  };
}
