"use server";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getGlobalSettings } from "@/lib/actions/global-settings";
import { sendNewJobAlert } from "@/lib/notifications/sms";
import { sendNewJobPushAlert } from "@/lib/notifications/push";
import { haversineDistanceKm, postcodeDistanceKm } from "@/lib/geo/haversine";
import { getSuburbLatLon } from "@/lib/geo/suburb-lat-lon";

const safeTrim = (v: unknown) => String(v ?? "").trim();

/**
 * When a new listing is published (status = 'live'), find cleaners within max_travel_km
 * (haversine via suburb/postcode lookup, else postcode distance) and optionally send:
 * - SMS (Twilio) if they opted in (sms_new_job) and global "new job alerts" is on
 * - Push (Expo) if they opted in (push_new_job) and global is on
 *
 * Rate limits: max 5 SMS and max 5 push per cleaner per day (UTC), configurable in global_settings.
 *
 * @see docs/NEW_JOB_ALERTS.md
 */
export async function sendNewListingSmsToNearbyCleaners(
  listingId: string
): Promise<{ ok: boolean; sent: number; error?: string }> {
  return notifyNearbyCleanersOfNewListing(listingId);
}

/** Alias for clarity (SMS + push). */
export async function notifyNearbyCleanersOfNewListing(
  listingId: string
): Promise<{ ok: boolean; sent: number; error?: string }> {
  const admin = createSupabaseAdminClient();
  if (!admin) return { ok: true, sent: 0 };

  const settings = await getGlobalSettings();
  /** Kill switch for both SMS and push new-job alerts (DB column name: enable_sms_alerts_new_jobs). */
  const alertsEnabled = (settings as { enable_sms_alerts_new_jobs?: boolean } | null)
    ?.enable_sms_alerts_new_jobs;
  if (alertsEnabled === false) return { ok: true, sent: 0 };

  const { data: listing, error: listError } = await admin
    .from("listings")
    .select(
      "id, suburb, postcode, reserve_cents, buy_now_cents, current_lowest_bid_cents, status"
    )
    .eq("id", listingId)
    .maybeSingle();

  if (listError || !listing) {
    return { ok: false, sent: 0, error: "Listing not found." };
  }

  const row = listing as {
    suburb?: string | null;
    postcode?: string | number | null;
    reserve_cents?: number | null;
    buy_now_cents?: number | null;
    current_lowest_bid_cents?: number | null;
    status?: string | null;
  };

  if (String(row.status ?? "").toLowerCase() !== "live") {
    return { ok: true, sent: 0 };
  }

  const listingPostcode = safeTrim(row.postcode);
  const reserve = row.reserve_cents ?? 0;
  const buyNow = row.buy_now_cents;
  const lowest = row.current_lowest_bid_cents ?? reserve;
  const minCents = Math.min(reserve, lowest);
  const maxCents =
    buyNow != null && buyNow > 0 ? Math.max(buyNow, lowest) : Math.max(reserve, lowest);

  const listingLatLon = listingPostcode
    ? await getSuburbLatLon(admin, listingPostcode, safeTrim(row.suburb))
    : null;

  const { data: profiles } = await admin
    .from("profiles")
    .select("id, suburb, postcode, roles, max_travel_km");

  const cleaners = (profiles ?? []).filter((p: { roles?: string[] | null }) => {
    const roles = Array.isArray(p.roles) ? p.roles : [];
    return roles.includes("cleaner");
  });

  let sent = 0;
  for (const p of cleaners) {
    const maxTravelKm =
      typeof (p as { max_travel_km?: number }).max_travel_km === "number"
        ? (p as { max_travel_km: number }).max_travel_km
        : 50;
    const cleanerPostcode = safeTrim((p as { postcode?: string | null }).postcode);

    let distanceKm: number;
    if (listingLatLon) {
      const cleanerLatLon = cleanerPostcode
        ? await getSuburbLatLon(
            admin,
            cleanerPostcode,
            safeTrim((p as { suburb?: string | null }).suburb)
          )
        : null;
      if (cleanerLatLon) {
        distanceKm = haversineDistanceKm(
          listingLatLon.lat,
          listingLatLon.lon,
          cleanerLatLon.lat,
          cleanerLatLon.lon
        );
      } else {
        distanceKm = postcodeDistanceKm(listingPostcode, cleanerPostcode);
      }
    } else {
      distanceKm = postcodeDistanceKm(listingPostcode, cleanerPostcode);
    }

    if (distanceKm > maxTravelKm) continue;

    const cleanerId = (p as { id: string }).id;

    const smsResult = await sendNewJobAlert(
      cleanerId,
      listingId,
      safeTrim(row.suburb),
      listingPostcode,
      minCents,
      maxCents
    );
    if (smsResult.sent) sent++;

    const pushResult = await sendNewJobPushAlert(
      cleanerId,
      listingId,
      safeTrim(row.suburb),
      listingPostcode,
      minCents,
      maxCents
    );
    if (pushResult.sent) sent++;
  }

  return { ok: true, sent };
}

/**
 * Send a test SMS to the current user's profile phone number. Uses rate limit.
 */
export async function sendTestSms(): Promise<{ ok: boolean; error?: string }> {
  const { createServerSupabaseClient } = await import("@/lib/supabase/server");
  const supabase = await createServerSupabaseClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return { ok: false, error: "You must be logged in." };

  const { getNotificationPrefs } = await import("@/lib/supabase/admin");
  const prefs = await getNotificationPrefs(session.user.id);
  if (!prefs.phone) return { ok: false, error: "Add a phone number in your profile first." };

  const { sendSmsToUser } = await import("@/lib/notifications/sms");
  const result = await sendSmsToUser(
    session.user.id,
    prefs.phone,
    "Bond Back test – SMS notifications are working."
  );
  if (!result.ok) return { ok: false, error: result.error ?? "Failed to send SMS." };
  return { ok: true };
}
