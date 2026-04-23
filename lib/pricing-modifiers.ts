/**
 * Listing base price from admin-configurable modifiers (Global Settings → Pricing Modifiers).
 *
 * Base (before add-ons), rounded to whole AUD:
 *   (base rate × bedrooms) × condition multiplier × levels multiplier × base multiplier
 *
 * Legacy reference (no extras, bedroom-only): 2bd $380, 3bd $480, 4bd $680, 5bd $780.
 * At Fair/Average (25%) and 1 Level: multiplier on (rate×beds) = 1.25.
 * Least-squares fit of K where K×1.25×beds ≈ those prices gives K ≈ 130.67.
 * Recommended admin defaults: base rate **131 AUD/bedroom**, base multiplier **1.0**
 * (3bd within ~$11 of $480; 2/4/5 differ slightly because the old table was not strictly linear in beds).
 */

import type { ListingAddonKey } from "@/lib/listing-addon-prices";
import { SERVICE_TYPES, type ServiceTypeKey } from "@/lib/service-types";

export type PropertyConditionKey =
  | "excellent_very_good"
  | "good"
  | "fair_average"
  | "poor_bad";

export type PropertyLevelsKey = "1" | "2";

export const PROPERTY_CONDITION_OPTIONS: {
  value: PropertyConditionKey;
  label: string;
}[] = [
  { value: "excellent_very_good", label: "Excellent / Very Good" },
  { value: "good", label: "Good" },
  { value: "fair_average", label: "Fair / Average" },
  { value: "poor_bad", label: "Poor / Bad" },
];

export const PROPERTY_LEVELS_OPTIONS: { value: PropertyLevelsKey; label: string }[] = [
  { value: "1", label: "1 Level" },
  { value: "2", label: "2 Levels" },
];

/**
 * Old Supabase/migration default for `pricing_base_rate_per_bedroom_aud` before the legacy-table
 * fit. Rows still storing 85 should use {@link DEFAULT_PRICING_MODIFIERS}.baseRatePerBedroomAud at read time.
 */
export const LEGACY_DEFAULT_BASE_RATE_PER_BEDROOM_AUD = 85;

/**
 * Normalize `global_settings.pricing_base_rate_per_bedroom_aud` for display and quoting.
 * Rows that still have the old default **85** are treated as the current recommended rate (131).
 */
/**
 * Parse `global_settings.pricing_base_rate_per_bedroom_by_service_type` (jsonb).
 * Each known service type gets a rate ≥ 1; unknown/missing keys use `fallbackAud`.
 */
export function resolveBaseRatePerBedroomByServiceFromGlobal(
  raw: unknown,
  fallbackAud: number
): Record<ServiceTypeKey, number> {
  const fb = Math.max(1, Number.isFinite(fallbackAud) ? fallbackAud : DEFAULT_PRICING_MODIFIERS.baseRatePerBedroomAud);
  const obj = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const out = {} as Record<ServiceTypeKey, number>;
  for (const k of SERVICE_TYPES) {
    const v = obj[k];
    const n =
      typeof v === "number" && Number.isFinite(v)
        ? v
        : typeof v === "string" && v.trim() !== ""
          ? Number(v)
          : NaN;
    out[k] = Number.isFinite(n) && n >= 1 ? Math.max(1, n) : fb;
  }
  return out;
}

export function normalizeBaseRatePerBedroomFromGlobal(raw: unknown): number {
  if (raw == null || raw === "") {
    return DEFAULT_PRICING_MODIFIERS.baseRatePerBedroomAud;
  }
  const v =
    typeof raw === "number" && Number.isFinite(raw)
      ? raw
      : typeof raw === "string" && raw.trim() !== ""
        ? Number(raw)
        : NaN;
  if (!Number.isFinite(v)) {
    return DEFAULT_PRICING_MODIFIERS.baseRatePerBedroomAud;
  }
  if (Math.abs(v - LEGACY_DEFAULT_BASE_RATE_PER_BEDROOM_AUD) < 0.005) {
    return DEFAULT_PRICING_MODIFIERS.baseRatePerBedroomAud;
  }
  return Math.max(1, v);
}

/** Defaults when global_settings columns are missing (aligned to legacy table; see file comment). */
export const DEFAULT_PRICING_MODIFIERS = {
  baseRatePerBedroomAud: 131,
  baseMultiplier: 1,
  carpetSteamPerBedroomAud: 120,
  wallsPerBedroomAud: 45,
  windowsPerBedroomAud: 40,
  addonOvenAud: 55,
  addonBalconyAud: 45,
  addonGarageAud: 55,
  addonLaundryAud: 45,
  addonPatioAud: 45,
  addonFridgeAud: 35,
  addonBlindsAud: 45,
  conditionExcellentVeryGoodPct: 0,
  conditionGoodPct: 12,
  conditionFairAveragePct: 25,
  conditionPoorBadPct: 40,
  levelsTwoPct: 15,
} as const;

export type PricingModifiersConfig = {
  /** Legacy column: default when per-service JSON has no entry (also used as fallback while resolving). */
  baseRatePerBedroomAud: number;
  /** Effective AUD per bedroom for each `listings.service_type` on the new listing flow. */
  baseRatePerBedroomByServiceAud: Record<ServiceTypeKey, number>;
  baseMultiplier: number;
  carpetSteamPerBedroomAud: number;
  wallsPerBedroomAud: number;
  windowsPerBedroomAud: number;
  addonOvenAud: number;
  addonBalconyAud: number;
  addonGarageAud: number;
  addonLaundryAud: number;
  addonPatioAud: number;
  addonFridgeAud: number;
  addonBlindsAud: number;
  conditionExcellentVeryGoodPct: number;
  conditionGoodPct: number;
  conditionFairAveragePct: number;
  conditionPoorBadPct: number;
  levelsTwoPct: number;
};

/** Read pricing modifiers from global_settings row (snake_case columns). */
export function resolvePricingModifiersFromGlobal(
  gs: Record<string, unknown> | null | undefined
): PricingModifiersConfig {
  const g = gs ?? {};
  const n = (k: string, d: number) => {
    const v = g[k];
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string" && v.trim() !== "") {
      const p = Number(v);
      if (Number.isFinite(p)) return p;
    }
    return d;
  };
  const D = DEFAULT_PRICING_MODIFIERS;
  const baseFallback = normalizeBaseRatePerBedroomFromGlobal(g["pricing_base_rate_per_bedroom_aud"]);
  return {
    baseRatePerBedroomAud: baseFallback,
    baseRatePerBedroomByServiceAud: resolveBaseRatePerBedroomByServiceFromGlobal(
      g["pricing_base_rate_per_bedroom_by_service_type"],
      baseFallback
    ),
    baseMultiplier: Math.max(0.01, n("pricing_base_multiplier", D.baseMultiplier)),
    carpetSteamPerBedroomAud: Math.max(0, n("pricing_carpet_steam_per_bedroom_aud", D.carpetSteamPerBedroomAud)),
    wallsPerBedroomAud: Math.max(0, n("pricing_walls_per_bedroom_aud", D.wallsPerBedroomAud)),
    windowsPerBedroomAud: Math.max(0, n("pricing_windows_per_bedroom_aud", D.windowsPerBedroomAud)),
    addonOvenAud: Math.max(0, n("pricing_addon_oven_aud", D.addonOvenAud)),
    addonBalconyAud: Math.max(0, n("pricing_addon_balcony_aud", D.addonBalconyAud)),
    addonGarageAud: Math.max(0, n("pricing_addon_garage_aud", D.addonGarageAud)),
    addonLaundryAud: Math.max(0, n("pricing_addon_laundry_aud", D.addonLaundryAud)),
    addonPatioAud: Math.max(0, n("pricing_addon_patio_aud", D.addonPatioAud)),
    addonFridgeAud: Math.max(0, n("pricing_addon_fridge_aud", D.addonFridgeAud)),
    addonBlindsAud: Math.max(0, n("pricing_addon_blinds_aud", D.addonBlindsAud)),
    conditionExcellentVeryGoodPct: Math.max(0, n("pricing_condition_excellent_very_good_pct", D.conditionExcellentVeryGoodPct)),
    conditionGoodPct: Math.max(0, n("pricing_condition_good_pct", D.conditionGoodPct)),
    conditionFairAveragePct: Math.max(0, n("pricing_condition_fair_average_pct", D.conditionFairAveragePct)),
    conditionPoorBadPct: Math.max(0, n("pricing_condition_poor_bad_pct", D.conditionPoorBadPct)),
    levelsTwoPct: Math.max(0, n("pricing_levels_two_pct", D.levelsTwoPct)),
  };
}

function conditionPctModifier(
  mod: PricingModifiersConfig,
  condition: PropertyConditionKey
): number {
  const pct =
    condition === "excellent_very_good"
      ? mod.conditionExcellentVeryGoodPct
      : condition === "good"
        ? mod.conditionGoodPct
        : condition === "fair_average"
          ? mod.conditionFairAveragePct
          : mod.conditionPoorBadPct;
  return 1 + Math.max(0, pct) / 100;
}

function levelsMultiplier(mod: PricingModifiersConfig, levels: PropertyLevelsKey): number {
  if (levels === "1") return 1;
  return 1 + Math.max(0, mod.levelsTwoPct) / 100;
}

/**
 * Base price in AUD (before add-ons), rounded to whole dollars.
 * (Base rate × bedrooms) × condition × levels × base multiplier
 */
export function computeBaseListingPriceAud(
  mod: PricingModifiersConfig,
  input: {
    bedrooms: number;
    condition: PropertyConditionKey;
    levels: PropertyLevelsKey;
    serviceType: ServiceTypeKey;
  }
): number {
  const beds = Math.max(1, Math.min(6, Math.round(Number(input.bedrooms)) || 1));
  const rate = Math.max(
    0,
    mod.baseRatePerBedroomByServiceAud[input.serviceType] ?? mod.baseRatePerBedroomAud
  );
  const raw =
    rate *
    beds *
    conditionPctModifier(mod, input.condition) *
    levelsMultiplier(mod, input.levels) *
    Math.max(0, mod.baseMultiplier);
  return Math.max(0, Math.round(raw));
}

function clampBedrooms(bedrooms: number): number {
  return Math.max(1, Math.min(6, Math.round(Number(bedrooms)) || 1));
}

/**
 * Add-on line price for new listing estimate (AUD, whole dollars).
 * Carpet steam, walls, windows: rate × bedrooms. Others: flat from admin.
 */
export function getListingAddonPriceFromModifiers(
  mod: PricingModifiersConfig,
  key: ListingAddonKey,
  bedrooms: number
): number {
  const beds = clampBedrooms(bedrooms);
  switch (key) {
    case "carpet_steam":
      return Math.max(0, Math.round(mod.carpetSteamPerBedroomAud * beds));
    case "walls":
      return Math.max(0, Math.round(mod.wallsPerBedroomAud * beds));
    case "windows":
      return Math.max(0, Math.round(mod.windowsPerBedroomAud * beds));
    case "oven":
      return Math.max(0, Math.round(mod.addonOvenAud));
    case "balcony":
      return Math.max(0, Math.round(mod.addonBalconyAud));
    case "garage":
      return Math.max(0, Math.round(mod.addonGarageAud));
    case "laundry":
      return Math.max(0, Math.round(mod.addonLaundryAud));
    case "patio":
      return Math.max(0, Math.round(mod.addonPatioAud));
    case "fridge":
      return Math.max(0, Math.round(mod.addonFridgeAud));
    case "blinds":
      return Math.max(0, Math.round(mod.addonBlindsAud));
    default:
      return 0;
  }
}
