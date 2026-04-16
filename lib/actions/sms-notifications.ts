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
const DEFAULT_NEW_LISTING_REMINDER_INTERVAL_HOURS = 6;

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
  return notifyNearbyCleanersForListing(listingId, {
    dedupeHours: 48,
    includeSmsPush: true,
    reminderMode: false,
  });
}

type NotifyNearbyCleanerOptions = {
  dedupeHours: number;
  includeSmsPush: boolean;
  reminderMode: boolean;
  force?: boolean;
};

async function notifyNearbyCleanersForListing(
  listingId: string,
  options: NotifyNearbyCleanerOptions
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
      if (options.includeSmsPush) {
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
    }

    const listingTitle = (row.title ?? "").trim() || "Bond clean";
    const shouldSkipForDedupe =
      !options.force &&
      (await hasRecentNewJobInAreaNotification(
        cleanerId,
        listingId,
        Math.max(1, options.dedupeHours)
      ));
    if (!shouldSkipForDedupe) {
      const loc = listingPostcode
        ? `${safeTrim(row.suburb)} (${listingPostcode})`
        : safeTrim(row.suburb);
      const outsideMsg =
        options.reminderMode
          ? "Reminder: we still have bond cleans just outside your preferred area with no bids yet. Would you like to view them?"
          : "We have 1 new bond cleans just outside your preferred area. Would you like to view them?";
      await createNotification(
        cleanerId,
        "new_job_in_area",
        null,
        insidePreferred
          ? options.reminderMode
            ? `Reminder: ${listingTitle.slice(0, 80)} in ${loc} is still live with no bids yet.`
            : `New job in ${loc}: ${listingTitle.slice(0, 80)}. Open to review and bid.`
          : outsideMsg,
        {
          listingUuid: listingId,
          listingTitle,
          suburb: safeTrim(row.suburb),
          postcode: listingPostcode,
          minPriceCents: minCents,
          maxPriceCents: maxCents,
          persistTitle: insidePreferred
            ? options.reminderMode
              ? "Reminder: no-bid job near you"
              : "New job near you"
            : options.reminderMode
              ? "Reminder: outside your preferred area"
              : "Just outside your preferred area",
        }
      );
      sent++;
    }
  }

  return { ok: true, sent };
}

/**
 * Find live listings with zero bids and no assigned cleaner, then remind nearby cleaners.
 * Sends in-app + email notifications only (no SMS/push), with configurable interval.
 */
export async function sendNoBidListingReminderNotifications(
  options?: { force?: boolean }
): Promise<{
  ok: boolean;
  listingsConsidered: number;
  listingsMatched: number;
  notificationsSent: number;
  error?: string;
}> {
  const admin = createSupabaseAdminClient();
  if (!admin) {
    return { ok: true, listingsConsidered: 0, listingsMatched: 0, notificationsSent: 0 };
  }

  const settings = await getGlobalSettings();
  const remindersEnabled =
    (settings as { enable_new_listing_reminders?: boolean | null } | null)
      ?.enable_new_listing_reminders !== false;
  if (!remindersEnabled && options?.force !== true) {
    return { ok: true, listingsConsidered: 0, listingsMatched: 0, notificationsSent: 0 };
  }
  // Hobby-compatible schedule: reminders run daily; dedupe matches that cadence.
  // Manual runs use `force: true` and bypass dedupe.
  const intervalHours = 24;

  const nowIso = new Date().toISOString();
  const { data: listings, error: listingError } = await admin
    .from("listings")
    .select(
      "id, status, end_time, title, suburb, postcode, bedrooms, reserve_cents, buy_now_cents, current_lowest_bid_cents"
    )
    .eq("status", "live")
    .gt("end_time", nowIso);

  if (listingError) {
    return {
      ok: false,
      listingsConsidered: 0,
      listingsMatched: 0,
      notificationsSent: 0,
      error: listingError.message,
    };
  }

  const liveListings = (listings ?? []) as { id: string }[];
  if (liveListings.length === 0) {
    return { ok: true, listingsConsidered: 0, listingsMatched: 0, notificationsSent: 0 };
  }

  const listingIds = liveListings.map((l) => l.id);
  const [bidsRes, jobsRes] = await Promise.all([
    admin.from("bids").select("listing_id").in("listing_id", listingIds),
    admin
      .from("jobs")
      .select("listing_id, winner_id, status")
      .in("listing_id", listingIds),
  ]);

  if (bidsRes.error) {
    return {
      ok: false,
      listingsConsidered: liveListings.length,
      listingsMatched: 0,
      notificationsSent: 0,
      error: bidsRes.error.message,
    };
  }
  if (jobsRes.error) {
    return {
      ok: false,
      listingsConsidered: liveListings.length,
      listingsMatched: 0,
      notificationsSent: 0,
      error: jobsRes.error.message,
    };
  }

  const listingIdsWithBids = new Set(
    ((bidsRes.data ?? []) as { listing_id: string | null }[])
      .map((b) => safeTrim(b.listing_id))
      .filter((v) => v.length > 0)
  );
  const listingIdsWithAssignedCleaner = new Set(
    ((jobsRes.data ?? []) as { listing_id: string | null; winner_id: string | null; status: string | null }[])
      .filter((j) => safeTrim(j.winner_id).length > 0 && safeTrim(j.status).toLowerCase() !== "cancelled")
      .map((j) => safeTrim(j.listing_id))
      .filter((v) => v.length > 0)
  );

  const targetListings = listingIds.filter(
    (id) => !listingIdsWithBids.has(id) && !listingIdsWithAssignedCleaner.has(id)
  );

  let notificationsSent = 0;
  for (const listingId of targetListings) {
    const res = await notifyNearbyCleanersForListing(listingId, {
      dedupeHours: intervalHours,
      includeSmsPush: false,
      reminderMode: true,
      force: options?.force === true,
    });
    if (res.ok) {
      notificationsSent += res.sent;
    }
  }

  return {
    ok: true,
    listingsConsidered: liveListings.length,
    listingsMatched: targetListings.length,
    notificationsSent,
  };
}

/** Admin-triggered manual reminder run from Global Settings. */
export async function sendNoBidListingRemindersManual(): Promise<{
  ok: boolean;
  listingsConsidered: number;
  listingsMatched: number;
  notificationsSent: number;
  error?: string;
}> {
  const { createServerSupabaseClient } = await import("@/lib/supabase/server");
  const supabase = await createServerSupabaseClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    return {
      ok: false,
      listingsConsidered: 0,
      listingsMatched: 0,
      notificationsSent: 0,
      error: "You must be logged in.",
    };
  }
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", session.user.id)
    .maybeSingle();
  if (!(profile as { is_admin?: boolean } | null)?.is_admin) {
    return {
      ok: false,
      listingsConsidered: 0,
      listingsMatched: 0,
      notificationsSent: 0,
      error: "Admin only.",
    };
  }

  return sendNoBidListingReminderNotifications({ force: true });
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
