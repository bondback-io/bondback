export type FindJobsMapPoint = {
  id: string;
  title: string;
  /** Kept for backwards compat / map badge; same as current bid display. */
  priceLabel: string;
  lat: number;
  lon: number;
  locationLabel: string;
  currentBidLabel: string;
  buyNowLabel: string | null;
  bidCount: number;
};
