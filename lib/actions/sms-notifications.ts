"use server";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getGlobalSettings } from "@/lib/actions/global-settings";
import { sendNewJobAlert } from "@/lib/notifications/sms";
import { sendNewJobPushAlert } from "@/lib/notifications/push";
import { createNotification } from "@/lib/actions/notifications";
import { hasRecentNewJobInAreaNotification } from "@/lib/notifications/notification-dedupe";
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
  const bufferKmRaw = (settings as { additional_notification_radius_buffer_km?: number | null } | null)
    ?.additional_notification_radius_buffer_km;
  const bufferKm =
    typeof bufferKmRaw === "number" && Number.isFinite(bufferKmRaw)
      ? Math.max(0, Math.min(500, Math.round(bufferKmRaw)))
      : 50;

  const { data: listing, error: listError } = await admin
    .from("listings")
    .select(
      "id, title, suburb, postcode, bedrooms, reserve_cents, buy_now_cents, current_lowest_bid_cents, status"
    )
    .eq("id", listingId)
    .maybeSingle();

  if (listError || !listing) {
    return { ok: false, sent: 0, error: "Listing not found." };
  }

  const row = listing as {
    title?: string | null;
    suburb?: string | null;
    postcode?: string | number | null;
    bedrooms?: number | null;
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
    .select("id, suburb, postcode, roles, max_travel_km, notification_preferences");

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

    const cleanerId = (p as { id: string }).id;
    const notifPrefs = (p as { notification_preferences?: Record<string, boolean> | null })
      .notification_preferences;
    const wantsNewListingAlerts = notifPrefs?.new_job_in_area !== false;
    if (!wantsNewListingAlerts) continue;
    const insidePreferred = distanceKm <= maxTravelKm;
    const insideBuffer = !insidePreferred && distanceKm <= maxTravelKm + bufferKm;
    if (!insidePreferred && !insideBuffer) continue;

    const bedCount =
      typeof row.bedrooms === "number" && row.bedrooms > 0 ? row.bedrooms : 1;
    if (insidePreferred) {
      const smsResult = await sendNewJobAlert(
        cleanerId,
        listingId,
        safeTrim(row.suburb),
        listingPostcode,
        minCents,
        maxCents,
        bedCount
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

    const listingTitle = (row.title ?? "").trim() || "Bond clean";
    if (!(await hasRecentNewJobInAreaNotification(cleanerId, listingId, 48))) {
      const loc = listingPostcode
        ? `${safeTrim(row.suburb)} (${listingPostcode})`
        : safeTrim(row.suburb);
      const outsideMsg =
        "We have 1 new bond cleans just outside your preferred area. Would you like to view them?";
      await createNotification(
        cleanerId,
        "new_job_in_area",
        null,
        insidePreferred
          ? `New job in ${loc}: ${listingTitle.slice(0, 80)}. Open to review and bid.`
          : outsideMsg,
        {
          listingUuid: listingId,
          listingTitle,
          suburb: safeTrim(row.suburb),
          postcode: listingPostcode,
          minPriceCents: minCents,
          maxPriceCents: maxCents,
          persistTitle: insidePreferred ? "New job near you" : "Just outside your preferred area",
        }
      );
    }
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

/**
 * Admin only: send a one-off Twilio test to the admin profile phone (no user rate-limit table).
 * Verifies TWILIO_* env and that the number receives SMS on the live site.
 */
export async function sendAdminSmsFromGlobalSettings(): Promise<{
  ok: boolean;
  error?: string;
}> {
  const { createServerSupabaseClient } = await import("@/lib/supabase/server");
  const supabase = await createServerSupabaseClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return { ok: false, error: "You must be logged in." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin, phone")
    .eq("id", session.user.id)
    .maybeSingle();

  const row = profile as { is_admin?: boolean; phone?: string | null } | null;
  if (!row?.is_admin) return { ok: false, error: "Admin only." };
  const phone = (row.phone ?? "").trim();
  if (!phone) return { ok: false, error: "Add a phone number to your profile first." };

  const { sendSms } = await import("@/lib/notifications/sms");
  const result = await sendSms(
    phone,
    "Bond Back admin test — Twilio SMS delivery OK. Reply STOP to opt out if required by your carrier."
  );
  if (!result.ok) return { ok: false, error: result.error ?? "Failed to send SMS." };
  return { ok: true };
}
