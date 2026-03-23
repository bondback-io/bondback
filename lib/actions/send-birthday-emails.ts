"use server";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getEmailForUserId } from "@/lib/supabase/admin";
import { getGlobalSettings, getEmailTemplateOverrides } from "@/lib/actions/global-settings";
import { getDefaultTemplate } from "@/lib/default-email-templates";
import { sendEmail } from "@/lib/notifications/email";
import { markdownToHtml } from "@/lib/markdown";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://bondback.com";
const UNSUBSCRIBE_PATH = "/profile";

function unsubscribeFooter(): string {
  return `
<div style="margin-top:2em;padding-top:1em;border-top:1px solid #eee;font-size:12px;color:#666;">
  <p>You received this email because of your Bond Back account.</p>
  <p><a href="${APP_URL}${UNSUBSCRIBE_PATH}">Manage notification preferences</a></p>
</div>`;
}

function replaceName(text: string, name: string): string {
  return text.replace(/\{name\}/gi, name || "there");
}

/**
 * Send birthday emails to all users whose date_of_birth is today (month/day).
 * Call from a daily cron (e.g. Vercel Cron or Supabase pg_cron).
 * Uses the admin "birthday" email template; respects global emails_enabled and template active flag.
 */
export async function sendBirthdayEmailsForToday(): Promise<{
  ok: boolean;
  sent: number;
  skipped: number;
  error?: string;
}> {
  const settings = await getGlobalSettings();
  if (settings?.emails_enabled === false) {
    return { ok: true, sent: 0, skipped: 0 };
  }

  const { email_templates } = await getEmailTemplateOverrides();
  const birthdayOverride = email_templates?.birthday;
  const defaultBirthday = getDefaultTemplate("birthday");

  const subject = birthdayOverride?.active && birthdayOverride.subject?.trim()
    ? birthdayOverride.subject.trim()
    : defaultBirthday?.subject ?? "Happy Birthday! – Bond Back";
  const bodyRaw = birthdayOverride?.active && birthdayOverride.body?.trim()
    ? birthdayOverride.body.trim()
    : defaultBirthday?.body ?? "Hi {name},\n\nHappy Birthday from Bond Back!";

  const admin = createSupabaseAdminClient();
  if (!admin) return { ok: false, sent: 0, skipped: 0, error: "Admin client not configured" };

  const today = new Date();
  const month = today.getUTCMonth() + 1;
  const day = today.getUTCDate();

  const { data: profiles, error: fetchError } = await admin
    .from("profiles")
    .select("id, full_name, date_of_birth")
    .not("date_of_birth", "is", null);

  if (fetchError) {
    return { ok: false, sent: 0, skipped: 0, error: fetchError.message };
  }

  const birthdayToday = (profiles ?? []).filter((p: { date_of_birth?: string | null }) => {
    if (!p.date_of_birth) return false;
    const d = new Date(p.date_of_birth + "T12:00:00Z");
    return d.getUTCMonth() + 1 === month && d.getUTCDate() === day;
  });

  let sent = 0;
  let skipped = 0;

  for (const profile of birthdayToday) {
    const userId = (profile as { id: string }).id;
    const fullName = (profile as { full_name?: string | null }).full_name?.trim() || "there";
    const toEmail = await getEmailForUserId(userId);
    if (!toEmail) {
      skipped++;
      continue;
    }

    const subj = replaceName(subject, fullName);
    const bodyHtml = markdownToHtml(replaceName(bodyRaw, fullName));
    const html = bodyHtml + unsubscribeFooter();

    const result = await sendEmail(toEmail, subj, html);
    if (result.ok) sent++;
    else skipped++;
  }

  return { ok: true, sent, skipped };
}
