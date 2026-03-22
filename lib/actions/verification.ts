"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { logAdminActivity } from "@/lib/admin-activity-log";
import {
  type VerificationBadgeType,
  normalizeVerificationBadges,
} from "@/lib/verification-badges";

async function requireAdmin() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return { ok: false as const, error: "Not authenticated", adminId: null, supabase };
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", session.user.id)
    .maybeSingle();
  if (!profile || !(profile as { is_admin?: boolean }).is_admin) {
    return { ok: false as const, error: "Not authorised", adminId: null, supabase };
  }
  return { ok: true as const, adminId: session.user.id, supabase };
}

export async function syncCurrentUserEmailVerification(): Promise<void> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return;
  const isVerified = Boolean(session.user.email_confirmed_at);
  await supabase
    .from("profiles")
    .update({ is_email_verified: isVerified } as never)
    .eq("id", session.user.id as never);
}

export async function recomputeVerificationBadgesForUser(userId: string): Promise<void> {
  const admin = createSupabaseAdminClient();
  if (!admin) return;

  const { data: profile } = await admin
    .from("profiles")
    .select("id, roles, abn, cleaner_avg_rating, verification_badges, is_email_verified")
    .eq("id", userId)
    .maybeSingle();
  if (!profile) return;

  const roles = ((profile as { roles?: string[] | null }).roles ?? []) as string[];
  const isCleaner = roles.includes("cleaner");
  const isLister = roles.includes("lister");
  const existing = normalizeVerificationBadges(
    (profile as { verification_badges?: string[] | null }).verification_badges
  );
  const next = [...existing];
  const addIfMissing = (badge: VerificationBadgeType) => {
    if (!next.includes(badge)) next.push(badge);
  };

  const abnDigits = String((profile as { abn?: string | null }).abn ?? "")
    .replace(/\D/g, "")
    .trim();
  if (isCleaner && abnDigits.length === 11) addIfMissing("abn_verified");
  if ((profile as { is_email_verified?: boolean | null }).is_email_verified === true) {
    addIfMissing("email_verified");
  }

  if (isCleaner) {
    const { count: completedJobsCount } = await admin
      .from("jobs")
      .select("id", { count: "exact", head: true })
      .eq("winner_id", userId)
      .eq("status", "completed");
    const rating = Number((profile as { cleaner_avg_rating?: number | null }).cleaner_avg_rating ?? 0);
    if ((completedJobsCount ?? 0) >= 10 && rating >= 4.5) {
      addIfMissing("trusted_cleaner");
    }
  }

  if (isLister) {
    const { count: completedNoDisputeCount } = await admin
      .from("jobs")
      .select("id", { count: "exact", head: true })
      .eq("lister_id", userId)
      .eq("status", "completed")
      .is("dispute_reason", null);
    if ((completedNoDisputeCount ?? 0) >= 5) {
      addIfMissing("verified_lister");
    }
  }

  await admin
    .from("profiles")
    .update({ verification_badges: next } as never)
    .eq("id", userId);
}

export async function verifyUser(
  userId: string,
  badgeType: VerificationBadgeType,
  verified: boolean
): Promise<{ ok: true } | { ok: false; error: string }> {
  const auth = await requireAdmin();
  if (!auth.ok) return { ok: false, error: auth.error };
  const { supabase, adminId } = auth;

  const { data: row, error } = await supabase
    .from("profiles")
    .select("verification_badges")
    .eq("id", userId)
    .maybeSingle();
  if (error || !row) return { ok: false, error: error?.message ?? "User not found." };

  const current = normalizeVerificationBadges((row as any).verification_badges);
  const next = verified
    ? Array.from(new Set([...current, badgeType]))
    : current.filter((b) => b !== badgeType);

  const { error: updateError } = await supabase
    .from("profiles")
    .update({ verification_badges: next } as never)
    .eq("id", userId);
  if (updateError) return { ok: false, error: updateError.message };

  await logAdminActivity({
    adminId: adminId!,
    actionType: "user_verification_override",
    targetType: "user",
    targetId: userId,
    details: { badgeType, verified },
  });

  revalidatePath("/admin/users");
  revalidatePath(`/admin/users/${userId}`);
  revalidatePath("/profile");
  return { ok: true };
}

