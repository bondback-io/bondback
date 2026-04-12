/**
 * Single entry point for **listing vs job** detail URLs on cards and dashboard rows.
 *
 * Use {@link detailUrlForCardItem} (and {@link hrefListingOrJob} when you have listing + job).
 * Do **not** branch on `item.status === 'in_progress'` alone or ` /jobs/${item.id}` for mixed
 * listing/job shapes — listing `id` is a UUID; job `id` is numeric with `listing_id` set.
 */

export {
  detailUrlForCardItem,
  hrefListingOrJob,
  hrefListingOnly,
  hrefJobOnly,
  isJobAssigned,
  isListingLiveAuction,
  type MarketplaceDetailItem,
  type ListingLinkInput,
  type JobLinkInput,
} from "./listing-or-job-href";
