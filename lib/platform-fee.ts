/** Shape of global_settings fee fields (avoid importing server action types in client code). */
export type GlobalFeeSettings = {
  platform_fee_percentage?: number | null;
  fee_percentage?: number | null;
} | null;

/**
 * Effective platform fee % for a listing: prefer the value stored on the listing row
 * (set when the listing was created); otherwise fall back to global settings (legacy rows).
 * Second argument may be the resolved global percent (number) or settings object.
 */
export function resolvePlatformFeePercent(
  listingFee: number | null | undefined,
  globalOrSettings: GlobalFeeSettings | number
): number {
  if (
    typeof listingFee === "number" &&
    !Number.isNaN(listingFee) &&
    listingFee >= 0 &&
    listingFee <= 100
  ) {
    return listingFee;
  }
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
 * Load listing snapshot and resolve fee (use for jobs/payments when you have listing_id).
 * `supabase` is untyped so `@supabase/ssr`, anon, and service clients all fit.
 */
export async function fetchPlatformFeePercentForListing(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  listingId: string | number | null | undefined,
  settings: GlobalFeeSettings
): Promise<number> {
  if (listingId == null || listingId === "") {
    return resolvePlatformFeePercent(undefined, settings);
  }
  const { data: listing } = await supabase
    .from("listings")
    .select("platform_fee_percentage")
    .eq("id", String(listingId))
    .maybeSingle();
  const v = (listing as { platform_fee_percentage?: number | null } | null)
    ?.platform_fee_percentage;
  return resolvePlatformFeePercent(v, settings);
}
