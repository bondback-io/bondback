/**
 * Gross job value for admin UI and revenue: canonical agreed amount (buy-now, accepted bid,
 * top-ups) when set; otherwise the listing's current-lowest bid snapshot.
 */
export function adminJobGrossCents(
  job: { agreed_amount_cents?: number | null },
  listingCurrentLowestBidCents: number | null | undefined
): number {
  const agreed = job.agreed_amount_cents ?? 0;
  if (agreed > 0) return agreed;
  return listingCurrentLowestBidCents ?? 0;
}
