"use server";

import type { Session } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { sendWelcomeEmailAfterEmailVerification } from "@/lib/actions/onboarding-transactional-emails";
import { createNotification } from "@/lib/actions/notifications";
import { logAdminActivity } from "@/lib/admin-activity-log";
import { getSupportContactEmail } from "@/lib/support-contact-email";
import type {
  BanResult,
  DeleteUserResult,
  EditRoleResult,
  UnbanResult,
} from "@/lib/actions/admin-users-types";

async function requireAdmin(supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return { ok: false as const, error: "Not authenticated", adminId: null };
  const supabaseAdmin = createSupabaseAdminClient();
  const { data: profile } = supabaseAdmin
    ? await supabaseAdmin
        .from("profiles")
        .select("is_admin")
        .eq("id", session.user.id)
        .maybeSingle()
    : await supabase
        .from("profiles")
        .select("is_admin")
        .eq("id", session.user.id)
        .maybeSingle();
  if (!profile || !(profile as { is_admin?: boolean }).is_admin)
    return { ok: false as const, error: "Not authorised", adminId: null };
  return { ok: true as const, adminId: session.user.id };
}

function requireServiceRole() {
  const supabaseAdmin = createSupabaseAdminClient();
  if (!supabaseAdmin) {
    return {
      ok: false as const,
      error:
        "SUPABASE_SERVICE_ROLE_KEY is not configured. Admin user updates require the service role client.",
    };
  }
  return { ok: true as const, supabaseAdmin };
}

/** Admin only: ban user with reason. Double-confirm in UI before calling. */
export async function banUser(
  userId: string,
  reason: string
): Promise<BanResult> {
  const supabase = await createServerSupabaseClient();
  const auth = await requireAdmin(supabase);
  if (!auth.ok) return { ok: false, error: auth.error };
  const adminId = auth.adminId!;
  const db = requireServiceRole();
  if (!db.ok) return { ok: false, error: db.error };

  const trimmed = (reason ?? "").trim();
  if (!trimmed) return { ok: false, error: "Reason is required." };
  if (userId === adminId) return { ok: false, error: "You cannot ban yourself." };

  const now = new Date().toISOString();
  const { error } = await db.supabaseAdmin
    .from("profiles")
    .update({
      is_banned: true,
      banned_at: now,
      banned_reason: trimmed,
      banned_by: adminId,
    } as Record<string, unknown>)
    .eq("id", userId);

  if (error) return { ok: false, error: error.message };
  await logAdminActivity({ adminId, actionType: "user_banned", targetType: "user", targetId: userId, details: { reason: trimmed } });

  const message = `Your account has been banned for: ${trimmed}. Contact ${getSupportContactEmail()}.`;
  await createNotification(userId, "new_message", null, message);

  revalidatePath("/admin/users");
  revalidatePath("/admin/dashboard");
  return { ok: true };
}

/** Admin only: unban user. Clear banned_at, banned_reason, banned_by. */
export async function unbanUser(userId: string): Promise<UnbanResult> {
  const supabase = await createServerSupabaseClient();
  const auth = await requireAdmin(supabase);
  if (!auth.ok) return { ok: false, error: auth.error };
  const db = requireServiceRole();
  if (!db.ok) return { ok: false, error: db.error };

  const { error } = await db.supabaseAdmin
    .from("profiles")
    .update({
      is_banned: false,
      banned_at: null,
      banned_reason: null,
      banned_by: null,
    } as Record<string, unknown>)
    .eq("id", userId);

  if (error) return { ok: false, error: error.message };
  await logAdminActivity({ adminId: auth.adminId!, actionType: "user_unbanned", targetType: "user", targetId: userId, details: {} });
  revalidatePath("/admin/users");
  revalidatePath("/admin/dashboard");
  return { ok: true };
}

/** Call after sign-in to check if current user is banned; used by login page. */
export async function checkBanAfterLogin(): Promise<
  { banned: false } | { banned: true; reason: string | null }
> {
  const supabase = await createServerSupabaseClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return { banned: false };

  const { data: row } = await supabase
    .from("profiles")
    .select("is_banned, banned_reason")
    .eq("id", session.user.id)
    .maybeSingle();

  const profile = row as { is_banned?: boolean; banned_reason?: string | null } | null;
  if (!profile || !profile.is_banned) return { banned: false };
  return { banned: true, reason: profile.banned_reason ?? null };
}

function chunkIds<T>(ids: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < ids.length; i += size) out.push(ids.slice(i, i + size));
  return out;
}

/**
 * Admin only: permanently remove a user — public data first, then `auth.users` (service role).
 * Does not delete another admin (demote first).
 */
export async function adminDeleteUser(userId: string): Promise<DeleteUserResult> {
  const supabase = await createServerSupabaseClient();
  const auth = await requireAdmin(supabase);
  if (!auth.ok) return { ok: false, error: auth.error };
  if (userId === auth.adminId) return { ok: false, error: "Cannot delete your own account." };
  const db = requireServiceRole();
  if (!db.ok) return { ok: false, error: db.error };

  const admin = db.supabaseAdmin;
  const dbx = admin as any;

  const { data: targetProfile } = await admin
    .from("profiles")
    .select("is_admin")
    .eq("id", userId)
    .maybeSingle();

  if (targetProfile && (targetProfile as { is_admin?: boolean }).is_admin) {
    return { ok: false, error: "Cannot delete an admin account. Demote the user first." };
  }

  const { data: listingRows } = await admin.from("listings").select("id").eq("lister_id", userId);
  const listingIds = (listingRows ?? []).map((r: { id: string }) => r.id);

  const { data: jLister } = await admin.from("jobs").select("id").eq("lister_id", userId);
  const { data: jWinner } = await admin.from("jobs").select("id").eq("winner_id", userId);
  const { data: jListing } =
    listingIds.length > 0
      ? await admin.from("jobs").select("id").in("listing_id", listingIds)
      : { data: [] as { id: number }[] };

  const jobIdSet = new Set<number>();
  for (const j of jLister ?? []) jobIdSet.add((j as { id: number }).id);
  for (const j of jWinner ?? []) jobIdSet.add((j as { id: number }).id);
  for (const j of jListing ?? []) jobIdSet.add((j as { id: number }).id);
  const jobIds = [...jobIdSet];

  async function deleteForJobBatch(batch: number[]) {
    if (batch.length === 0) return;
    await dbx.from("referral_rewards").delete().in("job_id", batch);
    await admin.from("reviews").delete().in("job_id", batch);
    await admin.from("notifications").delete().in("job_id", batch);
    await dbx.from("notification_email_rate_limit").delete().in("job_id", batch);
    await dbx.from("last_job_view").delete().in("job_id", batch);
    await dbx.from("job_checklist_items").delete().in("job_id", batch);
    await admin.from("job_messages").delete().in("job_id", batch);
    await admin.from("jobs").delete().in("id", batch);
  }

  for (const batch of chunkIds(jobIds, 80)) {
    await deleteForJobBatch(batch);
  }

  await admin.from("reviews").delete().eq("reviewer_id", userId);
  await admin.from("reviews").delete().eq("reviewee_id", userId);

  await dbx.from("referral_rewards").delete().eq("referred_user_id", userId);
  await dbx.from("referral_rewards").delete().eq("referrer_id", userId);

  await admin.from("notifications").delete().eq("user_id", userId);
  await admin.from("bids").delete().eq("cleaner_id", userId);
  if (listingIds.length > 0) {
    for (const batch of chunkIds(listingIds, 80)) {
      await admin.from("bids").delete().in("listing_id", batch);
    }
  }

  if (listingIds.length > 0) {
    for (const batch of chunkIds(listingIds, 80)) {
      await admin.from("listings").delete().in("id", batch);
    }
  }

  await admin.from("email_logs").delete().eq("user_id", userId);
  await admin.from("support_tickets").delete().eq("user_id", userId);
  await dbx.from("notification_email_rate_limit").delete().eq("user_id", userId);
  await dbx.from("last_job_view").delete().eq("user_id", userId);
  await dbx.from("admin_email_test_sends").delete().eq("admin_id", userId);

  await admin
    .from("profiles")
    .update({ banned_by: null } as Record<string, unknown>)
    .eq("banned_by", userId);
  await admin
    .from("profiles")
    .update({ referred_by: null } as Record<string, unknown>)
    .eq("referred_by", userId);

  await dbx.from("global_settings").update({ updated_by: null }).eq("updated_by", userId);

  await dbx.from("admin_activity_log").delete().eq("admin_id", userId);
  await dbx.from("admin_activity_log").delete().eq("target_type", "user").eq("target_id", userId);

  const { error: authErr } = await admin.auth.admin.deleteUser(userId);
  if (authErr) {
    return { ok: false, error: authErr.message ?? "Failed to delete auth user." };
  }

  await logAdminActivity({
    adminId: auth.adminId!,
    actionType: "user_deleted",
    targetType: "user",
    targetId: userId,
    details: { permanent: true },
  });
  revalidatePath("/admin/users");
  revalidatePath("/admin/dashboard");
  return { ok: true };
}

/** Admin only: set roles and active_role. role = "lister" | "cleaner" | "admin". */
export async function adminEditRole(
  userId: string,
  role: "lister" | "cleaner" | "admin"
): Promise<EditRoleResult> {
  const supabase = await createServerSupabaseClient();
  const auth = await requireAdmin(supabase);
  if (!auth.ok) return { ok: false, error: auth.error };
  const db = requireServiceRole();
  if (!db.ok) return { ok: false, error: db.error };

  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (role === "admin") {
    updates.roles = ["lister", "cleaner"];
    updates.active_role = "lister";
    updates.is_admin = true;
  } else {
    updates.is_admin = false;
    updates.roles = role === "cleaner" ? ["cleaner", "lister"] : ["lister", "cleaner"];
    updates.active_role = role;
  }

  const { error } = await db.supabaseAdmin
    .from("profiles")
    .update(updates)
    .eq("id", userId);

  if (error) return { ok: false, error: error.message };
  await logAdminActivity({ adminId: auth.adminId!, actionType: "user_role_updated", targetType: "user", targetId: userId, details: { role } });
  revalidatePath("/admin/users");
  revalidatePath("/admin/users/" + userId);
  revalidatePath("/admin/dashboard");
  return { ok: true };
}

/** Admin only: resend the signup welcome email (testing / support). Ignores email_welcome_sent. */
export async function adminResendWelcomeEmail(
  userId: string
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createServerSupabaseClient();
  const auth = await requireAdmin(supabase);
  if (!auth.ok) return { ok: false, error: auth.error };
  const db = requireServiceRole();
  if (!db.ok) return { ok: false, error: db.error };

  const { data: userData, error } = await db.supabaseAdmin.auth.admin.getUserById(userId);
  if (error || !userData?.user?.email) {
    return { ok: false, error: error?.message ?? "User not found or has no email." };
  }

  const session = { user: userData.user } as Session;
  const result = await sendWelcomeEmailAfterEmailVerification({
    userId,
    session,
    force: true,
    trigger: "admin_resend",
  });

  if (result.ok) {
    await logAdminActivity({
      adminId: auth.adminId!,
      actionType: "user_welcome_email_resent",
      targetType: "user",
      targetId: userId,
      details: {},
    });
    revalidatePath("/admin/users");
    revalidatePath(`/admin/users/${userId}`);
    return { ok: true };
  }

  return {
    ok: false,
    error: result.error ?? result.skipped ?? "Welcome email was not sent.",
  };
}
