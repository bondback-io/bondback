"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/types/supabase";
import {
  ADMIN_NOTIFICATION_LOG_PAGE_SIZE,
  type AdminEmailLogRow,
  type AdminInAppNotificationRow,
  type ProfileNameMap,
} from "@/lib/admin/admin-notification-logs-shared";

async function requireAdminSession(): Promise<
  | { ok: true; supabase: Awaited<ReturnType<typeof createServerSupabaseClient>> }
  | { ok: false; error: string }
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
  return { ok: true, supabase };
}

async function fetchProfilesForIds(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  ids: string[]
): Promise<ProfileNameMap> {
  const unique = Array.from(new Set(ids.filter(Boolean)));
  if (unique.length === 0) return {};
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name")
    .in("id", unique);
  const out: ProfileNameMap = {};
  (profiles ?? []).forEach((p: { id: string; full_name: string | null }) => {
    out[p.id] = { full_name: p.full_name };
  });
  return out;
}

/**
 * Admin-only: next page of `email_logs` (newest first), for “Load more” on /admin/notifications.
 * `offset` = number of rows already shown (must be ≥ page size after the first batch).
 */
export async function loadMoreEmailLogsForAdmin(
  offset: number
): Promise<
  | { ok: true; rows: AdminEmailLogRow[]; profiles: ProfileNameMap }
  | { ok: false; error: string }
> {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth;

  if (
    !Number.isFinite(offset) ||
    offset < ADMIN_NOTIFICATION_LOG_PAGE_SIZE ||
    offset % ADMIN_NOTIFICATION_LOG_PAGE_SIZE !== 0
  ) {
    return { ok: false, error: "Invalid offset" };
  }

  const admin = createSupabaseAdminClient();
  const client = (admin ?? auth.supabase) as SupabaseClient<Database>;

  const from = offset;
  const to = offset + ADMIN_NOTIFICATION_LOG_PAGE_SIZE - 1;

  const { data, error } = await client
    .from("email_logs")
    .select("id, user_id, type, sent_at, subject")
    .order("sent_at", { ascending: false })
    .range(from, to);

  if (error) {
    console.error("[loadMoreEmailLogsForAdmin]", error.message);
    return { ok: false, error: "Could not load email log" };
  }

  const rows = (data ?? []) as AdminEmailLogRow[];
  const profiles = await fetchProfilesForIds(
    auth.supabase,
    rows.map((r) => r.user_id)
  );

  return { ok: true, rows, profiles };
}

/**
 * Admin-only: next page of `notifications` (newest first), for “Load more” on /admin/notifications.
 */
export async function loadMoreInAppNotificationsForAdmin(
  offset: number
): Promise<
  | { ok: true; rows: AdminInAppNotificationRow[]; profiles: ProfileNameMap }
  | { ok: false; error: string }
> {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth;

  if (
    !Number.isFinite(offset) ||
    offset < ADMIN_NOTIFICATION_LOG_PAGE_SIZE ||
    offset % ADMIN_NOTIFICATION_LOG_PAGE_SIZE !== 0
  ) {
    return { ok: false, error: "Invalid offset" };
  }

  const from = offset;
  const to = offset + ADMIN_NOTIFICATION_LOG_PAGE_SIZE - 1;

  const { data, error } = await auth.supabase
    .from("notifications")
    .select("id, user_id, type, job_id, message_text, is_read, created_at")
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error) {
    console.error("[loadMoreInAppNotificationsForAdmin]", error.message);
    return { ok: false, error: "Could not load in-app log" };
  }

  const rows = (data ?? []) as AdminInAppNotificationRow[];
  const profiles = await fetchProfilesForIds(
    auth.supabase,
    rows.map((r) => r.user_id)
  );

  return { ok: true, rows, profiles };
}
