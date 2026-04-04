"use server";

import { render } from "@react-email/render";
import React from "react";
import { createSupabaseAdminClient, getEmailForUserId } from "@/lib/supabase/admin";
import { getGlobalSettings } from "@/lib/actions/global-settings";
import { getNotificationPrefs } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/notifications/email";
import {
  DailyDigestEmail,
  estimatedPayFromListingCents,
  type DailyDigestEmailProps,
} from "@/emails/DailyDigestEmail";
import { haversineDistanceKm, postcodeDistanceKm } from "@/lib/geo/haversine";
import { getSuburbLatLon } from "@/lib/geo/suburb-lat-lon";
import { shouldSendEmailForType } from "@/lib/notification-preferences";
import type { Database } from "@/types/supabase";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { emailPublicOrigin } from "@/emails/email-public-url";

const safeTrim = (v: unknown) => String(v ?? "").trim();

type ListingDigestRow = {
  id: string;
  title: string;
  suburb: string;
  postcode: string | number | null;
  reserve_cents: number | null;
  buy_now_cents: number | null;
  current_lowest_bid_cents: number | null;
  created_at: string;
};

async function listingInRangeForCleaner(
  listing: ListingDigestRow,
  cleanerPostcode: string,
  cleanerSuburb: string,
  maxTravelKm: number,
  admin: NonNullable<ReturnType<typeof createSupabaseAdminClient>>
): Promise<boolean> {
  const listingPostcode = safeTrim(listing.postcode);
  const listingLatLon = listingPostcode
    ? await getSuburbLatLon(admin, listingPostcode, safeTrim(listing.suburb))
    : null;

  if (!listingLatLon) {
    const d = postcodeDistanceKm(listingPostcode, cleanerPostcode);
    return d <= maxTravelKm;
  }
  const cleanerLatLon = await getSuburbLatLon(admin, cleanerPostcode, cleanerSuburb);
  if (cleanerLatLon) {
    const d = haversineDistanceKm(
      listingLatLon.lat,
      listingLatLon.lon,
      cleanerLatLon.lat,
      cleanerLatLon.lon
    );
    return d <= maxTravelKm;
  }
  const d = postcodeDistanceKm(listingPostcode, cleanerPostcode);
  return d <= maxTravelKm;
}

async function filterListingsForCleaner(
  admin: NonNullable<ReturnType<typeof createSupabaseAdminClient>>,
  listings: ListingDigestRow[],
  cleanerPostcode: string,
  cleanerSuburb: string,
  maxTravelKm: number
): Promise<ListingDigestRow[]> {
  const out: ListingDigestRow[] = [];
  for (const L of listings) {
    const ok = await listingInRangeForCleaner(L, cleanerPostcode, cleanerSuburb, maxTravelKm, admin);
    if (ok) out.push(L);
  }
  return out.sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
}

function digestHasActivity(props: DailyDigestEmailProps): boolean {
  const c = props.cleaner;
  const l = props.lister;
  if (c && (c.newJobsInAreaCount > 0 || c.topListings.length > 0)) return true;
  if (
    l &&
    (l.newBidsCount > 0 || l.pendingApprovalsCount > 0 || l.activeJobsCount > 0)
  )
    return true;
  return false;
}

async function buildDigestPropsForUser(
  userId: string,
  sinceIso: string,
  admin: NonNullable<ReturnType<typeof createSupabaseAdminClient>>
): Promise<DailyDigestEmailProps | null> {
  const { data: profile } = await admin
    .from("profiles")
    .select("roles, suburb, postcode, max_travel_km, full_name, display_name")
    .eq("id", userId)
    .maybeSingle();

  const pr = profile as {
    roles?: string[] | null;
    suburb?: string | null;
    postcode?: string | null;
    max_travel_km?: number | null;
    full_name?: string | null;
    display_name?: string | null;
  } | null;

  const roles = Array.isArray(pr?.roles) ? pr.roles : [];
  const isCleaner = roles.includes("cleaner");
  const isLister = roles.includes("lister");

  const appUrl = emailPublicOrigin();
  const dashboardUrl = `${appUrl}/dashboard`;

  let cleaner: DailyDigestEmailProps["cleaner"];
  let lister: DailyDigestEmailProps["lister"];

  if (isCleaner) {
    const { data: listingRows } = await admin
      .from("listings")
      .select(
        "id, title, suburb, postcode, reserve_cents, buy_now_cents, current_lowest_bid_cents, created_at"
      )
      .eq("status", "live")
      .gte("created_at", sinceIso);

    const raw = (listingRows ?? []) as ListingDigestRow[];
    const maxKm =
      typeof pr?.max_travel_km === "number" && pr.max_travel_km > 0
        ? pr.max_travel_km
        : 50;
    const cleanerPc = safeTrim(pr?.postcode);
    const cleanerSub = safeTrim(pr?.suburb);
    const inArea = cleanerPc
      ? await filterListingsForCleaner(admin, raw, cleanerPc, cleanerSub, maxKm)
      : [];

    const top = inArea.slice(0, 3).map((row) => ({
      id: row.id,
      title: (row.title ?? "").trim() || "Bond clean",
      suburb: safeTrim(row.suburb) || "—",
      estimatedPay: estimatedPayFromListingCents({
        reserve_cents: row.reserve_cents ?? 0,
        buy_now_cents: row.buy_now_cents,
        current_lowest_bid_cents: row.current_lowest_bid_cents,
      }),
    }));

    cleaner = {
      newJobsInAreaCount: inArea.length,
      topListings: top,
    };
  }

  if (isLister) {
    const { data: listingIds } = await admin
      .from("listings")
      .select("id")
      .eq("lister_id", userId);

    const ids = (listingIds ?? []).map((r: { id: string }) => r.id);
    let newBidsCount = 0;
    if (ids.length > 0) {
      const { count } = await admin
        .from("bids")
        .select("id", { count: "exact", head: true })
        .in("listing_id", ids as never)
        .gte("created_at", sinceIso);
      newBidsCount = count ?? 0;
    }

    const { count: pendingApprovalsCount } = await admin
      .from("jobs")
      .select("id", { count: "exact", head: true })
      .eq("lister_id", userId)
      .eq("status", "completed_pending_approval");

    const { count: activeJobsCount } = await admin
      .from("jobs")
      .select("id", { count: "exact", head: true })
      .eq("lister_id", userId)
      .in("status", ["accepted", "in_progress"] as never);

    lister = {
      newBidsCount: newBidsCount ?? 0,
      pendingApprovalsCount: pendingApprovalsCount ?? 0,
      activeJobsCount: activeJobsCount ?? 0,
    };
  }

  const firstName =
    (pr?.display_name ?? "").trim() ||
    (pr?.full_name ?? "").trim().split(/\s+/)[0] ||
    null;

  const props: DailyDigestEmailProps = {
    firstName,
    cleaner: cleaner ?? undefined,
    lister: lister ?? undefined,
    dashboardUrl,
    periodLabel: "the last 24 hours",
  };

  if (!digestHasActivity(props)) return null;
  return props;
}

function isDailyDigestGloballyEnabled(settings: Awaited<ReturnType<typeof getGlobalSettings>>): boolean {
  const s = settings as { daily_digest_enabled?: boolean } | null;
  return s?.daily_digest_enabled !== false;
}

/**
 * Sends daily digest emails to all eligible users. Intended for cron (e.g. 8 AM AEST).
 */
export async function runDailyDigestJob(): Promise<{
  sent: number;
  skipped: number;
  errors: string[];
}> {
  const admin = createSupabaseAdminClient();
  const settings = await getGlobalSettings();
  const errors: string[] = [];
  if (!admin) {
    return { sent: 0, skipped: 0, errors: ["SUPABASE_SERVICE_ROLE_KEY not configured"] };
  }
  if (settings?.emails_enabled === false) {
    return { sent: 0, skipped: 0, errors: ["Global emails disabled"] };
  }
  if (!isDailyDigestGloballyEnabled(settings)) {
    return { sent: 0, skipped: 0, errors: ["Daily digest disabled in global settings"] };
  }

  const sinceIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  let sent = 0;
  let skipped = 0;

  const { data: profiles, error: profErr } = await admin
    .from("profiles")
    .select("id, notification_preferences");

  if (profErr) {
    return { sent: 0, skipped: 0, errors: [profErr.message] };
  }

  for (const row of profiles ?? []) {
    const userId = (row as { id: string }).id;
    const np = (row as { notification_preferences?: Record<string, boolean> | null })
      .notification_preferences;
    const digestOn =
      typeof np?.daily_digest === "boolean" ? np.daily_digest : true;
    if (!digestOn) {
      skipped++;
      continue;
    }

    const email = await getEmailForUserId(userId);
    if (!email?.trim()) {
      skipped++;
      continue;
    }

    const prefs = await getNotificationPrefs(userId);
    if (!prefs.shouldSendEmail("daily_digest")) {
      skipped++;
      continue;
    }

    try {
      const digestProps = await buildDigestPropsForUser(userId, sinceIso, admin);
      if (!digestProps) {
        skipped++;
        continue;
      }

      const element = React.createElement(DailyDigestEmail, digestProps);
      const html = await render(element);
      const subject = `Your Bond Back snapshot — ${new Date().toLocaleDateString("en-AU", {
        weekday: "short",
        day: "numeric",
        month: "short",
      })}`;

      const result = await sendEmail(email, subject, html, {
        log: { userId, kind: "daily_digest" },
      });

      if (result.ok && !result.skipped) {
        console.info("[daily-digest]", { outcome: "sent", userId });
      } else if (result.skipped) {
        skipped++;
        continue;
      } else {
        errors.push(`${userId}: ${result.error ?? "send failed"}`);
        continue;
      }

      const summaryParts: string[] = [];
      if (digestProps.cleaner) {
        summaryParts.push(`${digestProps.cleaner.newJobsInAreaCount} new jobs nearby`);
      }
      if (digestProps.lister) {
        summaryParts.push(
          `${digestProps.lister.newBidsCount} bids · ${digestProps.lister.pendingApprovalsCount} pending · ${digestProps.lister.activeJobsCount} active`
        );
      }
      const bodyText = `Daily digest: ${summaryParts.join("; ")}`;

      const ins: Database["public"]["Tables"]["notifications"]["Insert"] = {
        user_id: userId,
        type: "daily_digest",
        job_id: null,
        message_text: bodyText,
        title: "Daily digest",
        body: bodyText,
        data: { type: "daily_digest", period_start: sinceIso },
      };
      const { error: insErr } = await admin.from("notifications").insert(ins as never);
      if (insErr) {
        console.warn("[daily-digest] notification insert failed", insErr.message);
      }
      sent++;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      errors.push(`${userId}: ${msg}`);
    }
  }

  return { sent, skipped, errors };
}

/**
 * Admin test: sends a sample digest to the current admin’s email (ignores activity check).
 */
export async function sendTestDailyDigestEmail(): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return { ok: false, error: "Not authenticated" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin, full_name, display_name")
    .eq("id", session.user.id)
    .maybeSingle();
  if (!(profile as { is_admin?: boolean } | null)?.is_admin) {
    return { ok: false, error: "Not authorised" };
  }

  const settings = await getGlobalSettings();
  if (settings?.emails_enabled === false) {
    return { ok: false, error: "Global emails are disabled." };
  }
  if (!isDailyDigestGloballyEnabled(settings)) {
    return { ok: false, error: "Daily digest is disabled in global settings." };
  }

  const email = await getEmailForUserId(session.user.id);
  if (!email) return { ok: false, error: "No email on account." };

  const appUrl = emailPublicOrigin();
  const fn =
    (profile as { display_name?: string | null; full_name?: string | null } | null)?.display_name?.trim() ||
    (profile as { full_name?: string | null } | null)?.full_name?.trim() ||
    null;

  const digestProps: DailyDigestEmailProps = {
    firstName: fn,
    cleaner: {
      newJobsInAreaCount: 5,
      topListings: [
        {
          id: "sample-1",
          title: "2 Bedroom Apartment in South Brisbane",
          suburb: "South Brisbane",
          estimatedPay: "$280–$340",
        },
        {
          id: "sample-2",
          title: "3 Bedroom House Bond Clean",
          suburb: "Fortitude Valley",
          estimatedPay: "$350",
        },
        {
          id: "sample-3",
          title: "Studio + Balcony",
          suburb: "New Farm",
          estimatedPay: "$220–$260",
        },
      ],
    },
    lister: {
      newBidsCount: 3,
      pendingApprovalsCount: 1,
      activeJobsCount: 2,
    },
    dashboardUrl: `${appUrl}/dashboard`,
    periodLabel: "the last 24 hours (sample)",
  };

  const element = React.createElement(DailyDigestEmail, digestProps);
  const html = await render(element);
  const subject = `[Test] Your Bond Back snapshot — ${new Date().toLocaleDateString("en-AU")}`;

  const result = await sendEmail(email, subject, html, {
    log: { userId: session.user.id, kind: "daily_digest_test" },
  });

  if (!result.ok) return { ok: false, error: result.error ?? "Send failed" };
  if (result.skipped) return { ok: false, error: "Email skipped (check global settings)." };

  return { ok: true };
}
