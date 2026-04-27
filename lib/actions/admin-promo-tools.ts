"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  createSupabaseAdminClient,
  getEmailForUserId,
  listAllAuthUsersPaginated,
} from "@/lib/supabase/admin";
import { logAdminActivity } from "@/lib/admin-activity-log";
import { getGlobalSettings } from "@/lib/actions/global-settings";
import { revalidateGlobalSettingsCache } from "@/lib/cache-revalidate";
import {
  isLaunchPromoWindowOpen,
  launchPromoFreeJobSlots,
  type GlobalSettingsWithLaunchPromo,
} from "@/lib/launch-promo";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function sanitizeSearch(q: string): string {
  return q.replace(/[^\w@.+\- ]/gi, "").trim().slice(0, 120);
}

type SuperAuth =
  | { ok: true; adminId: string; admin: NonNullable<ReturnType<typeof createSupabaseAdminClient>> }
  | { ok: false; error: string };

async function requireSuperAdmin(): Promise<SuperAuth> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) return { ok: false, error: "Not signed in." };

  const admin = createSupabaseAdminClient();
  if (!admin) return { ok: false, error: "Service role not configured." };

  const { data: row, error } = await admin
    .from("profiles")
    .select("is_admin, is_super_admin")
    .eq("id", user.id)
    .maybeSingle();

  if (error || !row) return { ok: false, error: "Profile not found." };

  const isAdmin =
    (row as { is_admin?: unknown }).is_admin === true ||
    ["true", "t", "1", "yes"].includes(
      String((row as { is_admin?: unknown }).is_admin ?? "")
        .toLowerCase()
        .trim()
    );
  const isSuper =
    (row as { is_super_admin?: unknown }).is_super_admin === true ||
    ["true", "t", "1", "yes"].includes(
      String((row as { is_super_admin?: unknown }).is_super_admin ?? "")
        .toLowerCase()
        .trim()
    );

  if (!isAdmin || !isSuper) return { ok: false, error: "Super admin only." };
  return { ok: true, adminId: user.id, admin };
}

export type PromoToolSearchUser = {
  id: string;
  email: string | null;
  full_name: string | null;
  launch_promo_lister_jobs_used: number;
  launch_promo_cleaner_jobs_used: number;
};

export async function searchPromoToolUsers(
  query: string
): Promise<{ ok: true; users: PromoToolSearchUser[] } | { ok: false; error: string }> {
  const auth = await requireSuperAdmin();
  if (!auth.ok) return { ok: false, error: auth.error };

  const q = sanitizeSearch(query);
  if (q.length < 2) return { ok: true, users: [] };

  const admin = auth.admin;
  const out: PromoToolSearchUser[] = [];
  const seen = new Set<string>();

  type PromoProfileSlice = {
    full_name?: string | null;
    launch_promo_lister_jobs_used?: number | null;
    launch_promo_cleaner_jobs_used?: number | null;
  };

  const pushProfile = async (id: string, p: PromoProfileSlice | null, emailFallback: string | null) => {
    if (seen.has(id)) return;
    seen.add(id);
    const email = (await getEmailForUserId(id)) ?? emailFallback;
    out.push({
      id,
      email,
      full_name: p?.full_name ?? null,
      launch_promo_lister_jobs_used: Math.max(
        0,
        Math.floor(Number(p?.launch_promo_lister_jobs_used ?? 0))
      ),
      launch_promo_cleaner_jobs_used: Math.max(
        0,
        Math.floor(Number(p?.launch_promo_cleaner_jobs_used ?? 0))
      ),
    });
  };

  if (UUID_RE.test(q)) {
    const { data: profile } = await admin
      .from("profiles")
      .select("id, full_name, launch_promo_lister_jobs_used, launch_promo_cleaner_jobs_used")
      .eq("id", q)
      .maybeSingle();
    if (profile) await pushProfile(q, profile, null);
  }

  const safePattern = `%${q.replace(/%/g, "")}%`;
  const { data: nameMatches } = await admin
    .from("profiles")
    .select("id, full_name, launch_promo_lister_jobs_used, launch_promo_cleaner_jobs_used")
    .ilike("full_name", safePattern)
    .limit(25);

  for (const p of nameMatches ?? []) {
    const id = (p as { id: string }).id;
    await pushProfile(id, p as PromoProfileSlice, null);
    if (out.length >= 30) break;
  }

  if (q.includes("@") && out.length < 30) {
    const allAuth = await listAllAuthUsersPaginated(admin);
    const lower = q.toLowerCase();
    for (const u of allAuth) {
      if (!u.email?.toLowerCase().includes(lower)) continue;
      if (seen.has(u.id)) continue;
      const { data: profile } = await admin
        .from("profiles")
        .select("id, full_name, launch_promo_lister_jobs_used, launch_promo_cleaner_jobs_used")
        .eq("id", u.id)
        .maybeSingle();
      const meta = (u.user_metadata ?? {}) as { full_name?: string };
      await pushProfile(u.id, profile as PromoProfileSlice | null, u.email ?? null);
      const last = out[out.length - 1];
      if (!profile && meta.full_name && last) {
        last.full_name = meta.full_name;
      }
      if (out.length >= 30) break;
    }
  }

  return { ok: true, users: out.slice(0, 30) };
}

export type PromoToolDetailResult =
  | {
      ok: true;
      user: {
        id: string;
        email: string | null;
        full_name: string | null;
        account_created_at: string | null;
        launch_promo_lister_jobs_used: number;
        launch_promo_cleaner_jobs_used: number;
        lister_slots_remaining: number;
        cleaner_slots_remaining: number;
      };
      global: {
        launch_promo_active: boolean;
        launch_promo_ends_at: string | null;
        launch_promo_free_job_slots: number;
        promo_window_open: boolean;
        days_remaining_calendar: number | null;
      };
    }
  | { ok: false; error: string };

export async function getPromoToolUserDetail(userId: string): Promise<PromoToolDetailResult> {
  const auth = await requireSuperAdmin();
  if (!auth.ok) return { ok: false, error: auth.error };

  const uid = String(userId).trim();
  if (!UUID_RE.test(uid)) return { ok: false, error: "Invalid user id." };

  const gs = await getGlobalSettings();
  const now = new Date();
  const settings = gs as GlobalSettingsWithLaunchPromo | null;
  const freeSlots = launchPromoFreeJobSlots(settings);
  const promoOpen = isLaunchPromoWindowOpen(settings, now);

  const email = await getEmailForUserId(uid);
  const { data: profile } = await auth.admin
    .from("profiles")
    .select("full_name, created_at, launch_promo_lister_jobs_used, launch_promo_cleaner_jobs_used")
    .eq("id", uid)
    .maybeSingle();

  const listerUsed = Math.max(
    0,
    Math.floor(Number((profile as { launch_promo_lister_jobs_used?: number } | null)?.launch_promo_lister_jobs_used ?? 0))
  );
  const cleanerUsed = Math.max(
    0,
    Math.floor(Number((profile as { launch_promo_cleaner_jobs_used?: number } | null)?.launch_promo_cleaner_jobs_used ?? 0))
  );

  let daysRemaining: number | null = null;
  const endRaw = gs?.launch_promo_ends_at;
  if (endRaw != null && String(endRaw).trim()) {
    const t = new Date(endRaw).getTime();
    if (Number.isFinite(t)) {
      daysRemaining = Math.ceil((t - now.getTime()) / 86400000);
      if (daysRemaining < 0) daysRemaining = 0;
    }
  }

  return {
    ok: true,
    user: {
      id: uid,
      email,
      full_name: (profile as { full_name?: string | null } | null)?.full_name ?? null,
      account_created_at: (profile as { created_at?: string } | null)?.created_at ?? null,
      launch_promo_lister_jobs_used: listerUsed,
      launch_promo_cleaner_jobs_used: cleanerUsed,
      lister_slots_remaining: promoOpen ? Math.max(0, freeSlots - listerUsed) : 0,
      cleaner_slots_remaining: promoOpen ? Math.max(0, freeSlots - cleanerUsed) : 0,
    },
    global: {
      launch_promo_active: gs?.launch_promo_active !== false,
      launch_promo_ends_at: gs?.launch_promo_ends_at ?? null,
      launch_promo_free_job_slots: freeSlots,
      promo_window_open: promoOpen,
      days_remaining_calendar: daysRemaining,
    },
  };
}

function addDaysUtcIso(base: Date, days: number): string {
  const x = new Date(base.getTime());
  x.setUTCDate(x.getUTCDate() + days);
  return x.toISOString();
}

export async function resetUserLaunchPromoCounters(
  userId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const auth = await requireSuperAdmin();
  if (!auth.ok) return { ok: false, error: auth.error };

  const uid = String(userId).trim();
  if (!UUID_RE.test(uid)) return { ok: false, error: "Invalid user id." };

  const { data: beforeRow } = await auth.admin
    .from("profiles")
    .select("launch_promo_lister_jobs_used, launch_promo_cleaner_jobs_used")
    .eq("id", uid)
    .maybeSingle();

  const before = {
    launch_promo_lister_jobs_used: Math.max(
      0,
      Math.floor(
        Number((beforeRow as { launch_promo_lister_jobs_used?: number } | null)?.launch_promo_lister_jobs_used ?? 0)
      )
    ),
    launch_promo_cleaner_jobs_used: Math.max(
      0,
      Math.floor(
        Number((beforeRow as { launch_promo_cleaner_jobs_used?: number } | null)?.launch_promo_cleaner_jobs_used ?? 0)
      )
    ),
  };

  const { error } = await auth.admin
    .from("profiles")
    .update({
      launch_promo_lister_jobs_used: 0,
      launch_promo_cleaner_jobs_used: 0,
      updated_at: new Date().toISOString(),
    } as never)
    .eq("id", uid);

  if (error) return { ok: false, error: error.message };

  await logAdminActivity({
    adminId: auth.adminId,
    actionType: "launch_promo_user_counters_reset",
    targetType: "user",
    targetId: uid,
    details: {
      previous_state: before,
      new_state: { launch_promo_lister_jobs_used: 0, launch_promo_cleaner_jobs_used: 0 },
    },
  });

  revalidatePath("/admin/promo-tools");
  return { ok: true };
}

export async function extendGlobalLaunchPromo30Days(): Promise<
  { ok: true; new_launch_promo_ends_at: string } | { ok: false; error: string }
> {
  const auth = await requireSuperAdmin();
  if (!auth.ok) return { ok: false, error: auth.error };

  const { data: row } = await auth.admin
    .from("global_settings")
    .select("launch_promo_active, launch_promo_ends_at")
    .eq("id", 1)
    .maybeSingle();

  const before = {
    launch_promo_active: (row as { launch_promo_active?: boolean | null } | null)?.launch_promo_active !== false,
    launch_promo_ends_at: (row as { launch_promo_ends_at?: string | null } | null)?.launch_promo_ends_at ?? null,
  };

  const now = new Date();
  let newEnd: string;
  if (before.launch_promo_ends_at != null && String(before.launch_promo_ends_at).trim()) {
    const cur = new Date(before.launch_promo_ends_at);
    newEnd = addDaysUtcIso(Number.isFinite(cur.getTime()) ? cur : now, 30);
  } else {
    newEnd = addDaysUtcIso(now, 30);
  }

  const { error } = await auth.admin
    .from("global_settings")
    .update({
      launch_promo_active: true,
      launch_promo_ends_at: newEnd,
    } as never)
    .eq("id", 1);

  if (error) return { ok: false, error: error.message };

  await logAdminActivity({
    adminId: auth.adminId,
    actionType: "launch_promo_global_extend_30d",
    targetType: "other",
    targetId: null,
    details: {
      previous_state: before,
      new_state: { launch_promo_active: true, launch_promo_ends_at: newEnd },
    },
  });

  revalidateGlobalSettingsCache();
  revalidatePath("/admin/global-settings");
  revalidatePath("/admin/promo-tools");
  return { ok: true, new_launch_promo_ends_at: newEnd };
}

export async function forceEndGlobalLaunchPromo(): Promise<{ ok: true } | { ok: false; error: string }> {
  const auth = await requireSuperAdmin();
  if (!auth.ok) return { ok: false, error: auth.error };

  const { data: row } = await auth.admin
    .from("global_settings")
    .select("launch_promo_active, launch_promo_ends_at")
    .eq("id", 1)
    .maybeSingle();

  const before = {
    launch_promo_active: (row as { launch_promo_active?: boolean | null } | null)?.launch_promo_active !== false,
    launch_promo_ends_at: (row as { launch_promo_ends_at?: string | null } | null)?.launch_promo_ends_at ?? null,
  };

  const nowIso = new Date().toISOString();

  const { error } = await auth.admin
    .from("global_settings")
    .update({
      launch_promo_active: false,
      launch_promo_ends_at: nowIso,
    } as never)
    .eq("id", 1);

  if (error) return { ok: false, error: error.message };

  await logAdminActivity({
    adminId: auth.adminId,
    actionType: "launch_promo_global_force_end",
    targetType: "other",
    targetId: null,
    details: {
      previous_state: before,
      new_state: { launch_promo_active: false, launch_promo_ends_at: nowIso },
    },
  });

  revalidateGlobalSettingsCache();
  revalidatePath("/admin/global-settings");
  revalidatePath("/admin/promo-tools");
  return { ok: true };
}

export async function undoLastGlobalLaunchPromoChange(): Promise<{ ok: true } | { ok: false; error: string }> {
  const auth = await requireSuperAdmin();
  if (!auth.ok) return { ok: false, error: auth.error };

  const { data: rows } = await auth.admin
    .from("admin_activity_log")
    .select("id, action_type, details")
    .in("action_type", ["launch_promo_global_extend_30d", "launch_promo_global_force_end"])
    .order("created_at", { ascending: false })
    .limit(1);

  const row = rows?.[0] as
    | {
        id: string;
        details: {
          previous_state?: { launch_promo_active?: boolean; launch_promo_ends_at?: string | null };
        };
      }
    | undefined;

  const prev = row?.details?.previous_state;
  if (prev == null || typeof prev.launch_promo_active !== "boolean") {
    return { ok: false, error: "No reversible global promo change found in the log." };
  }

  const endsAt =
    prev.launch_promo_ends_at === undefined ? null : prev.launch_promo_ends_at;

  const { error } = await auth.admin
    .from("global_settings")
    .update({
      launch_promo_active: prev.launch_promo_active,
      launch_promo_ends_at: endsAt,
    } as never)
    .eq("id", 1);

  if (error) return { ok: false, error: error.message };

  await logAdminActivity({
    adminId: auth.adminId,
    actionType: "launch_promo_global_undo",
    targetType: "other",
    targetId: row?.id ?? null,
    details: { restored: prev, source_log_id: row?.id },
  });

  revalidateGlobalSettingsCache();
  revalidatePath("/admin/global-settings");
  revalidatePath("/admin/promo-tools");
  return { ok: true };
}

export async function undoLastUserLaunchPromoCounterReset(
  targetUserId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const auth = await requireSuperAdmin();
  if (!auth.ok) return { ok: false, error: auth.error };

  const uid = String(targetUserId).trim();
  if (!UUID_RE.test(uid)) return { ok: false, error: "Invalid user id." };

  const { data: rows } = await auth.admin
    .from("admin_activity_log")
    .select("id, details")
    .eq("action_type", "launch_promo_user_counters_reset")
    .eq("target_id", uid)
    .order("created_at", { ascending: false })
    .limit(1);

  const details = (
    rows?.[0] as {
      details?: {
        previous_state?: { launch_promo_lister_jobs_used?: number; launch_promo_cleaner_jobs_used?: number };
      };
    } | undefined
  )?.details;

  const prev = details?.previous_state;
  if (
    prev == null ||
    typeof prev.launch_promo_lister_jobs_used !== "number" ||
    typeof prev.launch_promo_cleaner_jobs_used !== "number"
  ) {
    return { ok: false, error: "No reversible counter reset found for this user." };
  }

  const lister = Math.max(0, Math.min(32767, Math.floor(prev.launch_promo_lister_jobs_used)));
  const cleaner = Math.max(0, Math.min(32767, Math.floor(prev.launch_promo_cleaner_jobs_used)));

  const { error } = await auth.admin
    .from("profiles")
    .update({
      launch_promo_lister_jobs_used: lister,
      launch_promo_cleaner_jobs_used: cleaner,
      updated_at: new Date().toISOString(),
    } as never)
    .eq("id", uid);

  if (error) return { ok: false, error: error.message };

  await logAdminActivity({
    adminId: auth.adminId,
    actionType: "launch_promo_user_counters_undo",
    targetType: "user",
    targetId: uid,
    details: { restored: { launch_promo_lister_jobs_used: lister, launch_promo_cleaner_jobs_used: cleaner } },
  });

  revalidatePath("/admin/promo-tools");
  return { ok: true };
}
