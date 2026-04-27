import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import type { GlobalFeeSettings } from "@/lib/platform-fee";
import { fetchPlatformFeePercentForListing } from "@/lib/platform-fee";

/** Optional columns on `global_settings` (see supabase/sql/*_launch_promo.sql). */
export type LaunchPromoGlobalFields = {
  launch_promo_active?: boolean | null;
  launch_promo_ends_at?: string | null;
  launch_promo_free_job_slots?: number | null;
  launch_promo_show_bond_pro_nudge?: boolean | null;
};

export type GlobalSettingsWithLaunchPromo = GlobalFeeSettings & LaunchPromoGlobalFields;

const DEFAULT_FREE_SLOTS = 2;
const MAX_FREE_SLOTS_CAP = 20;

export function launchPromoFreeJobSlots(
  settings: GlobalSettingsWithLaunchPromo | null | undefined
): number {
  const raw = settings?.launch_promo_free_job_slots;
  const n = typeof raw === "number" && Number.isFinite(raw) ? Math.floor(raw) : DEFAULT_FREE_SLOTS;
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

/**
 * Effective lister-paid platform fee % (0 during promo when eligible).
 * Uses listing snapshot + global fee, then applies launch promo for `listerId`.
 */
export async function fetchListerPlatformFeePercentWithLaunchPromo(
  supabase: Pick<SupabaseClient<Database>, "from">,
  listingId: string | number | null | undefined,
  listerId: string,
  settings: GlobalSettingsWithLaunchPromo | null
): Promise<number> {
  const base = await fetchPlatformFeePercentForListing(supabase, listingId, settings);
  const freeSlots = launchPromoFreeJobSlots(settings);
  const promoOpen = isLaunchPromoWindowOpen(settings, new Date());
  const used = await fetchListerPromoJobsUsed(supabase, listerId);
  return applyLaunchPromoToListerFeePercent({
    baseFeePercent: base,
    listerJobsUsed: used,
    freeSlots,
    promoOpen,
  });
}

export type LaunchPromoDashboardModel =
  | {
      phase: "active";
      /** Role-specific “used” count (lister vs cleaner column). */
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

/**
 * Whole calendar days until `launch_promo_ends_at` (ceil), or `null` if promo closed / no end date set.
 */
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
  return Math.max(1, Math.ceil(ms / 86400000));
}

/** Public marketing: show launch promo hero when the window is open. */
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
  /** Default platform fee % when promo is off (e.g. 12). */
  normalFeePercent: number;
}): LaunchPromoDashboardModel {
  const { used, settings, now, normalFeePercent } = params;
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

  const endRaw = settings?.launch_promo_ends_at;
  let endsAt: Date | null = null;
  if (endRaw != null && String(endRaw).trim() !== "") {
    const d = new Date(endRaw);
    if (Number.isFinite(d.getTime())) endsAt = d;
  }

  return {
    phase: "active",
    used,
    freeSlots,
    endsAt,
    showBondProNudge,
  };
}

/**
 * After escrow release, if the lister paid 0% but the listing fee was > 0, consume one promo slot
 * for lister and cleaner.
 */
export type LaunchPromoIncrementResult =
  | { bumped: false }
  | {
      bumped: true;
      listerUsedAfter: number;
      cleanerUsedAfter: number | null;
    };

export async function incrementLaunchPromoJobCompletionsIfNeeded(
  admin: SupabaseClient<Database>,
  params: {
    listerId: string;
    winnerId: string | null;
    baseFeePercent: number;
    appliedFeePercent: number;
  }
): Promise<LaunchPromoIncrementResult> {
  const { listerId, winnerId, baseFeePercent, appliedFeePercent } = params;
  if (!(baseFeePercent > 0) || appliedFeePercent !== 0) return { bumped: false };
  const nowIso = new Date().toISOString();

  const bumpLister = async (): Promise<number> => {
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

  const listerUsedAfter = await bumpLister();
  const w = winnerId != null ? String(winnerId).trim() : "";
  const cleanerUsedAfter = w ? await bumpCleaner(w) : null;
  return { bumped: true, listerUsedAfter, cleanerUsedAfter };
}
