/**
 * Cleaner Bonus Promo — extra cleaner payout on escrow release, funded by reducing
 * the platform fee retained on that release (never increases lister charges).
 *
 * Settings live on `global_settings`; per-cleaner progress on `profiles`.
 */

export type GlobalSettingsCleanerPromoSlice = {
  enable_cleaner_promo?: boolean | null;
  cleaner_promo_max_jobs?: number | null;
  cleaner_promo_duration_days?: number | null;
  cleaner_promo_bonus_percentage?: number | null;
};

/** Defaults when columns are missing or null (matches SQL defaults). */
export const CLEANER_PROMO_DEFAULTS = {
  enable: true,
  maxJobs: 3,
  durationDays: 90,
  bonusPercentage: 10,
} as const;

export function normalizeCleanerPromoMaxJobs(raw: unknown): number {
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n)) return CLEANER_PROMO_DEFAULTS.maxJobs;
  return Math.max(1, Math.min(50, Math.floor(n)));
}

export function normalizeCleanerPromoDurationDays(raw: unknown): number {
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n)) return CLEANER_PROMO_DEFAULTS.durationDays;
  return Math.max(1, Math.min(730, Math.floor(n)));
}

export function normalizeCleanerPromoBonusPercentage(raw: unknown): number {
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n)) return CLEANER_PROMO_DEFAULTS.bonusPercentage;
  return Math.max(0, Math.min(100, Math.round(n * 100) / 100));
}

/**
 * Whether global promo is enabled (explicit false turns off; missing/null = on).
 */
export function cleanerPromoGloballyOn(settings: GlobalSettingsCleanerPromoSlice | null): boolean {
  return settings?.enable_cleaner_promo !== false;
}

/**
 * Cleaner still has promo slots and is inside the rolling window from `cleaner_promo_start_date`.
 * When `startDate` is null, window has not started yet — eligible until first bonus sets the anchor.
 */
export function cleanerPromoWindowOpen(params: {
  settings: GlobalSettingsCleanerPromoSlice | null;
  jobsUsed: number;
  startDateIso: string | null;
  now: Date;
}): boolean {
  if (!cleanerPromoGloballyOn(params.settings)) return false;
  const maxJobs = normalizeCleanerPromoMaxJobs(params.settings?.cleaner_promo_max_jobs);
  if (params.jobsUsed >= maxJobs) return false;

  const trimmed = String(params.startDateIso ?? "").trim();
  if (!trimmed) return true;

  const start = new Date(trimmed);
  if (!Number.isFinite(start.getTime())) return true;

  const durationDays = normalizeCleanerPromoDurationDays(params.settings?.cleaner_promo_duration_days);
  const endMs = start.getTime() + durationDays * 86_400_000;
  return params.now.getTime() <= endMs;
}

/**
 * Desired bonus in cents (% of agreed total), capped by total platform fee cents available on this release.
 */
export function fundedCleanerBonusCents(params: {
  agreedCentsTotal: number;
  bonusPercentage: number;
  totalPlatformFeeCents: number;
}): number {
  const pct = normalizeCleanerPromoBonusPercentage(params.bonusPercentage);
  if (pct <= 0 || params.agreedCentsTotal < 1) return 0;
  const desired = Math.floor((params.agreedCentsTotal * pct) / 100);
  return Math.min(Math.max(0, desired), Math.max(0, Math.floor(params.totalPlatformFeeCents)));
}

/**
 * Scale per-leg platform fees down so sum decreases by `bonusCents` (proportional split, rounding fix on last leg).
 */
export function reducedLegPlatformFeesCents(
  baseFees: readonly number[],
  bonusCents: number
): number[] {
  if (baseFees.length === 0) return [];
  const total = baseFees.reduce((s, f) => s + Math.max(0, f), 0);
  if (total < 1 || bonusCents < 1) return [...baseFees];

  const targetTotal = Math.max(0, total - bonusCents);
  const scale = targetTotal / total;
  const out = baseFees.map((f) => {
    const x = Math.max(0, f);
    return Math.max(0, Math.round(x * scale));
  });
  let drift = targetTotal - out.reduce((s, f) => s + f, 0);
  let i = out.length - 1;
  while (drift !== 0 && i >= 0) {
    const adj = drift > 0 ? 1 : -1;
    const cur = out[i] ?? 0;
    const next = Math.max(0, cur + adj);
    if (next !== cur || adj > 0) {
      out[i] = next;
      drift -= adj;
    }
    i--;
  }
  return out;
}
