"use server";

import * as React from "react";
import { render } from "@react-email/render";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getEmailForUserId } from "@/lib/supabase/admin";
import { getGlobalSettings } from "@/lib/actions/global-settings";
import {
  AdminNotificationEmail,
  type AdminNotificationEmailProps,
  type AdminNotificationEventType,
} from "@/emails/AdminNotificationEmail";
import { formatDateTimeForEmail } from "@/lib/email-datetime";

function maskAbn(digits: string): string {
  if (digits.length !== 11) return digits;
  return `${digits.slice(0, 2)} **** **** ${digits.slice(9)}`;
}

function roleDisplayLabel(roles: string[]): string {
  const hasL = roles.includes("lister");
  const hasC = roles.includes("cleaner");
  if (hasL && hasC) return "Lister & Cleaner";
  if (hasC) return "Cleaner";
  if (hasL) return "Lister";
  return "—";
}

function abnDetailForProfile(profile: {
  roles: string[] | null;
  abn: string | null;
  verification_badges: string[] | null;
}): string | undefined {
  const roles = profile.roles ?? [];
  if (!roles.includes("cleaner")) {
    return undefined;
  }
  const digits = String(profile.abn ?? "").replace(/\D/g, "");
  const badges = profile.verification_badges ?? [];
  const verified = badges.includes("abn_verified");
  if (digits.length !== 11) {
    return "Not provided yet (cleaner may add ABN in profile or quick-setup)";
  }
  const v = verified ? "ABN verified (badge)" : "Provided — verification pending";
  return `${maskAbn(digits)} — ${v}`;
}

async function getFirstAdminUserIdForLog(): Promise<string | null> {
  const admin = createSupabaseAdminClient();
  if (!admin) return null;
  const { data } = await admin
    .from("profiles")
    .select("id")
    .eq("is_admin", true)
    .limit(1)
    .maybeSingle();
  return (data as { id?: string } | null)?.id ?? null;
}

/**
 * Resolve the inbox for admin system emails:
 * - `ADMIN_NOTIFICATION_EMAIL` env if set
 * - otherwise first admin profile's auth email
 */
export async function resolveAdminNotificationRecipient(): Promise<{
  email: string;
  logUserId: string | null;
}> {
  const env = process.env.ADMIN_NOTIFICATION_EMAIL?.trim();
  const logUid = await getFirstAdminUserIdForLog();
  if (env) {
    return { email: env, logUserId: logUid };
  }
  if (!logUid) {
    return { email: "", logUserId: null };
  }
  const email = await getEmailForUserId(logUid);
  return { email: email ?? "", logUserId: logUid };
}

async function shouldSendAdminNotification(
  kind: "new_user" | "new_listing" | "dispute"
): Promise<boolean> {
  const settings = await getGlobalSettings();
  if (!settings || settings.emails_enabled === false) {
    return false;
  }
  const s = settings as {
    admin_notify_new_user?: boolean;
    admin_notify_new_listing?: boolean;
    admin_notify_dispute?: boolean;
  };
  if (kind === "new_user") return s.admin_notify_new_user !== false;
  if (kind === "new_listing") return s.admin_notify_new_listing !== false;
  return s.admin_notify_dispute !== false;
}

async function sendAdminHtml(params: {
  to: string;
  subject: string;
  html: string;
  logKind: string;
  logUserId: string | null;
}): Promise<{ ok: boolean; error?: string; skipped?: boolean }> {
  const { sendEmail } = await import("@/lib/notifications/email");
  const log =
    params.logUserId != null
      ? { userId: params.logUserId, kind: params.logKind }
      : undefined;
  return sendEmail(params.to, params.subject, params.html, log ? { log } : undefined);
}

async function renderAdminEmail(props: AdminNotificationEmailProps): Promise<string> {
  const el = React.createElement(AdminNotificationEmail, props);
  return render(el);
}

/** After first role choice or full onboarding — not for unlock second role. */
export async function notifyAdminNewUserRegistration(userId: string): Promise<void> {
  if (!(await shouldSendAdminNotification("new_user"))) return;
  const { email, logUserId } = await resolveAdminNotificationRecipient();
  if (!email) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[admin-notify] new_user: no admin recipient (set ADMIN_NOTIFICATION_EMAIL or ensure an admin exists)");
    }
    return;
  }

  const admin = createSupabaseAdminClient();
  if (!admin) return;

  const { data: profile } = await admin
    .from("profiles")
    .select("full_name, roles, abn, verification_badges, created_at")
    .eq("id", userId)
    .maybeSingle();

  const authEmail = await getEmailForUserId(userId);
  const p = profile as {
    full_name?: string | null;
    roles?: string[] | null;
    abn?: string | null;
    verification_badges?: string[] | null;
    created_at?: string | null;
  } | null;

  const roles = (p?.roles as string[] | null) ?? [];
  const fullName = (p?.full_name ?? "").trim() || "—";
  const roleLabel = roleDisplayLabel(roles);
  const signedUpAt = p?.created_at ? new Date(p.created_at) : new Date();
  const signedUpAtFormatted = formatDateTimeForEmail(signedUpAt, {
    appendTimeZoneName: true,
  });

  const abnLine = p
    ? abnDetailForProfile({
        roles: p.roles ?? null,
        abn: p.abn ?? null,
        verification_badges: (p.verification_badges as string[] | null) ?? null,
      })
    : undefined;

  const props: AdminNotificationEmailProps = {
    eventType: "new_user",
    fullName,
    email: authEmail ?? "—",
    roleLabel,
    signedUpAtFormatted,
    ...(abnLine ? { abnDetailLine: abnLine } : {}),
  };

  const subject = `New User Registration - ${fullName} (${roleLabel})`;
  const html = await renderAdminEmail(props);
  void sendAdminHtml({
    to: email,
    subject,
    html,
    logKind: "admin_notification:new_user",
    logUserId,
  });
}

export async function notifyAdminNewListing(listingId: string): Promise<void> {
  if (!(await shouldSendAdminNotification("new_listing"))) return;
  const { email, logUserId } = await resolveAdminNotificationRecipient();
  if (!email) return;

  const supabase = await createServerSupabaseClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return;

  const admin = createSupabaseAdminClient();
  if (!admin) return;

  const { data: listing } = await admin
    .from("listings")
    .select("id, title, lister_id, suburb, postcode, status, created_at")
    .eq("id", listingId)
    .maybeSingle();

  const row = listing as {
    id: string;
    title: string | null;
    lister_id: string;
    suburb: string | null;
    postcode: string | null;
    status: string | null;
    created_at: string | null;
  } | null;

  if (!row || row.lister_id !== session.user.id) return;

  const listerEmail = await getEmailForUserId(row.lister_id);
  const { data: listerProf } = await admin
    .from("profiles")
    .select("full_name")
    .eq("id", row.lister_id)
    .maybeSingle();
  const listerName =
    ((listerProf as { full_name?: string | null } | null)?.full_name ?? "").trim() || "—";

  const createdAt = row.created_at ? new Date(row.created_at) : new Date();
  const props: AdminNotificationEmailProps = {
    eventType: "new_listing",
    listingTitle: row.title ?? "—",
    listingId: String(row.id),
    listerName,
    listerEmail: listerEmail ?? "—",
    suburb: row.suburb ?? "—",
    postcode: row.postcode ?? "—",
    status: row.status ?? "—",
    createdAtFormatted: formatDateTimeForEmail(createdAt, {
      appendTimeZoneName: true,
    }),
  };

  const subject = `New Listing Created — ${row.title ?? listingId}`;
  const html = await renderAdminEmail(props);
  void sendAdminHtml({
    to: email,
    subject,
    html,
    logKind: "admin_notification:new_listing",
    logUserId,
  });
}

export async function notifyAdminDisputeOpened(jobId: number): Promise<void> {
  if (!(await shouldSendAdminNotification("dispute"))) return;
  const { email, logUserId } = await resolveAdminNotificationRecipient();
  if (!email) return;

  const admin = createSupabaseAdminClient();
  if (!admin) return;

  const { data: job } = await admin
    .from("jobs")
    .select(
      "id, listing_id, dispute_reason, disputed_at, dispute_opened_by"
    )
    .eq("id", jobId)
    .maybeSingle();

  const j = job as {
    id: number;
    listing_id: string | null;
    dispute_reason?: string | null;
    disputed_at?: string | null;
    dispute_opened_by?: string | null;
  } | null;

  if (!j) return;

  let listingTitle: string | null = null;
  if (j.listing_id) {
    const { data: listing } = await admin
      .from("listings")
      .select("title")
      .eq("id", j.listing_id)
      .maybeSingle();
    listingTitle = (listing as { title?: string | null } | null)?.title ?? null;
  }

  const openedByLabel =
    j.dispute_opened_by === "lister"
      ? "Lister"
      : j.dispute_opened_by === "cleaner"
        ? "Cleaner"
        : "—";

  const raw = (j.dispute_reason ?? "").trim();
  const reasonSnippet =
    raw.length > 400 ? `${raw.slice(0, 397)}…` : raw || "—";

  const openedAt = j.disputed_at ? new Date(j.disputed_at) : new Date();
  const props: AdminNotificationEmailProps = {
    eventType: "dispute_opened",
    jobId,
    listingTitle,
    openedByLabel,
    reasonSnippet,
    openedAtFormatted: formatDateTimeForEmail(openedAt, {
      appendTimeZoneName: true,
    }),
  };

  const subject = `Dispute Opened — Job #${jobId}`;
  const html = await renderAdminEmail(props);
  void sendAdminHtml({
    to: email,
    subject,
    html,
    logKind: "admin_notification:dispute_opened",
    logUserId,
  });
}

export type SendTestAdminNotificationResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Admin-only: send a sample admin notification email (for connectivity testing).
 */
export async function sendTestAdminNotificationEmail(
  eventType: AdminNotificationEventType
): Promise<SendTestAdminNotificationResult> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    return { ok: false, error: "Not authenticated" };
  }

  const { data: prof } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", session.user.id)
    .maybeSingle();
  if (!(prof as { is_admin?: boolean } | null)?.is_admin) {
    return { ok: false, error: "Not authorised" };
  }

  const { email, logUserId } = await resolveAdminNotificationRecipient();
  if (!email) {
    return {
      ok: false,
      error:
        "No admin recipient. Set ADMIN_NOTIFICATION_EMAIL or ensure an admin exists with an email.",
    };
  }

  let props: AdminNotificationEmailProps;
  let subject: string;

  if (eventType === "new_user") {
    subject = "New User Registration - Sample User (Lister)";
    props = {
      eventType: "new_user",
      fullName: "Sample User",
      email: "sample.user@example.com",
      roleLabel: "Lister",
      signedUpAtFormatted: formatDateTimeForEmail(new Date(), {
        appendTimeZoneName: true,
      }),
    };
  } else if (eventType === "new_listing") {
    subject = "New Listing Created — Sample 2 Bedroom Listing";
    props = {
      eventType: "new_listing",
      listingTitle: "Sample 2 Bedroom + 1 Bathroom Apartment in Brisbane",
      listingId: "00000000-0000-0000-0000-000000000000",
      listerName: "Sample Lister",
      listerEmail: "lister@example.com",
      suburb: "Brisbane",
      postcode: "4000",
      status: "live",
      createdAtFormatted: formatDateTimeForEmail(new Date(), {
        appendTimeZoneName: true,
      }),
    };
  } else {
    subject = "Dispute Opened — Job #12345";
    props = {
      eventType: "dispute_opened",
      jobId: 12345,
      listingTitle: "Sample listing title",
      openedByLabel: "Lister",
      reasonSnippet:
        "Sample dispute reason: condition of kitchen surfaces did not match expectations. (This is test copy.)",
      openedAtFormatted: formatDateTimeForEmail(new Date(), {
        appendTimeZoneName: true,
      }),
    };
  }

  const html = await renderAdminEmail(props);
  const sent = await sendAdminHtml({
    to: email,
    subject: `[Test] ${subject}`,
    html,
    logKind: `admin_notification:test:${eventType}`,
    logUserId: logUserId ?? session.user.id,
  });

  if (sent.skipped) {
    return {
      ok: false,
      error: "Email skipped (enable all email notifications in Global settings).",
    };
  }
  if (!sent.ok) {
    return { ok: false, error: sent.error ?? "Send failed" };
  }

  return { ok: true };
}
