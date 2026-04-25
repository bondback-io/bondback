import type { ServiceTypeKey } from "@/lib/service-types";

export type FindJobsMapPoint = {
  id: string;
  title: string;
  /** First line of title, truncated for pin hover. */
  titleShort: string;
  /** Kept for backwards compat / map badge; same as current bid display. */
  priceLabel: string;
  lat: number;
  lon: number;
  /** Single-line location from suburb + postcode (legacy / fallback). */
  locationLabel: string;
  suburb: string;
  postcode: string;
  /** Australian state/territory (e.g. QLD), optional. */
  state: string | null;
  /** e.g. "2 beds · 1 bath · house" */
  propertySummary: string;
  currentBidLabel: string;
  buyNowLabel: string | null;
  bidCount: number;
  serviceType: ServiceTypeKey;
  recurringFrequency: string | null;
  isUrgent: boolean;
};
