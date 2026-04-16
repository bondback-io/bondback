/**
 * Global admin toggles for cleaner new-listing flows (#1 in preferred radius, #2 buffer / browse).
 * Columns may be absent until `supabase/sql/20260417100000_global_settings_new_listing_channel_toggles.sql` is applied.
 */

export type NewListingChannelFlags = Readonly<{
  email: boolean;
  inApp: boolean;
  sms: boolean;
  push: boolean;
}>;

type Gs = Record<string, unknown> | null | undefined;

function readBool(v: unknown, fallback: boolean): boolean {
  if (typeof v === "boolean") return v;
  return fallback;
}

export function parseAdditionalNotificationBufferKm(gs: Gs): number {
  const raw = gs?.additional_notification_radius_buffer_km;
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return Math.max(0, Math.min(500, Math.round(raw)));
  }
  return 50;
}

/** Notification #1 — listing within cleaner preferred max_travel_km. */
export function newListingInRadiusChannels(gs: Gs): NewListingChannelFlags {
  const legacySmsPush = gs?.enable_sms_alerts_new_jobs !== false;
  return {
    email: readBool(gs?.new_listing_in_radius_email, true),
    inApp: readBool(gs?.new_listing_in_radius_in_app, true),
    sms: typeof gs?.new_listing_in_radius_sms === "boolean" ? (gs.new_listing_in_radius_sms as boolean) : legacySmsPush,
    push: typeof gs?.new_listing_in_radius_push === "boolean" ? (gs.new_listing_in_radius_push as boolean) : legacySmsPush,
  };
}

/** Notification #2 — “just outside” / browse jobs at preferred + buffer (km). */
export function newListingOutsideChannels(gs: Gs): NewListingChannelFlags {
  const legacySmsPush = gs?.enable_sms_alerts_new_jobs !== false;
  return {
    email: readBool(gs?.new_listing_outside_email, true),
    inApp: readBool(gs?.new_listing_outside_in_app, true),
    sms: typeof gs?.new_listing_outside_sms === "boolean" ? (gs.new_listing_outside_sms as boolean) : legacySmsPush,
    push: typeof gs?.new_listing_outside_push === "boolean" ? (gs.new_listing_outside_push as boolean) : legacySmsPush,
  };
}

export function anyNewListingChannel(c: NewListingChannelFlags): boolean {
  return c.email || c.inApp || c.sms || c.push;
}
