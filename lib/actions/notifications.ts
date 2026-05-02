"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import {
  createSupabaseAdminClient,
  getNotificationPrefs,
  checkAndRecordEmailRateLimit,
  recipientViewedJobRecently,
} from "@/lib/supabase/admin";
import {
  getNotificationEmailContent,
  sendEmail,
  buildPaymentReceiptEmail,
  type NotificationType as EmailNotificationType,
} from "@/lib/notifications/email";
import { getGlobalSettings, getEmailTemplateOverrides } from "@/lib/actions/global-settings";
import { isTwilioSmsAllowedForType } from "@/lib/notifications/sms";
import { buildNotificationPersistFields } from "@/lib/notifications/notification-display-fields";
import { hasRecentJobNotification } from "@/lib/notifications/notification-dedupe";

/** Compare auth user id to Postgres uuid columns (avoids strict === misses on formatting). */
function authUserIdsMatch(a: unknown, b: unknown): boolean {
  return String(a ?? "").trim().toLowerCase() === String(b ?? "").trim().toLowerCase();
}

type NotificationInsert =
  Database["public"]["Tables"]["notifications"]["Insert"];

export type NotificationType =
  | "job_accepted"
  | "new_message"
  | "job_completed"
  | "payment_released"
  | "funds_ready"
  | "dispute_opened"
  | "dispute_resolved"
  | "job_created"
  | "job_approved_to_start"
  | "new_bid"
  | "job_cancelled_by_lister"
  | "listing_cancelled_by_lister"
  | "referral_reward"
  | "listing_live"
  | "after_photos_uploaded"
  | "auto_release_warning"
  | "checklist_all_complete"
  | "new_job_in_area"
  | "job_status_update"
  | "early_accept_declined"
  | "listing_public_comment"
  | "job_won_complete_payout"
  | "lister_payout_blocked_cleaner_stripe"
  | "bid_outbid"
  | "listing_assigned_buy_now"
  | "listing_expired_no_bids"
  | "recurring_next_visit"
  | "recurring_contract"
  | "recurring_occurrence_skipped"
  | "launch_promo_active"
  | "launch_promo_progress"
  | "launch_promo_ended"
  | "cleaner_bonus_earned";

export type NewJobChannelDelivery = Partial<{
  email: boolean;
  inApp: boolean;
  sms: boolean;
  push: boolean;
}>;

export type CreateNotificationOptions = {
  senderName?: string;
  /** Legacy numeric listing id when available (some emails). Prefer listingUuid. */
  listingId?: number;
  /** Listing PK for listing-scoped links and data.listing_uuid (string or numeric from DB). */
  listingUuid?: string | number | null;
  /** For SMS: job/listing title (e.g. bid accepted, job won) */
  listingTitle?: string | null;
  /** For SMS: payment amount in cents (e.g. payment released) */
  amountCents?: number | null;
  /** Push: location / price for new job alerts */
  suburb?: string | null;
  postcode?: string | null;
  minPriceCents?: number;
  maxPriceCents?: number;
  /** Bedrooms for new_job_in_area SMS copy (listing in radius). */
  bedroomCount?: number;
  persistTitle?: string;
  persistBody?: string;
  /** When true, only persist in-app row (no email/SMS/push). */
  adminTest?: boolean;
  /** Public listing Q&A notification subtype. */
  qaSubkind?: "question" | "reply";
  /**
   * Per-channel send for this notification. Omitted keys default to on.
   * Used for cleaner new-listing flows (admin global toggles).
   */
  channelDelivery?: NewJobChannelDelivery;
  /** When set (with type new_job_in_area), email/push deep-link to browse jobs at this radius. */
  browseJobsRadiusKm?: number | null;
  dedupeListingId?: string | null;
  nudgeKind?: string | null;
};

export async function createNotification(
  userId: string,
  type: NotificationType,
  jobId: number | null,
  messageText: string,
  options?: CreateNotificationOptions
): Promise<boolean> {
  // Do not require a browser session: webhooks and background jobs call this with no auth cookie.
  const persist = buildNotificationPersistFields(type, jobId, messageText, {
    senderName: options?.senderName,
    listingId: options?.listingId,
    listingUuid: options?.listingUuid,
    listingTitle: options?.listingTitle,
    amountCents: options?.amountCents,
    persistTitle: options?.persistTitle,
    persistBody: options?.persistBody,
    adminTest: options?.adminTest,
    qaSubkind: options?.qaSubkind,
    browseJobsRadiusKm: options?.browseJobsRadiusKm,
    dedupeListingId: options?.dedupeListingId,
    nudgeKind: options?.nudgeKind,
  });
  const cd = options?.channelDelivery;
  const channelOn = (key: keyof NonNullable<CreateNotificationOptions["channelDelivery"]>): boolean =>
    cd == null || cd[key] !== false;
  if (
    cd &&
    cd.email === false &&
    cd.inApp === false &&
    cd.sms === false &&
    cd.push === false
  ) {
    return true;
  }
  const inAppRow = channelOn("inApp");
  const row = {
    user_id: userId,
    type,
    job_id: jobId ?? null,
    message_text: messageText,
    title: persist.title,
    body: persist.body,
    data: persist.data,
    is_read: !inAppRow,
  } as NotificationInsert;

  // Inserts require service role: `notifications` has no INSERT policy for authenticated users.
  const admin = createSupabaseAdminClient();
  if (!admin) {
    console.error(
      "[notifications] failed to insert notification: SUPABASE_SERVICE_ROLE_KEY is not set. In-app/email fan-out to other users cannot be stored. Set the key in Vercel → Environment Variables."
    );
    return false;
  }
  const { error } = await admin.from("notifications").insert(row as never);

  if (error) {
    console.error("[notifications] failed to insert notification", {
      error: error.message,
      row,
    });
    return false;
  }

  if (process.env.NODE_ENV === "development") {
    console.info("[notifications:insert]", {
      userId,
      type,
      jobId,
      title: row.title,
    });
  }

  revalidatePath("/");
  revalidatePath("/dashboard");
  revalidatePath("/profile");
  revalidatePath("/notifications");

  if (options?.adminTest) return true;

  /** In-app only (no email/SMS/push noise for public Q&A). */
  if (type === "listing_public_comment") return true;

  const globalSettings = await getGlobalSettings();
  const prefs = await getNotificationPrefs(userId);
  const numericJobId = jobId != null ? Number(jobId) : null;

  // Email: respect global toggle, per-type toggle, then notification_preferences and email_force_disabled
  let sendEmailThisTime = Boolean(
    channelOn("email") &&
    globalSettings?.emails_enabled !== false &&
    (await getEmailTemplateOverrides()).email_type_enabled?.[type] !== false &&
    prefs.email &&
    prefs.shouldSendEmail(type)
  );
  if (sendEmailThisTime && type === "new_message" && numericJobId != null) {
    const viewing = await recipientViewedJobRecently(userId, numericJobId);
    if (viewing) sendEmailThisTime = false;
  }
  if (sendEmailThisTime && numericJobId != null && type === "new_message") {
    const allowed = await checkAndRecordEmailRateLimit(numericJobId, userId);
    if (!allowed) sendEmailThisTime = false;
  }
  if (sendEmailThisTime) {
    const { email_templates: emailTemplates } = await getEmailTemplateOverrides();
    const adminOverride = emailTemplates[type];
    const { subject, html } = await getNotificationEmailContent(
      type as EmailNotificationType,
      jobId,
      messageText,
      {
        senderName: options?.senderName,
        listingId: options?.listingId,
        listingUuid: options?.listingUuid,
        recipientUserId: userId,
        browseJobsRadiusKm: options?.browseJobsRadiusKm ?? undefined,
      },
      adminOverride
    );
    const result = await sendEmail(prefs.email!, subject, html, {
      log: { userId, kind: `notification:${type}` },
    });
    if (result.skipped) {
      console.info("[email:notification]", {
        outcome: "skipped",
        type,
        userId,
        reason: "global_emails_disabled",
      });
    } else if (!result.ok) {
      console.error("[email:notification]", {
        outcome: "failed",
        type,
        userId,
        error: result.error,
      });
    } else {
      console.info("[email:notification]", {
        outcome: "sent",
        type,
        userId,
      });
    }
  }

  // SMS: critical, high-value events only; max 5 per user per day (via sendSmsToUser)
  const smsNewJobEligible =
    type === "new_job_in_area" ? prefs.shouldSendSmsNewJob() : prefs.shouldSendSms(type);
  if (
    channelOn("sms") &&
    prefs.phone &&
    smsNewJobEligible &&
    isTwilioSmsAllowedForType(globalSettings, type)
  ) {
    const { sendSmsToUser } = await import("@/lib/notifications/sms");
    const { listingDetailPath } = await import("@/lib/marketplace/paths");
    const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "https://www.bondback.io").replace(/\/$/, "");
    let body: string;
    if (type === "new_bid") {
      const who = (options?.senderName ?? "").trim();
      const listingSeg =
        options?.listingUuid != null
          ? String(options.listingUuid).trim()
          : options?.listingId != null
            ? String(options.listingId)
            : "";
      const path = listingSeg ? `/listings/${listingSeg}` : "/jobs";
      body = who
        ? `New bid from ${who.slice(0, 40)} on your listing. View: ${appUrl}${path}`
        : `New bid on your listing. View: ${appUrl}${path}`;
    } else if (type === "job_accepted" || type === "job_created") {
      const title = (options?.listingTitle ?? "").trim() || "Job";
      body = `Your bid was accepted! Job #${jobId ?? "?"} – ${title.slice(0, 40)}. View: ${appUrl}/jobs/${jobId ?? ""}`;
    } else if (type === "job_approved_to_start") {
      body = `Lister approved – start Job #${jobId ?? "?"}. Chat: ${appUrl}/jobs/${jobId ?? ""}`;
    } else if (type === "payment_released") {
      const amount = options?.amountCents != null ? `$${(options.amountCents / 100).toFixed(0)}` : "";
      body = amount
        ? `Payment of ${amount} received for Job #${jobId ?? "?"}. View earnings: ${appUrl}/earnings`
        : `Payment received for Job #${jobId ?? "?"}. View earnings: ${appUrl}/earnings`;
    } else if (type === "cleaner_bonus_earned") {
      const extra =
        options?.amountCents != null ? `$${(options.amountCents / 100).toFixed(0)}` : "extra";
      body = `Bond Back promo bonus: ${extra} on Job #${jobId ?? "?"}. View: ${appUrl}/jobs/${jobId ?? ""}`;
    } else if (type === "dispute_opened") {
      body = `Dispute on Job #${jobId ?? "?"}. Respond now: ${appUrl}/jobs/${jobId ?? ""}`;
    } else if (type === "new_job_in_area") {
      const browseKm =
        options?.browseJobsRadiusKm != null && Number.isFinite(options.browseJobsRadiusKm)
          ? Math.max(1, Math.min(500, Math.round(options.browseJobsRadiusKm)))
          : null;
      if (browseKm != null) {
        body = `Bond cleans near you — browse live jobs: ${appUrl}/jobs?radius_km=${browseKm}`;
      } else {
        const listingSeg =
          options?.listingUuid != null
            ? String(options.listingUuid).trim()
            : options?.listingId != null
              ? String(options.listingId)
              : "";
        const suburbDisplay = (options?.suburb ?? "").trim() || "Your area";
        const rawBeds = options?.bedroomCount;
        const beds = Math.max(
          1,
          Math.min(20, typeof rawBeds === "number" && Number.isFinite(rawBeds) ? Math.floor(rawBeds) : 1)
        );
        const minC = options?.minPriceCents ?? 0;
        const maxC = options?.maxPriceCents ?? minC;
        const midAud = Math.round((minC + maxC) / 2 / 100);
        const path = listingSeg ? listingDetailPath(listingSeg) : "/jobs";
        body = `New bond clean in ${suburbDisplay}: ${beds} bed, $${midAud}. View now: ${appUrl}${path}`;
      }
    } else {
      body = messageText.slice(0, 100) + (jobId != null ? ` ${appUrl}/jobs/${jobId}` : "");
    }
    const result = await sendSmsToUser(userId, prefs.phone, body);
    if (!result.ok) console.error("[notifications] SMS send failed", { userId, type, error: result.error });
  }

  // Push (Expo): critical/high-value events; max 5 per user per day
  let sendPushThisTime = Boolean(
    channelOn("push") &&
    prefs.expoPushToken &&
    (type === "new_job_in_area" ? prefs.shouldSendPushNewJob() : prefs.shouldSendPush(type))
  );
  if (sendPushThisTime && type === "new_message" && numericJobId != null) {
    const viewing = await recipientViewedJobRecently(userId, numericJobId);
    if (viewing) sendPushThisTime = false;
  }
  if (sendPushThisTime && prefs.expoPushToken) {
    const { sendPushToUser, buildPushPayload } = await import("@/lib/notifications/push");
    const payload = buildPushPayload(type, numericJobId ?? null, {
      listingId: options?.listingId ?? undefined,
      listingUuid: options?.listingUuid ?? undefined,
      listingTitle: options?.listingTitle ?? undefined,
      amountCents: options?.amountCents ?? undefined,
      senderName: options?.senderName ?? undefined,
      suburb: options?.suburb ?? undefined,
      postcode: options?.postcode ?? undefined,
      minPriceCents: options?.minPriceCents,
      maxPriceCents: options?.maxPriceCents,
      browseJobsRadiusKm: options?.browseJobsRadiusKm ?? undefined,
    });
    const result = await sendPushToUser(userId, prefs.expoPushToken, payload);
    if (!result.ok) {
      console.error("[notifications] push send failed", { userId, type, error: result.error });
    } else if (result.sent) {
      console.info("[push:notification]", { outcome: "sent", type, userId });
    }
  }

  return true;
}

/** Admin only: inserts an in-app test row (no email/SMS/push). For Global Settings QA. */
export async function sendAdminTestNotification(): Promise<{
  ok: boolean;
  error?: string;
}> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    return { ok: false, error: "Not authenticated" };
  }
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", session.user.id)
    .maybeSingle();
  if (!profile || !(profile as { is_admin?: boolean }).is_admin) {
    return { ok: false, error: "Not authorised" };
  }

  const messageText =
    "If you see this, in-app notifications are working. Sent from Admin → Global Settings.";
  const persist = buildNotificationPersistFields("new_message", null, messageText, {
    persistTitle: "Test notification",
    persistBody: messageText,
    adminTest: true,
  });
  const row = {
    user_id: session.user.id,
    type: "new_message" as const,
    job_id: null,
    message_text: messageText,
    title: persist.title,
    body: persist.body,
    data: persist.data,
  } as NotificationInsert;

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return {
      ok: false,
      error:
        "SUPABASE_SERVICE_ROLE_KEY is not set on the server. The admin test must insert via the service role (RLS has no INSERT policy for clients). Add the key in Vercel → Project → Settings → Environment Variables.",
    };
  }
  const client = admin as SupabaseClient<Database>;
  const { error: errFull } = await client.from("notifications").insert(row as never);
  if (!errFull) {
    revalidatePath("/");
    revalidatePath("/dashboard");
    revalidatePath("/profile");
    revalidatePath("/notifications");
    if (process.env.NODE_ENV === "development") {
      console.info("[notifications:admin-test-insert]", { userId: session.user.id });
    }
    return { ok: true };
  }

  const minimalRow = {
    user_id: session.user.id,
    type: "new_message" as const,
    job_id: null,
    message_text: messageText,
  } as NotificationInsert;
  const { error: errMinimal } = await client.from("notifications").insert(minimalRow as never);
  if (errMinimal) {
    console.error("[notifications] admin test insert failed", {
      full: errFull,
      minimal: errMinimal,
    });
    return {
      ok: false,
      error: errMinimal.message || errFull.message,
    };
  }

  console.warn(
    "[notifications] admin test insert succeeded with legacy columns only (apply notifications title/body/data migration or reload PostgREST schema if rich rows are required)",
    { firstError: errFull.message, code: errFull.code }
  );

  revalidatePath("/");
  revalidatePath("/dashboard");
  revalidatePath("/profile");
  revalidatePath("/notifications");
  if (process.env.NODE_ENV === "development") {
    console.info("[notifications:admin-test-insert]", { userId: session.user.id });
  }
  return { ok: true };
}

/** Lister: listing went live (call after publish). */
export async function notifyListerListingLive(listingId: string): Promise<void> {
  const admin = createSupabaseAdminClient();
  if (!admin) return;
  const { data: listing } = await admin
    .from("listings")
    .select("lister_id, title, suburb, postcode")
    .eq("id", listingId)
    .maybeSingle();
  if (!listing) return;
  const row = listing as {
    lister_id: string;
    title?: string | null;
    suburb?: string | null;
    postcode?: string | null;
  };
  const title = (row.title ?? "").trim() || "Your listing";
  const loc = [row.suburb, row.postcode].filter(Boolean).join(" ");
  const msg = loc
    ? `"${title}" is live in ${loc}. Cleaners can bid now.`
    : `"${title}" is live. Cleaners can bid now.`;
  await createNotification(row.lister_id, "listing_live", null, msg, {
    listingUuid: listingId,
    listingTitle: title,
  });
}

/** Lister: cleaner uploaded enough after photos (deduped). */
export async function notifyListerAfterPhotosReady(jobId: number): Promise<void> {
  const admin = createSupabaseAdminClient();
  if (!admin) return;
  const { data: job } = await admin
    .from("jobs")
    .select("lister_id, listing_id")
    .eq("id", jobId)
    .maybeSingle();
  if (!job) return;
  const { lister_id, listing_id } = job as { lister_id: string; listing_id: string | null };
  if (!lister_id) return;
  if (await hasRecentJobNotification(lister_id, "after_photos_uploaded", jobId, 48)) return;
  let jobTitle: string | null = null;
  if (listing_id) {
    const { data: l } = await admin.from("listings").select("title").eq("id", listing_id).maybeSingle();
    jobTitle = (l as { title?: string | null } | null)?.title ?? null;
  }
  const addr = jobTitle ? ` — ${jobTitle}` : "";
  await createNotification(
    lister_id,
    "after_photos_uploaded",
    jobId,
    `The cleaner uploaded after photos for this job${addr}. Review when ready.`,
    { listingTitle: jobTitle, listingUuid: listing_id ?? undefined }
  );
}

/** Other party: every checklist item completed while job is in progress (deduped). */
export async function notifyChecklistAllComplete(
  jobId: number,
  completedByUserId: string
): Promise<void> {
  const admin = createSupabaseAdminClient();
  if (!admin) return;
  const { data: job } = await admin
    .from("jobs")
    .select("lister_id, winner_id, listing_id, status")
    .eq("id", jobId)
    .maybeSingle();
  if (!job) return;
  const row = job as {
    lister_id: string;
    winner_id: string | null;
    listing_id: string | null;
    status: string;
  };
  if (row.status !== "in_progress") return;
  const other = authUserIdsMatch(completedByUserId, row.lister_id)
    ? row.winner_id
    : authUserIdsMatch(completedByUserId, row.winner_id)
      ? row.lister_id
      : null;
  if (!other) return;
  if (await hasRecentJobNotification(other, "checklist_all_complete", jobId, 24)) return;
  let jobTitle: string | null = null;
  if (row.listing_id) {
    const { data: l } = await admin.from("listings").select("title").eq("id", row.listing_id).maybeSingle();
    jobTitle = (l as { title?: string | null } | null)?.title ?? null;
  }
  const t = jobTitle ? ` (${jobTitle})` : "";
  const listerIsWinner =
    row.winner_id != null &&
    String(row.winner_id).trim() !== "" &&
    authUserIdsMatch(row.lister_id, row.winner_id);
  const completedByLister = authUserIdsMatch(completedByUserId, row.lister_id);
  const message = listerIsWinner
    ? `All checklist items are complete${t}.`
    : completedByLister
      ? `Lister completed all checklist items${t}.`
      : `Cleaner completed all checklist items${t}.`;
  await createNotification(
    other,
    "checklist_all_complete",
    jobId,
    message,
    { listingTitle: jobTitle, listingUuid: row.listing_id ?? undefined }
  );
}

/** Admin: in-app sample for a notification type (no email/SMS/push). */
export async function sendAdminTestNotificationByType(
  type: NotificationType
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return { ok: false, error: "Not authenticated" };
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", session.user.id)
    .maybeSingle();
  if (!profile || !(profile as { is_admin?: boolean }).is_admin) {
    return { ok: false, error: "Not authorised" };
  }

  /** Always null — avoids FK failures when no row exists in `jobs` (sample ids like 1 often missing). */
  const samples: Partial<
    Record<NotificationType, { jobId: number | null; message: string; options?: CreateNotificationOptions }>
  > = {
    new_message: {
      jobId: null,
      message: "Sample: you have a new message in job chat.",
      options: { senderName: "Sample Cleaner", adminTest: true },
    },
    new_bid: {
      jobId: null,
      message: "Sample: Sam placed a bid of $420.00 on your listing.",
      options: {
        listingUuid: "00000000-0000-0000-0000-000000000001",
        senderName: "Sam",
        amountCents: 42000,
        adminTest: true,
      },
    },
    job_created: {
      jobId: null,
      message: "Sample: you accepted a bid — pay & start when ready.",
      options: { adminTest: true },
    },
    job_accepted: {
      jobId: null,
      message: "Sample: your bid was accepted.",
      options: { listingTitle: "2 Bedroom Unit", adminTest: true },
    },
    job_approved_to_start: {
      jobId: null,
      message: "Sample: lister paid — you can start the job.",
      options: { adminTest: true },
    },
    job_completed: {
      jobId: null,
      message: "Sample: cleaner marked the job complete — review and release.",
      options: { adminTest: true },
    },
    funds_ready: {
      jobId: null,
      message: "Sample: funds are ready to release after review.",
      options: { adminTest: true },
    },
    payment_released: {
      jobId: null,
      message: "Sample: payment released.",
      options: { amountCents: 35000, adminTest: true },
    },
    dispute_opened: {
      jobId: null,
      message: "Sample: a dispute was opened on this job.",
      options: { adminTest: true },
    },
    dispute_resolved: {
      jobId: null,
      message: "Sample: dispute resolved.",
      options: { adminTest: true },
    },
    job_cancelled_by_lister: {
      jobId: null,
      message: "Sample: the lister cancelled this job.",
      options: { adminTest: true },
    },
    listing_cancelled_by_lister: {
      jobId: null,
      message: "Sample: the lister ended a live auction you had bid on.",
      options: {
        listingUuid: "00000000-0000-0000-0000-000000000001",
        listingTitle: "2 Bed Unit",
        adminTest: true,
      },
    },
    referral_reward: {
      jobId: null,
      message: "Sample: you earned a referral reward.",
      options: { adminTest: true },
    },
    listing_live: {
      jobId: null,
      message: 'Sample: "2 Bed Unit" is live in Brisbane. Cleaners can bid now.',
      options: {
        listingUuid: "00000000-0000-0000-0000-000000000001",
        listingTitle: "2 Bed Unit",
        adminTest: true,
      },
    },
    after_photos_uploaded: {
      jobId: null,
      message: "Sample: the cleaner uploaded after photos — review when ready.",
      options: { listingTitle: "2 Bed Unit", adminTest: true },
    },
    auto_release_warning: {
      jobId: null,
      message: "Sample: ~24h left before funds auto-release.",
      options: { adminTest: true },
    },
    checklist_all_complete: {
      jobId: null,
      message: "Sample: Cleaner completed all checklist items.",
      options: { adminTest: true },
    },
    new_job_in_area: {
      jobId: null,
      message: "Sample: new bond clean in your area — open to bid.",
      options: {
        listingUuid: "00000000-0000-0000-0000-000000000001",
        suburb: "Brisbane",
        postcode: "4000",
        minPriceCents: 30000,
        maxPriceCents: 45000,
        adminTest: true,
      },
    },
    job_status_update: {
      jobId: null,
      message: "Sample: job status changed (e.g. payment secured / in progress).",
      options: { adminTest: true },
    },
    bid_outbid: {
      jobId: null,
      message:
        "Sample: another cleaner placed a lower bid on \"2 Bed Unit\" ($240.00). Your bid is no longer the lowest.",
      options: {
        listingUuid: "00000000-0000-0000-0000-000000000001",
        listingTitle: "2 Bed Unit",
        amountCents: 24000,
        adminTest: true,
      },
    },
    listing_assigned_buy_now: {
      jobId: null,
      message:
        'Sample: another cleaner secured "2 Bed Unit" at the fixed price of $350.00. Your bid is no longer active.',
      options: {
        listingUuid: "00000000-0000-0000-0000-000000000001",
        listingTitle: "2 Bed Unit",
        amountCents: 35000,
        adminTest: true,
      },
    },
    listing_expired_no_bids: {
      jobId: null,
      message:
        'Sample: your auction "2 Bed Unit" ended with no bids. You can relist from My Listings.',
      options: {
        listingUuid: "00000000-0000-0000-0000-000000000001",
        listingTitle: "2 Bed Unit",
        adminTest: true,
      },
    },
    launch_promo_active: {
      jobId: null,
      message:
        "Sample: 🎉 Your 0% Fee Promo is Active! You have 2 free jobs remaining.",
      options: { adminTest: true },
    },
    launch_promo_progress: {
      jobId: null,
      message: "Sample: 1 of 2 free jobs used. One more job with 0% fee!",
      options: { adminTest: true },
    },
    launch_promo_ended: {
      jobId: null,
      message: "Sample: Your launch promo has ended. Normal 12% fee now applies.",
      options: { adminTest: true },
    },
  };

  const s = samples[type];
  if (!s) {
    return { ok: false, error: "No sample template for this type yet." };
  }

  const inserted = await createNotification(session.user.id, type, s.jobId, s.message, s.options);
  if (!inserted) {
    return {
      ok: false,
      error:
        "Could not save the notification row. Ensure SUPABASE_SERVICE_ROLE_KEY is set and check the server log for the insert error.",
    };
  }
  return { ok: true };
}

/** Send payment receipt emails to lister and cleaner (on release). Respects global send_payment_receipt_emails and user receipt_emails pref. */
export async function sendPaymentReceiptEmails(params: {
  jobId: number;
  listerId: string;
  cleanerId: string | null;
  amountCents: number;
  feeCents: number;
  netCents: number;
  jobTitle?: string | null;
  dateIso: string;
}): Promise<void> {
  const settings = await getGlobalSettings();
  if (settings?.send_payment_receipt_emails === false) return;
  const platformAbn = settings?.platform_abn ?? null;
  const prefsLister = await getNotificationPrefs(params.listerId);
  const prefsCleaner = params.cleanerId ? await getNotificationPrefs(params.cleanerId) : null;
  if (!prefsLister.shouldSendEmail("payment_receipt") && !(prefsCleaner?.shouldSendEmail("payment_receipt"))) return;
  if (prefsLister.email && prefsLister.shouldSendEmail("payment_receipt")) {
    const { subject, html } = await buildPaymentReceiptEmail({
      variant: "lister",
      jobId: params.jobId,
      amountCents: params.amountCents,
      feeCents: params.feeCents,
      netCents: params.netCents,
      jobTitle: params.jobTitle,
      dateIso: params.dateIso,
      platformAbn,
    });
    const result = await sendEmail(prefsLister.email, subject, html, {
      log: { userId: params.listerId, kind: "payment_receipt" },
    });
    if (result.ok && !result.skipped) {
      console.info("[email:payment_receipt]", { outcome: "sent", variant: "lister", jobId: params.jobId, userId: params.listerId });
    } else if (!result.ok) {
      console.error("[email:payment_receipt]", { outcome: "failed", variant: "lister", jobId: params.jobId, error: result.error });
    }
  }
  if (params.cleanerId && prefsCleaner?.email && prefsCleaner.shouldSendEmail("payment_receipt")) {
    const { subject, html } = await buildPaymentReceiptEmail({
      variant: "cleaner",
      jobId: params.jobId,
      amountCents: params.amountCents,
      feeCents: params.feeCents,
      netCents: params.netCents,
      jobTitle: params.jobTitle,
      dateIso: params.dateIso,
      platformAbn,
    });
    const result = await sendEmail(prefsCleaner.email, subject, html, {
      log: { userId: params.cleanerId, kind: "payment_receipt" },
    });
    if (result.ok && !result.skipped) {
      console.info("[email:payment_receipt]", { outcome: "sent", variant: "cleaner", jobId: params.jobId, userId: params.cleanerId });
    } else if (!result.ok) {
      console.error("[email:payment_receipt]", { outcome: "failed", variant: "cleaner", jobId: params.jobId, error: result.error });
    }
  }
}

/** Send refund receipt email to lister. Respects global send_payment_receipt_emails and user receipt_emails pref. */
export async function sendRefundReceiptEmail(params: {
  jobId: number;
  listerId: string;
  refundCents: number;
  jobTitle?: string | null;
  dateIso: string;
}): Promise<void> {
  const settings = await getGlobalSettings();
  if (settings?.send_payment_receipt_emails === false) return;
  const platformAbn = settings?.platform_abn ?? null;
  const prefs = await getNotificationPrefs(params.listerId);
  if (!prefs.email || !prefs.shouldSendEmail("payment_receipt")) return;
  const { subject, html } = await buildPaymentReceiptEmail({
    variant: "refund",
    jobId: params.jobId,
    amountCents: 0,
    refundCents: params.refundCents,
    jobTitle: params.jobTitle,
    dateIso: params.dateIso,
    platformAbn,
  });
  const result = await sendEmail(prefs.email, subject, html, {
    log: { userId: params.listerId, kind: "payment_receipt_refund" },
  });
  if (!result.ok) console.error("[notifications] refund receipt email failed", { jobId: params.jobId, error: result.error });
}

export async function markNotificationRead(
  id: string
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createServerSupabaseClient();

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return { ok: false, error: "You must be logged in." };
  }

  const { error } = await supabase
    .from("notifications")
    .update({ is_read: true } as Database["public"]["Tables"]["notifications"]["Update"] as never)
    .eq("id", id)
    .eq("user_id", session.user.id);

  if (error) {
    return { ok: false, error: error.message };
  }

  if (process.env.NODE_ENV === "development") {
    console.info("[notifications:mark-read]", { id, userId: session.user.id });
  }

  revalidatePath("/");
  revalidatePath("/dashboard");
  revalidatePath("/notifications");
  return { ok: true };
}

/** Marks unread in-app Q&A Chat notifications scoped to one listing (bell + FAB badge). */
export async function markListingQaNotificationsRead(
  listingId: string
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return { ok: false, error: "You must be logged in." };

  const lid = String(listingId).trim();
  if (!lid) return { ok: false, error: "Invalid listing." };

  const { error } = await supabase
    .from("notifications")
    .update({ is_read: true } as Database["public"]["Tables"]["notifications"]["Update"] as never)
    .eq("user_id", session.user.id)
    .eq("type", "listing_public_comment")
    .eq("is_read", false)
    .filter("data->>listing_uuid", "eq", lid);

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath("/");
  revalidatePath("/notifications");
  revalidatePath(`/listings/${encodeURIComponent(lid)}`);
  return { ok: true };
}

/** Unread Q&A Chat rows for the current user on one listing (FAB badge). */
export async function countUnreadListingQaNotifications(
  listingId: string
): Promise<number> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return 0;
  const lid = String(listingId).trim();
  if (!lid) return 0;

  const { count, error } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", session.user.id)
    .eq("type", "listing_public_comment")
    .eq("is_read", false)
    .filter("data->>listing_uuid", "eq", lid);

  if (error) {
    console.warn("[countUnreadListingQaNotifications]", error.message);
    return 0;
  }
  return count ?? 0;
}

export async function markAllNotificationsRead(): Promise<{
  ok: boolean;
  error?: string;
}> {
  const supabase = await createServerSupabaseClient();

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return { ok: false, error: "You must be logged in." };
  }

  const { error } = await supabase
    .from("notifications")
    .update({ is_read: true } as Database["public"]["Tables"]["notifications"]["Update"] as never)
    .eq("user_id", session.user.id)
    .eq("is_read", false);

  if (error) {
    return { ok: false, error: error.message };
  }

  if (process.env.NODE_ENV === "development") {
    console.info("[notifications:mark-all-read]", { userId: session.user.id });
  }

  revalidatePath("/");
  revalidatePath("/dashboard");
  revalidatePath("/notifications");
  return { ok: true };
}

/** Marks every unread `new_message` notification for the current user (messages tab badge). */
export async function markAllNewMessageNotificationsRead(): Promise<{
  ok: boolean;
  error?: string;
}> {
  const supabase = await createServerSupabaseClient();

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return { ok: false, error: "You must be logged in." };
  }

  const { error } = await supabase
    .from("notifications")
    .update({ is_read: true } as Database["public"]["Tables"]["notifications"]["Update"] as never)
    .eq("user_id", session.user.id)
    .eq("type", "new_message")
    .eq("is_read", false);

  if (error) {
    return { ok: false, error: error.message };
  }

  if (process.env.NODE_ENV === "development") {
    console.info("[notifications:mark-all-new-message-read]", { userId: session.user.id });
  }

  revalidatePath("/");
  revalidatePath("/dashboard");
  revalidatePath("/messages");
  revalidatePath("/notifications");
  return { ok: true };
}
