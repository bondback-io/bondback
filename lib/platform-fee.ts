import {
  SERVICE_TYPES,
  type ServiceTypeKey,
  normalizeServiceType,
} from "@/lib/service-types";

/** Shape of global_settings fee fields (avoid importing server action types in client code). */
export type GlobalFeeSettings = {
  platform_fee_percentage?: number | null;
  fee_percentage?: number | null;
  platform_fee_percentage_by_service_type?: unknown;
} | null;

function baseGlobalPlatformFeePercent(globalOrSettings: GlobalFeeSettings | number): number {
  if (typeof globalOrSettings === "number") {
    return globalOrSettings;
  }
  return (
    globalOrSettings?.platform_fee_percentage ??
    globalOrSettings?.fee_percentage ??
    12
  );
}

/**
 * Parse stored jsonb into validated partial map (known service types only, 0–100).
 */
export function parsePlatformFeePercentByServiceType(
  raw: unknown
): Partial<Record<ServiceTypeKey, number>> {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) return {};
  const o = raw as Record<string, unknown>;
  const out: Partial<Record<ServiceTypeKey, number>> = {};
  for (const k of SERVICE_TYPES) {
    const v = o[k];
    if (typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 100) {
      out[k] = v;
    }
  }
  return out;
}

function globalFeePercentForServiceType(
  globalOrSettings: GlobalFeeSettings | number,
  serviceType?: string | null
): number {
  const base = baseGlobalPlatformFeePercent(globalOrSettings);
  if (
    typeof globalOrSettings === "number" ||
    !serviceType ||
    globalOrSettings == null ||
    typeof globalOrSettings !== "object"
  ) {
    return base;
  }
  const by = parsePlatformFeePercentByServiceType(
    globalOrSettings.platform_fee_percentage_by_service_type
  );
  const key = normalizeServiceType(serviceType);
  const hit = by[key];
  if (typeof hit === "number" && Number.isFinite(hit) && hit >= 0 && hit <= 100) {
    return hit;
  }
  return base;
}

/**
 * Effective platform fee % for a listing: prefer the value stored on the listing row
 * (set when the listing was created); otherwise fall back to global settings — optional
 * per-service-type override, then default platform fee %.
 * Second argument may be the resolved global percent (number) or settings object.
 * When the second argument is a number, per-service overrides cannot be applied (pass settings object instead).
 */
export function resolvePlatformFeePercent(
  listingFee: number | null | undefined,
  globalOrSettings: GlobalFeeSettings | number,
  serviceType?: string | null
): number {
  if (
    typeof listingFee === "number" &&
    !Number.isNaN(listingFee) &&
    listingFee >= 0 &&
    listingFee <= 100
  ) {
    return listingFee;
  }
  return globalFeePercentForServiceType(globalOrSettings, serviceType);
}

/**
 * Load listing snapshot and resolve fee (use for jobs/payments when you have listing_id).
 * `supabase` is untyped so `@supabase/ssr`, anon, and service clients all fit.
 */
export async function fetchPlatformFeePercentForListing(
   
  supabase: any,
  listingId: string | number | null | undefined,
  settings: GlobalFeeSettings
): Promise<number> {
  if (listingId == null || listingId === "") {
    return resolvePlatformFeePercent(undefined, settings);
  }
  const { data: listing } = await supabase
    .from("listings")
    .select("platform_fee_percentage, service_type")
    .eq("id", String(listingId))
    .maybeSingle();
  const row = listing as {
    platform_fee_percentage?: number | null;
    service_type?: string | null;
  } | null;
  const v = row?.platform_fee_percentage;
  return resolvePlatformFeePercent(v, settings, row?.service_type ?? null);
}
