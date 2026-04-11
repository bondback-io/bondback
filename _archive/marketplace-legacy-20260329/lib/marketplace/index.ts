/**
 * Marketplace layer: browse feed, card routing, bid counts, and email deep links.
 * Prefer importing from here for new code so listing/job behaviour stays consistent.
 */
export { fetchBidCountsByListingIds } from "./bid-counts";
export * from "./paths";
export * from "./email-links";
export {
  detailUrlForCardItem,
  hrefListingOrJob,
  hrefJobOnly,
  hrefListingOnly,
  isAssignedJob,
  type JobLinkInput,
  type ListingLinkInput,
  type MarketplaceDetailItem,
} from "@/lib/navigation/listing-or-job-href";
