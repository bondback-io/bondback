export type ListingPriceFallbackCents = {
  buy_now_cents?: number | null;
  reserve_cents?: number | null;
};

/**
 * Gross job value for admin UI and revenue: canonical agreed amount (buy-now, accepted bid,
 * top-ups) when set; otherwise listing price hints (matches job-detail when bid snapshot is empty),
 * then `current_lowest_bid_cents`.
 */
export function adminJobGrossCents(
  job: { agreed_amount_cents?: number | null },
  listingCurrentLowestBidCents: number | null | undefined,
  listingExtras?: ListingPriceFallbackCents | null
): number {
  const agreed = job.agreed_amount_cents ?? 0;
  if (agreed > 0) return agreed;
  const buy = listingExtras?.buy_now_cents ?? null;
  const reserve = listingExtras?.reserve_cents ?? null;
  if (buy != null && buy > 0) return buy;
  if (reserve != null && reserve > 0) return reserve;
  return listingCurrentLowestBidCents ?? 0;
}
