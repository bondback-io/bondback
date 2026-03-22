"use server";

import { createServerSupabaseClient } from "@/lib/supabase/server";

type BackupResult =
  | { ok: true; backup: unknown }
  | { ok: false; error: string };

async function requireAdminForBackup() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return { ok: false as const, error: "Not authenticated", supabase: null };
  }

  const { data: profileData, error } = await supabase
    .from("profiles")
    .select("id, is_admin")
    .eq("id", session.user.id)
    .maybeSingle();

  if (error || !profileData || !(profileData as { is_admin?: boolean }).is_admin) {
    return { ok: false as const, error: "Not authorised", supabase: null };
  }

  return { ok: true as const, error: null, supabase };
}

export async function exportAdminBackup(): Promise<BackupResult> {
  const auth = await requireAdminForBackup();
  if (!auth.ok || !auth.supabase) {
    return { ok: false, error: auth.error ?? "Not authorised" };
  }

  const supabase = auth.supabase;

  try {
    const [profilesRes, listingsRes, jobsRes, bidsRes, notificationsRes] =
      await Promise.all([
        supabase
          .from("profiles")
          .select(
            "id, full_name, roles, active_role, is_admin, is_banned, is_deleted, created_at, updated_at"
          ),
        supabase.from("listings").select("*"),
        supabase.from("jobs").select("*"),
        supabase.from("bids").select("*"),
        supabase.from("notifications").select("*"),
      ]);

    if (profilesRes.error) throw profilesRes.error;
    if (listingsRes.error) throw listingsRes.error;
    if (jobsRes.error) throw jobsRes.error;
    if (bidsRes.error) throw bidsRes.error;
    if (notificationsRes.error) throw notificationsRes.error;

    const backup = {
      generated_at: new Date().toISOString(),
      version: 1,
      profiles: profilesRes.data ?? [],
      listings: listingsRes.data ?? [],
      jobs: jobsRes.data ?? [],
      bids: bidsRes.data ?? [],
      notifications: notificationsRes.data ?? [],
      // TODO: include reviews table once available
      // TODO: integrate Supabase Management API or pg_dump via edge function
    };

    return { ok: true, backup };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to create backup.";
    return { ok: false, error: message };
  }
}

