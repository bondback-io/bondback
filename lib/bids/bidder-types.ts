/**
 * A recent review of this user as a cleaner (from `reviews` where reviewee is the bidder).
 * Only populated when loading via `getBidderProfileForListingBid` for the preview dialog.
 */
export type BidderProfileRecentReview = {
  id: number;
  job_id?: number | null;
  overall_rating: number;
  review_text: string | null;
  created_at: string;
  reviewer_display_name: string | null;
};

/**
 * Public-ish cleaner fields embedded on bid rows for marketplace / job UI.
 * Loaded server-side with service role; do not include email or phone here.
 */
export type BidBidderProfileSummary = {
  id: string;
  cleaner_username: string | null;
  first_name: string | null;
  last_name: string | null;
  full_name: string | null;
  bio: string | null;
  profile_photo_url: string | null;
  years_experience: number | null;
  suburb: string | null;
  state: string | null;
  postcode: string | null;
  verification_badges: string[] | null;
  specialties: string[] | null;
  business_name: string | null;
  /** Denormalized on `profiles` (updated when reviews change). */
  cleaner_avg_rating?: number | null;
  cleaner_total_reviews?: number | null;
  /**
   * Completed jobs count — only set by `getBidderProfileForListingBid` (preview dialog).
   */
  completed_jobs_count?: number | null;
  /**
   * Latest reviews where this profile is the cleaner — only set by `getBidderProfileForListingBid`.
   */
  recent_reviews_as_cleaner?: BidderProfileRecentReview[] | null;
};
