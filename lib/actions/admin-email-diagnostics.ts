"use server";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getGlobalSettings } from "@/lib/actions/global-settings";
import { DEFAULT_RESEND_FROM } from "@/lib/email-default-from";

export type EmailDiagnosticsData = {
  hasResendApiKey: boolean;
  hasServiceRoleKey: boolean;
  hasSupabaseUrl: boolean;
  resendFromDisplay: string;
  replyToSet: boolean;
  appUrlDisplay: string;
  emailsEnabledGlobally: boolean;
  lastFailure: {
    sent_at: string;
    type: string;
    subject: string | null;
    error_message: string | null;
  } | null;
  failedLast24h: number;
  emailLogsReachable: boolean;
};

/**
 * Admin-only: safe env flags (no secrets) + last failed row from `email_logs`.
 */
export async function getEmailDiagnostics(): Promise<
  { ok: true; data: EmailDiagnosticsData } | { ok: false; error: string }
> {
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
  if (!(profile as { is_admin?: boolean } | null)?.is_admin) {
    return { ok: false, error: "Not authorised" };
  }

  const globalSettings = await getGlobalSettings();
  const admin = createSupabaseAdminClient();

  let lastFailure: EmailDiagnosticsData["lastFailure"] = null;
  let failedLast24h = 0;
  let emailLogsReachable = false;

  if (admin) {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count, error: countErr } = await admin
      .from("email_logs")
      .select("id", { count: "exact", head: true })
      .eq("status", "failed")
      .gte("sent_at", oneDayAgo);
    if (!countErr) {
      emailLogsReachable = true;
      failedLast24h = count ?? 0;
    }

    const { data: failRow, error: failErr } = await admin
      .from("email_logs")
      .select("sent_at, type, subject, error_message")
      .eq("status", "failed")
      .order("sent_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!failErr && failRow) {
      emailLogsReachable = true;
      const f = failRow as {
        sent_at: string;
        type: string;
        subject: string | null;
        error_message: string | null;
      };
      lastFailure = {
        sent_at: f.sent_at,
        type: f.type,
        subject: f.subject,
        error_message: f.error_message,
      };
    } else if (!failErr) {
      emailLogsReachable = true;
    }
  }

  const data: EmailDiagnosticsData = {
    hasResendApiKey: Boolean(process.env.RESEND_API_KEY?.trim()),
    hasServiceRoleKey: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()),
    hasSupabaseUrl: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()),
    resendFromDisplay:
      process.env.RESEND_FROM?.trim() || `${DEFAULT_RESEND_FROM} (default)`,
    replyToSet: Boolean(process.env.RESEND_REPLY_TO?.trim()),
    appUrlDisplay:
      process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://www.bondback.io (default when unset)",
    emailsEnabledGlobally: globalSettings?.emails_enabled !== false,
    lastFailure,
    failedLast24h,
    emailLogsReachable,
  };

  return { ok: true, data };
}
