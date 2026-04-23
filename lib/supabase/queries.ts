/**
 * Centralized PostgREST `select()` column lists for smaller payloads and clearer query plans.
 * Keep in sync with `types/supabase.ts` when columns are added or renamed.
 *
 * Extra DB-only columns (not yet in generated types) are appended where the app relies on them.
 */

/** Browse `/jobs` first page + `getJobsPage` — matches existing UI (20 cards per page). */
export const JOBS_BROWSE_PAGE_SIZE = 20;

/**
 * Find Jobs (`/find-jobs`): fetch enough live rows before suburb-centre + radius filtering so
 * in-range jobs are not missed (geo filter runs after `range` in application code).
 */
export const FIND_JOBS_LISTINGS_CAP = 500;

/** PostgREST `.range(from, to)` bounds for a 1-based page (inclusive). */
export function jobsBrowsePageRange(page: number): { from: number; to: number } {
  const pageSize = JOBS_BROWSE_PAGE_SIZE;
  const p = Math.max(1, Math.floor(page));
  const offset = (p - 1) * pageSize;
  return { from: offset, to: offset + pageSize - 1 };
}

/** Full `public.listings` row — cards, dashboards, job detail. */
export const LISTING_FULL_SELECT =
  "id, lister_id, title, description, property_description, property_address, suburb, postcode, property_type, bedrooms, bathrooms, addons, special_areas, special_instructions, move_out_date, preferred_dates, photo_urls, initial_photos, cover_photo_url, reserve_cents, buy_now_cents, starting_price_cents, current_lowest_bid_cents, duration_days, status, end_time, created_at, platform_fee_percentage, cancelled_early_at, property_condition, property_levels, service_type, recurring_frequency, airbnb_guest_capacity, airbnb_turnaround_hours, deep_clean_purpose, is_urgent";

/** Cleaner “live bids” section — fields used after fetch + `isListingLive`. */
export const LISTING_LIVE_BID_CARD_SELECT =
  "id, title, suburb, postcode, cover_photo_url, initial_photos, photo_urls, current_lowest_bid_cents, end_time, status, cancelled_early_at, service_type, recurring_frequency, is_urgent";

/** `public.jobs` — all columns from generated `Row` type. */
export const JOB_TYPED_SELECT =
  "id, listing_id, lister_id, winner_id, status, title, agreed_amount_cents, secured_via_buy_now, payment_intent_id, escrow_funded_at, lister_escrow_cancelled_at, lister_escrow_cancel_fee_cents, lister_escrow_cancel_refund_cents, lister_escrow_cancel_reason, top_up_payments, lister_payment_due_at, payment_released_at, stripe_transfer_id, cleaner_confirmed_complete, cleaner_confirmed_at, auto_release_at, auto_release_at_original, review_extension_used_at, completed_at, disputed_at, dispute_reason, dispute_photos, dispute_evidence, dispute_status, dispute_opened_by, proposed_refund_amount, counter_proposal_amount, refund_amount, refund_status, dispute_resolution, resolution_type, resolution_at, resolution_by, dispute_cleaner_counter_used, dispute_lister_counter_used, admin_mediation_requested, admin_mediation_requested_at, created_at, updated_at";

/**
 * Last-resort job row for `/jobs/[id]` when the DB is behind `JOB_TYPED_SELECT` (missing dispute /
 * refund / mediation columns). Prefer loading something over 404 for lister + cleaner.
 */
export const JOB_DETAIL_MINIMAL_SELECT =
  "id, listing_id, lister_id, winner_id, status, title, agreed_amount_cents, payment_intent_id, payment_released_at, stripe_transfer_id, cleaner_confirmed_complete, cleaner_confirmed_at, auto_release_at, auto_release_at_original, completed_at, disputed_at, dispute_reason, dispute_status, proposed_refund_amount, counter_proposal_amount, refund_amount, dispute_resolution, created_at, updated_at";

/**
 * Job detail + `/api/jobs/[id]` — typed columns for `jobs`.
 * If your DB has dispute/refund columns not yet in `types/supabase.ts`, regenerate types or
 * append them here (see `docs/DISPUTE_MIGRATION.sql` / `docs/STRIPE_REFUND_MIGRATION.sql`).
 */
export const JOB_DETAIL_PAGE_SELECT = JOB_TYPED_SELECT;

/** `public.bids` row. */
export const BID_FULL_SELECT =
  "id, listing_id, cleaner_id, amount_cents, created_at, status, pending_confirmation_expires_at";

/** Admin jobs table UI. */
export const JOB_ADMIN_TABLE_SELECT =
  "id, listing_id, lister_id, winner_id, status, agreed_amount_cents, created_at, completed_at, auto_release_at, cleaner_confirmed_at, lister_escrow_cancelled_at, lister_escrow_cancel_fee_cents, lister_escrow_cancel_refund_cents, lister_escrow_cancel_reason";

/** Admin listings table UI. */
export const LISTING_ADMIN_TABLE_SELECT =
  "id, lister_id, title, suburb, current_lowest_bid_cents, reserve_cents, status, created_at, end_time";

/** All typed profile columns (matches `profiles.Row`). */
export const PROFILE_TYPED_FULL_SELECT =
  "id, roles, active_role, abn, state, suburb, postcode, max_travel_km, full_name, first_name, last_name, cleaner_username, phone, date_of_birth, years_experience, vehicle_type, profile_photo_url, bio, specialties, portfolio_photo_urls, business_name, insurance_policy_number, availability, equipment_notes, notification_preferences, email_force_disabled, email_preferences_locked, is_admin, is_deleted, is_banned, banned_reason, ban_until, negative_stars, stripe_connect_id, stripe_onboarding_complete, stripe_payment_method_id, stripe_customer_id, expo_push_token, verification_badges, is_email_verified, created_at, updated_at, referred_by, referral_code, account_credit_cents, high_dispute_opens_30d, last_dispute_abuse_alert_at, preferred_payout_schedule, theme_preference, distance_unit";

/** Admin users page — full typed row (regenerate types when adding moderation columns like `is_banned`). */
export const PROFILE_ADMIN_TABLE_SELECT = PROFILE_TYPED_FULL_SELECT;

/** Lister dashboard — `getProfileCompletion` (lister branch) + welcome banner. */
export const PROFILE_LISTER_DASHBOARD_SELECT =
  "id, roles, active_role, full_name, phone, suburb, created_at, stripe_connect_id, stripe_onboarding_complete";

/**
 * Cleaner dashboard — same columns as lister dashboard.
 * Avoids requesting the full profile row so PostgREST does not 400 when optional columns lag migrations.
 * Average rating uses `cleaner_avg_rating` when present in DB; append `, cleaner_avg_rating` here after the column exists.
 */
export const PROFILE_CLEANER_DASHBOARD_SELECT = PROFILE_LISTER_DASHBOARD_SELECT;

/** Activity feed on dashboards — `data` powers listing vs job deep links via `getNotificationHref`. */
export const NOTIFICATION_FEED_SELECT =
  "id, type, message_text, job_id, created_at, data";

/** `public.job_messages` row. */
export const JOB_MESSAGES_FULL_SELECT =
  "id, job_id, sender_id, message_text, created_at, image_url, read_at";
