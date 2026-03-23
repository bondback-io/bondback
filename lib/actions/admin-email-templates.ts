"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getGlobalSettings } from "@/lib/actions/global-settings";
import type { EmailTemplateOverride } from "@/lib/actions/global-settings";
import { getEmailForUserId } from "@/lib/supabase/admin";
import { substitutePlaceholders } from "@/lib/notifications/email";
import {
  buildNotificationEmail,
  sendEmail,
  type NotificationType as EmailNotificationType,
} from "@/lib/notifications/email";
import {
  EMAIL_TEMPLATE_TYPES,
  getSampleDataForType,
  type EmailTemplateType,
  type SampleData,
} from "@/lib/admin-email-templates-utils";
import { getAllDefaultTemplates, getDefaultTemplate } from "@/lib/default-email-templates";
import { logAdminActivity } from "@/lib/admin-activity-log";

const TEST_SEND_LIMIT_PER_HOUR = 10;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://bondback.com";
const UNSUBSCRIBE_PATH = "/profile";

function getUnsubscribeFooterHtml(): string {
  const url = `${APP_URL}${UNSUBSCRIBE_PATH}`;
  return `
<div style="margin-top:2em;padding-top:1em;border-top:1px solid #eee;font-size:12px;color:#666;">
  <p>You received this email because of your Bond Back notification settings.</p>
  <p><a href="${url}">Manage notification preferences or unsubscribe</a></p>
</div>`;
}

async function requireAdmin(): Promise<{ supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>; adminId: string }> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error("Not authenticated");
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", session.user.id)
    .maybeSingle();
  if (!profile || !(profile as { is_admin?: boolean }).is_admin) {
    throw new Error("Not authorised");
  }
  return { supabase, adminId: session.user.id };
}

/** Admin only: return current user profile for email preview personalization (real test data). */
export async function getTestUserProfileForPreview(): Promise<{
  ok: true;
  data: TestDataInput;
} | { ok: false; error: string }> {
  try {
    const { supabase, adminId } = await requireAdmin();
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, active_role, suburb")
      .eq("id", adminId)
      .maybeSingle();
    const row = profile as { full_name?: string | null; active_role?: string | null; suburb?: string | null } | null;
    const name = row?.full_name?.trim() || "You";
    const role = row?.active_role === "cleaner" ? "Cleaner" : "Lister";
    return {
      ok: true,
      data: {
        name,
        role,
        senderName: name,
        messageText: "Hi, would Tuesday 2pm work for the clean?",
        jobId: "10042",
        amount: "$280",
        listingTitle: "3br House Bond Clean – Sydney",
        suburb: row?.suburb?.trim() || "Sydney",
      },
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to load profile" };
  }
}

export type EmailTemplatesData = {
  emailsEnabled: boolean;
  templates: Record<string, EmailTemplateOverride>;
  typeEnabled: Record<string, boolean>;
};

function normalizeTemplateActive(active: unknown): boolean {
  if (active === true) return true;
  if (typeof active === "string") return active.toLowerCase().trim() === "true" || active === "1";
  return false;
}

/** Read template overrides and type_enabled from email_template_overrides table (no global_settings columns). */
async function getEmailTemplateOverridesFromTable(): Promise<{
  templates: Record<string, EmailTemplateOverride>;
  typeEnabled: Record<string, boolean>;
}> {
  const supabase = await createServerSupabaseClient();
  const { data: rows } = await supabase
    .from("email_template_overrides")
    .select("template_key, subject, body, active, type_enabled, send_after");
  const templates: Record<string, EmailTemplateOverride> = {};
  const typeEnabled: Record<string, boolean> = {};
  const defaults = getAllDefaultTemplates();
  for (const type of EMAIL_TEMPLATE_TYPES) {
    const def = defaults[type];
    const defaultSendAfter = type === "birthday" ? "on_dob" : "instant";
    templates[type] = { subject: def?.subject ?? "", body: def?.body ?? "", active: false, send_after: defaultSendAfter };
    typeEnabled[type] = true;
  }
  (rows ?? []).forEach((r: { template_key: string; subject: string; body: string; active: boolean; type_enabled: boolean; send_after?: string | null }) => {
    const sendAfter = r.template_key === "birthday" ? "on_dob" : (r.send_after ?? "instant");
    templates[r.template_key] = { subject: r.subject ?? "", body: r.body ?? "", active: !!r.active, send_after: sendAfter };
    typeEnabled[r.template_key] = r.type_enabled !== false;
  });
  return { templates, typeEnabled };
}

export async function getEmailTemplates(): Promise<EmailTemplatesData | null> {
  const settings = await getGlobalSettings();
  if (!settings) return null;
  const { templates, typeEnabled } = await getEmailTemplateOverridesFromTable();
  const defaults = getAllDefaultTemplates();
  for (const type of EMAIL_TEMPLATE_TYPES) {
    if (!templates[type] && defaults[type])
      templates[type] = { subject: defaults[type].subject, body: defaults[type].body, active: false };
  }
  return {
    emailsEnabled: settings.emails_enabled !== false,
    templates,
    typeEnabled: { ...typeEnabled },
  };
}

export type SaveEmailTemplateResult =
  | { ok: true }
  | { ok: false; error: string };

export async function saveEmailTemplate(
  type: string,
  subject: string,
  body: string,
  active: boolean,
  sendAfter: string = "instant"
): Promise<SaveEmailTemplateResult> {
  const { supabase, adminId } = await requireAdmin();
  const { data: existing } = await supabase
    .from("email_template_overrides")
    .select("type_enabled")
    .eq("template_key", type)
    .maybeSingle();
  const { error } = await supabase
    .from("email_template_overrides")
    .upsert(
      {
        template_key: type,
        subject: subject.trim(),
        body: body.trim(),
        active: !!active,
        type_enabled: (existing as { type_enabled?: boolean } | null)?.type_enabled ?? true,
        send_after: sendAfter || "instant",
        updated_at: new Date().toISOString(),
      } as never,
      { onConflict: "template_key" }
    );
  if (error) return { ok: false, error: error.message };
  await logAdminActivity({ adminId, actionType: "email_template_saved", targetType: "other", targetId: type, details: { subject: subject.trim().slice(0, 50) } });
  revalidatePath("/admin/emails");
  revalidatePath("/admin/global-settings");
  return { ok: true };
}

export type ApplyDefaultTemplatesResult = { ok: true; count: number } | { ok: false; error: string };

/** Pre-fill all email templates with professional default content. Merges into existing; does not overwrite custom content. */
export async function applyDefaultEmailTemplates(): Promise<ApplyDefaultTemplatesResult> {
  const { supabase, adminId } = await requireAdmin();
  const { data: rows } = await supabase.from("email_template_overrides").select("template_key, subject, body, active, type_enabled, send_after");
  const existingByKey = new Map((rows ?? []).map((r: { template_key: string; subject: string; body: string; active: boolean; type_enabled: boolean; send_after?: string }) => [r.template_key, r]));
  const defaults = getAllDefaultTemplates();
  let count = 0;
  for (const [type, def] of Object.entries(defaults)) {
    const row = existingByKey.get(type);
    const hasContent = row && (row.subject?.trim() || row.body?.trim());
    if (!hasContent) {
      const sendAfter = type === "birthday" ? "on_dob" : ((row as { send_after?: string } | undefined)?.send_after ?? "instant");
      const { error } = await supabase.from("email_template_overrides").upsert(
        {
          template_key: type,
          subject: def.subject,
          body: def.body,
          active: false,
          type_enabled: row?.type_enabled ?? true,
          send_after: sendAfter,
          updated_at: new Date().toISOString(),
        } as never,
        { onConflict: "template_key" }
      );
      if (!error) count++;
    }
  }
  await logAdminActivity({ adminId, actionType: "email_defaults_applied", targetType: "other", targetId: "templates", details: { count } });
  revalidatePath("/admin/emails");
  revalidatePath("/admin/global-settings");
  return { ok: true, count };
}

export type ToggleEmailTypeResult =
  | { ok: true }
  | { ok: false; error: string };

export async function toggleEmailType(
  type: string,
  enabled: boolean
): Promise<ToggleEmailTypeResult> {
  const { supabase, adminId } = await requireAdmin();
  const { data: row } = await supabase
    .from("email_template_overrides")
    .select("template_key, subject, body, active, type_enabled, send_after")
    .eq("template_key", type)
    .maybeSingle();
  const def = getDefaultTemplate(type);
  const { error } = await supabase
    .from("email_template_overrides")
    .upsert(
      {
        template_key: type,
        subject: (row as { subject?: string } | null)?.subject ?? def?.subject ?? "",
        body: (row as { body?: string } | null)?.body ?? def?.body ?? "",
        active: (row as { active?: boolean } | null)?.active ?? false,
        type_enabled: enabled,
        send_after: (row as { send_after?: string } | null)?.send_after ?? "instant",
        updated_at: new Date().toISOString(),
      } as never,
      { onConflict: "template_key" }
    );
  if (error) return { ok: false, error: error.message };
  await logAdminActivity({ adminId, actionType: "email_type_toggled", targetType: "other", targetId: type, details: { enabled } });
  revalidatePath("/admin/emails");
  revalidatePath("/admin/global-settings");
  return { ok: true };
}

/** Alias for saveEmailTemplate. Updates a single template (subject, body, active, send_after). */
export async function updateEmailTemplate(
  type: string,
  subject: string,
  body: string,
  active: boolean,
  sendAfter?: string
): Promise<SaveEmailTemplateResult> {
  return saveEmailTemplate(type, subject, body, active, sendAfter ?? "instant");
}

/** Valid template key: lowercase letters, numbers, underscore. */
const TEMPLATE_KEY_REGEX = /^[a-z0-9_]+$/;

export type CreateEmailTemplateResult =
  | { ok: true; type: string }
  | { ok: false; error: string };

export async function createEmailTemplate(typeKey: string): Promise<CreateEmailTemplateResult> {
  const key = typeKey.trim().toLowerCase();
  if (!key) return { ok: false, error: "Template key is required." };
  if (!TEMPLATE_KEY_REGEX.test(key)) return { ok: false, error: "Use only letters, numbers and underscore (e.g. new_bid)." };
  const { supabase, adminId } = await requireAdmin();
  const { data: existing } = await supabase
    .from("email_template_overrides")
    .select("template_key")
    .eq("template_key", key)
    .maybeSingle();
  if (existing) return { ok: false, error: "A template with this key already exists." };
  const sendAfter = key === "birthday" ? "on_dob" : "instant";
  const { error } = await supabase.from("email_template_overrides").insert({
    template_key: key,
    subject: "",
    body: "",
    active: false,
    type_enabled: true,
    send_after: sendAfter,
    updated_at: new Date().toISOString(),
  } as never);
  if (error) return { ok: false, error: error.message };
  await logAdminActivity({ adminId, actionType: "email_template_created", targetType: "other", targetId: key, details: {} });
  revalidatePath("/admin/emails");
  return { ok: true, type: key };
}

export type PreviewContentResult = {
  subject: string;
  html: string;
  sampleData: SampleData;
  unsubscribeUrl: string;
};

/** Build preview subject + HTML with sample data and unsubscribe footer. */
export async function getPreviewContent(
  type: string,
  subject: string,
  body: string
): Promise<PreviewContentResult> {
  await requireAdmin();
  const sample = getSampleDataForType(type);
  const rawHtml =
    subject.trim() && body.trim()
      ? substitutePlaceholders(
          body,
          sample.messageText,
          sample.jobId,
          sample.senderName,
          sample.listingId
        )
      : "";
  const html = rawHtml ? rawHtml + getUnsubscribeFooterHtml() : "<p><em>No template body set. Add subject and body to see preview.</em></p>" + getUnsubscribeFooterHtml();
  const subj = subject.trim() || "(No subject)";
  return {
    subject: subj,
    html,
    sampleData: sample,
    unsubscribeUrl: `${APP_URL}${UNSUBSCRIBE_PATH}`,
  };
}

export type TestSendRateLimitResult = {
  allowed: boolean;
  remaining: number;
  limit: number;
};

export async function getTestSendRateLimit(): Promise<TestSendRateLimitResult | null> {
  const { supabase, adminId } = await requireAdmin();
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count, error } = await supabase
    .from("admin_email_test_sends")
    .select("*", { count: "exact", head: true })
    .eq("admin_id", adminId)
    .gte("sent_at", since);
  if (error) return null;
  const used = count ?? 0;
  const remaining = Math.max(0, TEST_SEND_LIMIT_PER_HOUR - used);
  return {
    allowed: remaining > 0,
    remaining,
    limit: TEST_SEND_LIMIT_PER_HOUR,
  };
}

export type SendTestEmailResult =
  | { ok: true }
  | { ok: false; error: string };

export async function sendTestEmail(
  type: string,
  toEmail: string | null
): Promise<SendTestEmailResult> {
  const { supabase, adminId } = await requireAdmin();

  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count } = await supabase
    .from("admin_email_test_sends")
    .select("*", { count: "exact", head: true })
    .eq("admin_id", adminId)
    .gte("sent_at", since);
  const used = count ?? 0;
  if (used >= TEST_SEND_LIMIT_PER_HOUR) {
    return { ok: false, error: `Rate limit reached. Max ${TEST_SEND_LIMIT_PER_HOUR} test emails per hour. Try again later.` };
  }

  let recipient = toEmail?.trim() || null;
  if (!recipient) {
    const email = await getEmailForUserId(adminId);
    if (!email) return { ok: false, error: "No email address. Enter an email or add one to your account." };
    recipient = email;
  }

  const { templates } = await getEmailTemplateOverridesFromTable();
  const override = templates[type];
  const sample = getSampleDataForType(type);

  let subject: string;
  let html: string;

  if (override?.subject?.trim() && override?.body?.trim()) {
    const { markdownToHtml } = await import("@/lib/markdown");
    const bodyHtml = markdownToHtml(override.body);
    const testData: TestDataInput = {
      messageText: sample.messageText,
      jobId: sample.jobId != null ? String(sample.jobId) : "10042",
      senderName: sample.senderName,
      listingId: sample.listingId != null ? String(sample.listingId) : "10042",
      name: "Alex",
      role: "Lister",
      amount: "$280",
      listingTitle: "3br House Bond Clean – Sydney",
    };
    subject = substituteTestData(override.subject.trim(), testData);
    html = substituteTestData(bodyHtml, testData) + getUnsubscribeFooterHtml();
  } else {
    const knownType = EMAIL_TEMPLATE_TYPES.includes(type as EmailTemplateType)
      ? (type as EmailNotificationType)
      : "new_message";
    const built = await buildNotificationEmail(
      knownType,
      sample.jobId,
      sample.messageText,
      sample.senderName,
      sample.listingId ?? undefined
    );
    subject = built.subject;
    html = built.html + getUnsubscribeFooterHtml();
  }

  const result = await sendEmail(recipient, subject, html);
  if (!result.ok) return { ok: false, error: result.error ?? "Failed to send" };

  await supabase.from("admin_email_test_sends").insert({
    admin_id: adminId,
    sent_at: new Date().toISOString(),
  } as never);
  revalidatePath("/admin/emails");
  return { ok: true };
}

/** Test data for live preview and "Send test with current content". */
export type TestDataInput = {
  messageText?: string;
  jobId?: string;
  senderName?: string;
  listingId?: string;
  name?: string;
  role?: string;
  amount?: string;
  listingTitle?: string;
  suburb?: string;
};

/** Substitute {{...}}, [Name], [Role], etc., and {name}, {role}, {jobId}, {amount}, {listingTitle}, {suburb} in text. */
function substituteTestData(
  text: string,
  data: TestDataInput
): string {
  const msg = data.messageText ?? "";
  const jobId = data.jobId ?? "10042";
  const sender = data.senderName ?? "";
  const listingId = data.listingId ?? jobId;
  const name = data.name ?? "Alex";
  const role = data.role ?? "Lister";
  const amount = data.amount ?? "$280";
  const listingTitle = data.listingTitle ?? "3br House Bond Clean – Sydney";
  const suburb = data.suburb ?? "Sydney";
  return text
    .replace(/\{\{message\}\}/g, msg)
    .replace(/\{\{jobId\}\}/g, jobId)
    .replace(/\{\{senderName\}\}/g, sender)
    .replace(/\{\{listingId\}\}/g, listingId)
    .replace(/\[Name\]/g, name)
    .replace(/\[Role\]/g, role)
    .replace(/\[JobId\]/g, jobId)
    .replace(/\[Amount\]/g, amount)
    .replace(/\{name\}/gi, name)
    .replace(/\{role\}/gi, role)
    .replace(/\{jobId\}/gi, jobId)
    .replace(/\{suburb\}/gi, suburb)
    .replace(/\{amount\}/gi, amount)
    .replace(/\{listingTitle\}/gi, listingTitle);
}

/** Send test email using provided subject/body and test data (for "Send test with current content"). Rate limited. */
export async function sendTestEmailWithContent(
  type: string,
  toEmail: string | null,
  subject: string,
  body: string,
  testData: TestDataInput
): Promise<SendTestEmailResult> {
  const { supabase, adminId } = await requireAdmin();

  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count } = await supabase
    .from("admin_email_test_sends")
    .select("*", { count: "exact", head: true })
    .eq("admin_id", adminId)
    .gte("sent_at", since);
  if ((count ?? 0) >= TEST_SEND_LIMIT_PER_HOUR) {
    return { ok: false, error: `Rate limit reached. Max ${TEST_SEND_LIMIT_PER_HOUR} test emails per hour.` };
  }

  let recipient = toEmail?.trim() || null;
  if (!recipient) {
    const email = await getEmailForUserId(adminId);
    if (!email) return { ok: false, error: "No email address. Enter an email or add one to your account." };
    recipient = email;
  }

  const subj = subject.trim() || "(No subject)";
  const rawBody = body.trim() || "<p>No body.</p>";
  const { markdownToHtml } = await import("@/lib/markdown");
  const bodyHtml = markdownToHtml(rawBody);
  const substitutedBody = substituteTestData(bodyHtml, testData);
  const substitutedSubject = substituteTestData(subj, testData);
  const html = substitutedBody + getUnsubscribeFooterHtml();

  const result = await sendEmail(recipient, substitutedSubject, html);
  if (!result.ok) return { ok: false, error: result.error ?? "Failed to send" };

  await supabase.from("admin_email_test_sends").insert({
    admin_id: adminId,
    sent_at: new Date().toISOString(),
  } as never);
  revalidatePath("/admin/emails");
  return { ok: true };
}
