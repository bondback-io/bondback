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
};
