/**
 * Marketplace layer: browse feed, card routing, bid counts, detail loaders, email deep links.
 * Prefer importing from `@/lib/marketplace` for listing/job behaviour (single public surface).
 */
export { fetchBidCountsByListingIds } from "./bid-counts";
export { bidCountsForListingIds } from "./server-cache";
export * from "./paths";
export * from "./email-links";
export {
  detailUrlForCardItem,
  hrefListingOrJob,
  hrefJobOnly,
  hrefListingOnly,
  isAssignedJob,
  isJobAssigned,
  type JobLinkInput,
  type ListingLinkInput,
  type MarketplaceDetailItem,
} from "@/lib/navigation/listing-or-job-href";
export {
  loadJobByNumericIdForSession,
  loadListingFullForSession,
  loadJobForListingDetailPage,
  type JobDetailSessionOptions,
  type ServerSupabaseClient,
} from "@/lib/jobs/load-job-for-detail-route";
