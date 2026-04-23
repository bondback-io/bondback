"use server";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getGlobalSettings } from "@/lib/actions/global-settings";
import { createNotification } from "@/lib/actions/notifications";
import { hasRecentNewJobInAreaNotification, hasRecentDailyBrowseJobsNudge } from "@/lib/notifications/notification-dedupe";
import {
  anyNewListingChannel,
  newListingInRadiusChannels,
  newListingOutsideChannels,
  parseAdditionalNotificationBufferKm,
} from "@/lib/notifications/new-listing-channel-settings";
import { haversineDistanceKm, postcodeDistanceKm } from "@/lib/geo/haversine";
import { getSuburbLatLon } from "@/lib/geo/suburb-lat-lon";
import { normalizeProfileRoles } from "@/lib/profile-roles";
import { isJobCancelledStatus } from "@/lib/jobs/job-status-helpers";

const safeTrim = (v: unknown) => String(v ?? "").trim();
const DEFAULT_NEW_LISTING_REMINDER_INTERVAL_HOURS = 6;

/**
 * When a new listing is published (status = 'live'), find cleaners within max_travel_km
 * (haversine via suburb/postcode lookup, else postcode distance) and optionally send:
 * - Notification #1: within preferred radius — per-channel (email, in-app, SMS, push) from global settings
 * - Notification #2: in buffer ring only — same per-channel toggles for the "outside" bucket
 *
 * Rate limits: max SMS / push per cleaner per day (UTC), configurable in global_settings.
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
    reminderMode: false,
  });
}

type NotifyNearbyCleanerOptions = {
  dedupeHours: number;
  reminderMode: boolean;
  force?: boolean;
};

async function notifyNearbyCleanersForListing(
  listingId: string,
  options: NotifyNearbyCleanerOptions
): Promise<{ ok: boolean; sent: number; error?: string }> {
  const admin = createSupabaseAdminClient();
  if (!admin) {
    return {
      ok: false,
      sent: 0,
      error:
        "SUPABASE_SERVICE_ROLE_KEY is not set on the server. Cleaner alerts need the service role to save notifications and load recipient emails.",
    };
  }

  const settings = await getGlobalSettings();
  const gs = settings as Record<string, unknown> | null;
  const chIn = newListingInRadiusChannels(gs);
  const chOut = newListingOutsideChannels(gs);
  const bufferKm = parseAdditionalNotificationBufferKm(gs);

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

  /** No-bid reminders must never go to cleaners who already have an active bid on this listing. */
  let cleanerIdsWithActiveBidOnListing: Set<string> | null = null;
  if (options.reminderMode) {
    const { data: bidRows, error: bidErr } = await admin
      .from("bids")
      .select("cleaner_id")
      .eq("listing_id", listingId)
      .eq("status", "active");
    if (bidErr) {
      return { ok: false, sent: 0, error: bidErr.message };
    }
    cleanerIdsWithActiveBidOnListing = new Set<string>();
    for (const br of bidRows ?? []) {
      const cid = safeTrim((br as { cleaner_id?: string }).cleaner_id);
      if (cid) cleanerIdsWithActiveBidOnListing.add(cid);
    }
  }

  const { data: profiles } = await admin
    .from("profiles")
    .select("id, suburb, postcode, roles, max_travel_km, notification_preferences");

  const cleaners = (profiles ?? []).filter((p: { roles?: unknown }) => {
    return normalizeProfileRoles(p.roles).includes("cleaner");
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
    if (cleanerIdsWithActiveBidOnListing?.has(cleanerId)) continue;
    const insidePreferred = distanceKm <= maxTravelKm;
    const insideBuffer = !insidePreferred && distanceKm <= maxTravelKm + bufferKm;
    if (!insidePreferred && !insideBuffer) continue;

    const channels = insidePreferred ? chIn : chOut;
    if (!anyNewListingChannel(channels)) continue;

    const shouldSkipForDedupe =
      !options.force &&
      (await hasRecentNewJobInAreaNotification(
        cleanerId,
        listingId,
        Math.max(1, options.dedupeHours)
      ));
    if (shouldSkipForDedupe) continue;

    const bedCount =
      typeof row.bedrooms === "number" && row.bedrooms > 0 ? row.bedrooms : 1;
    const listingTitle = (row.title ?? "").trim() || "Bond clean";
    const loc = listingPostcode
      ? `${safeTrim(row.suburb)} (${listingPostcode})`
      : safeTrim(row.suburb);
    const browseKm = Math.max(1, Math.min(800, Math.round(maxTravelKm + bufferKm)));

    if (insidePreferred) {
      const ok = await createNotification(
        cleanerId,
        "new_job_in_area",
        null,
        options.reminderMode
          ? `Reminder: ${listingTitle.slice(0, 80)} in ${loc} is still live with no bids yet.`
          : `New job in ${loc}: ${listingTitle.slice(0, 80)}. Open to review and bid.`,
        {
          listingUuid: listingId,
          listingTitle,
          suburb: safeTrim(row.suburb),
          postcode: listingPostcode,
          minPriceCents: minCents,
          maxPriceCents: maxCents,
          bedroomCount: bedCount,
          channelDelivery: {
            email: channels.email,
            inApp: channels.inApp,
            sms: channels.sms,
            push: channels.push,
          },
          persistTitle: options.reminderMode ? "Reminder: no-bid job near you" : "New job near you",
        }
      );
      if (ok) sent += 1;
    } else {
      const outsideMsg = options.reminderMode
        ? "Reminder: bond cleans just outside your preferred area still need bids — browse jobs to see listings in your area and nearby."
        : "Bond cleans just outside your preferred area — browse live listings on Bond Back to see work in your area and nearby.";
      const ok = await createNotification(cleanerId, "new_job_in_area", null, outsideMsg, {
        listingTitle,
        suburb: safeTrim(row.suburb),
        postcode: listingPostcode,
        minPriceCents: minCents,
        maxPriceCents: maxCents,
        browseJobsRadiusKm: browseKm,
        dedupeListingId: listingId,
        nudgeKind: options.reminderMode ? "outside_preferred_reminder" : "outside_preferred",
        channelDelivery: {
          email: channels.email,
          inApp: channels.inApp,
          sms: channels.sms,
          push: channels.push,
        },
        persistTitle: options.reminderMode
          ? "Reminder: jobs outside your area"
          : "Jobs just outside your area",
      });
      if (ok) sent += 1;
    }
  }

  return { ok: true, sent };
}

/**
 * Daily nudge: all qualifying cleaners/dual-role users — browse live jobs at preferred + buffer (km).
 * Uses the same per-channel toggles as notification #2 (outside ring).
 */
export async function sendDailyBrowseJobsNudge(options?: {
  force?: boolean;
}): Promise<{ ok: boolean; sent: number; error?: string }> {
  const admin = createSupabaseAdminClient();
  if (!admin) {
    return {
      ok: false,
      sent: 0,
      error:
        "SUPABASE_SERVICE_ROLE_KEY is not set. Daily browse nudge cannot insert notifications or send emails.",
    };
  }

  const settings = await getGlobalSettings();
  const gs = settings as Record<string, unknown> | null;
  if (gs?.enable_daily_browse_jobs_nudge === false && options?.force !== true) {
    return { ok: true, sent: 0 };
  }

  const chOut = newListingOutsideChannels(gs);
  if (!anyNewListingChannel(chOut)) return { ok: true, sent: 0 };

  const bufferKm = parseAdditionalNotificationBufferKm(gs);
  const nowIso = new Date().toISOString();

  const { data: anyLive, error: liveError } = await admin
    .from("listings")
    .select("id")
    .eq("status", "live")
    .gt("end_time", nowIso)
    .limit(1);

  if (liveError) {
    return { ok: false, sent: 0, error: liveError.message };
  }
  if (!anyLive?.length) {
    return { ok: true, sent: 0 };
  }

  const { data: profiles } = await admin
    .from("profiles")
    .select("id, roles, max_travel_km, notification_preferences");

  const cleaners = (profiles ?? []).filter((p: { roles?: unknown }) => {
    return normalizeProfileRoles(p.roles).includes("cleaner");
  });

  let sent = 0;
  const dedupeHours = 22;

  for (const p of cleaners) {
    const cleanerId = (p as { id: string }).id;
    const notifPrefs = (p as { notification_preferences?: Record<string, boolean> | null })
      .notification_preferences;
    if (notifPrefs?.new_job_in_area === false) continue;

    if (
      !options?.force &&
      (await hasRecentDailyBrowseJobsNudge(cleanerId, dedupeHours))
    ) {
      continue;
    }

    const maxTravelKm =
      typeof (p as { max_travel_km?: number }).max_travel_km === "number"
        ? (p as { max_travel_km: number }).max_travel_km
        : 50;
    const browseKm = Math.max(1, Math.min(800, Math.round(maxTravelKm + bufferKm)));

    const created = await createNotification(
      cleanerId,
      "new_job_in_area",
      null,
      "Live bond cleans are on the board — open Browse jobs to see work in your area and nearby.",
      {
        channelDelivery: {
          email: chOut.email,
          inApp: chOut.inApp,
          sms: chOut.sms,
          push: chOut.push,
        },
        browseJobsRadiusKm: browseKm,
        nudgeKind: "daily_browse_jobs",
        persistTitle: "Browse live bond cleans",
      }
    );
    if (created) sent += 1;
  }

  return { ok: true, sent };
}

/**
 * Find live listings with zero bids and no assigned cleaner, then remind nearby cleaners.
 * Uses the same per-channel toggles as live publish (notification 1 + 2 in `notifyNearbyCleanersForListing`).
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
  const listingIdsWithBids = new Set<string>();
  const BIDS_PAGE = 1000;
  for (let offset = 0; ; offset += BIDS_PAGE) {
    const { data: bidPage, error: bidPageErr } = await admin
      .from("bids")
      .select("listing_id")
      .in("listing_id", listingIds)
      .eq("status", "active")
      .range(offset, offset + BIDS_PAGE - 1);
    if (bidPageErr) {
      return {
        ok: false,
        listingsConsidered: liveListings.length,
        listingsMatched: 0,
        notificationsSent: 0,
        error: bidPageErr.message,
      };
    }
    const rows = (bidPage ?? []) as { listing_id: string | null }[];
    for (const b of rows) {
      const id = safeTrim(b.listing_id);
      if (id.length > 0) listingIdsWithBids.add(id);
    }
    if (rows.length < BIDS_PAGE) break;
  }

  const jobsRes = await admin
    .from("jobs")
    .select("listing_id, winner_id, status")
    .in("listing_id", listingIds);

  if (jobsRes.error) {
    return {
      ok: false,
      listingsConsidered: liveListings.length,
      listingsMatched: 0,
      notificationsSent: 0,
      error: jobsRes.error.message,
    };
  }

  const listingIdsWithAssignedCleaner = new Set(
    ((jobsRes.data ?? []) as { listing_id: string | null; winner_id: string | null; status: string | null }[])
      .filter((j) => safeTrim(j.winner_id).length > 0 && !isJobCancelledStatus(j.status))
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

/**
 * Re-run “new listing published” radius + buffer alerts for **every** currently live listing.
 * Uses the same paths as `notifyNearbyCleanersOfNewListing` (`reminderMode: false`).
 * `force` bypasses per-listing dedupe so admins can re-notify after fixing config.
 */
export async function notifyAllLiveListingsNearbyCleaners(options: {
  force: boolean;
}): Promise<{ ok: boolean; sent: number; listingsProcessed: number; error?: string }> {
  const admin = createSupabaseAdminClient();
  if (!admin) {
    return {
      ok: false,
      sent: 0,
      listingsProcessed: 0,
      error:
        "SUPABASE_SERVICE_ROLE_KEY is not set. Cannot fan out listing alerts without the service role.",
    };
  }
  const nowIso = new Date().toISOString();
  const { data: listings, error } = await admin
    .from("listings")
    .select("id")
    .eq("status", "live")
    .gt("end_time", nowIso);
  if (error) {
    return { ok: false, sent: 0, listingsProcessed: 0, error: error.message };
  }
  const rows = (listings ?? []) as { id: string }[];
  let sent = 0;
  for (const { id } of rows) {
    const r = await notifyNearbyCleanersForListing(id, {
      dedupeHours: 48,
      reminderMode: false,
      force: options.force,
    });
    if (!r.ok) {
      return {
        ok: false,
        sent,
        listingsProcessed: rows.length,
        error: r.error,
      };
    }
    sent += r.sent;
  }
  return { ok: true, sent, listingsProcessed: rows.length };
}

/** Admin-triggered manual run from Global Settings: full live-listing fan-out + daily browse nudge. */
export async function sendNoBidListingRemindersManual(): Promise<{
  ok: boolean;
  listingsConsidered: number;
  listingsMatched: number;
  notificationsSent: number;
  browseJobsNudgeSent: number;
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
      browseJobsNudgeSent: 0,
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
      browseJobsNudgeSent: 0,
      error: "Admin only.",
    };
  }

  const fan = await notifyAllLiveListingsNearbyCleaners({ force: true });
  if (!fan.ok) {
    return {
      ok: false,
      listingsConsidered: fan.listingsProcessed,
      listingsMatched: fan.listingsProcessed,
      notificationsSent: fan.sent,
      browseJobsNudgeSent: 0,
      error: fan.error,
    };
  }
  const nudge = await sendDailyBrowseJobsNudge({ force: true });
  return {
    ok: Boolean(nudge.ok),
    listingsConsidered: fan.listingsProcessed,
    listingsMatched: fan.listingsProcessed,
    notificationsSent: fan.sent,
    browseJobsNudgeSent: nudge.ok ? nudge.sent : 0,
    error: nudge.error,
  };
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
