/**
 * Centralized tags for `revalidateTag` + `unstable_cache`.
 * Pair with `revalidatePath` on mutations so list/dashboard/job views stay fresh.
 */

export const CACHE_TAGS = {
  /** `global_settings` row (fees, flags) — invalidate when admin saves settings */
  globalSettings: "global-settings",
  /** Listing ids that already have a job — affects /jobs browse + cleaner live bids */
  takenListingIds: "taken-listing-ids",
  /** Broad hint for job listing browse surfaces */
  jobsBrowse: "jobs-browse",
  /** Reference suburb rows (SEO slug resolve) — rare changes */
  suburbs: "suburbs-reference",
} as const;
