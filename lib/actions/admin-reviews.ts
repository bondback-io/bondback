"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/types/supabase";
import { profileFieldIsAdmin } from "@/lib/is-admin";
import { logAdminActivity } from "@/lib/admin-activity-log";
import { recomputeAllProfileReviewAggregates } from "@/lib/actions/reviews";

type ReviewsRow = Database["public"]["Tables"]["reviews"]["Row"];

async function requireAdminActor(): Promise<{ adminId: string }> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.user?.id) throw new Error("Not authenticated");
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", session.user.id)
    .maybeSingle();
  if (!profile || !profileFieldIsAdmin((profile as { is_admin?: unknown }).is_admin)) {
    throw new Error("Not authorised");
  }
  return { adminId: session.user.id };
}

export type AdminReviewModerationResult = { ok: true } | { ok: false; error: string };

export async function adminUpdateReviewModeration(input: {
  reviewId: number;
  is_approved?: boolean;
  is_hidden?: boolean;
  is_flagged?: boolean;
  moderation_note?: string | null;
}): Promise<AdminReviewModerationResult> {
  try {
    const { adminId } = await requireAdminActor();
    const admin = createSupabaseAdminClient();
    if (!admin) return { ok: false, error: "Service role not configured." };

    const { data: row, error: fetchErr } = await admin
      .from("reviews")
      .select("id, reviewee_id, reviewee_type, reviewee_role")
      .eq("id", input.reviewId as never)
      .maybeSingle();
    if (fetchErr || !row) return { ok: false, error: "Review not found." };

    const patch: Partial<ReviewsRow> = {
      moderated_at: new Date().toISOString(),
      moderated_by: adminId,
    };
    if (input.is_approved !== undefined) patch.is_approved = input.is_approved;
    if (input.is_hidden !== undefined) patch.is_hidden = input.is_hidden;
    if (input.is_flagged !== undefined) patch.is_flagged = input.is_flagged;
    if (input.moderation_note !== undefined) patch.moderation_note = input.moderation_note;

    const { error: upErr } = await admin
      .from("reviews")
      .update(patch as never)
      .eq("id", input.reviewId as never);
    if (upErr) return { ok: false, error: upErr.message };

    const revieweeId = String((row as { reviewee_id: string }).reviewee_id);
    const revieweeKind = String(
      (row as { reviewee_type?: string | null; reviewee_role?: string | null }).reviewee_type ??
        (row as { reviewee_type?: string | null; reviewee_role?: string | null }).reviewee_role ??
        ""
    ).toLowerCase();
    await recomputeAllProfileReviewAggregates(revieweeId);

    await logAdminActivity({
      adminId,
      actionType: "review_moderation_update",
      targetType: "review",
      targetId: String(input.reviewId),
      details: patch,
    });

    revalidatePath("/admin/reviews");
    if (revieweeKind === "cleaner") {
      revalidatePath(`/cleaners/${revieweeId}`);
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Update failed." };
  }
}

export async function adminDeleteReview(reviewId: number): Promise<AdminReviewModerationResult> {
  try {
    const { adminId } = await requireAdminActor();
    const admin = createSupabaseAdminClient();
    if (!admin) return { ok: false, error: "Service role not configured." };

    const { data: row, error: fetchErr } = await admin
      .from("reviews")
      .select("id, reviewee_id, job_id, reviewee_type, reviewee_role")
      .eq("id", reviewId as never)
      .maybeSingle();
    if (fetchErr || !row) return { ok: false, error: "Review not found." };

    const revieweeId = String((row as { reviewee_id: string }).reviewee_id);
    const revieweeKind = String(
      (row as { reviewee_type?: string | null; reviewee_role?: string | null }).reviewee_type ??
        (row as { reviewee_type?: string | null; reviewee_role?: string | null }).reviewee_role ??
        ""
    ).toLowerCase();
    const jobId = (row as { job_id: number }).job_id;

    const { error: delErr } = await admin.from("reviews").delete().eq("id", reviewId as never);
    if (delErr) return { ok: false, error: delErr.message };

    await recomputeAllProfileReviewAggregates(revieweeId);

    await logAdminActivity({
      adminId,
      actionType: "review_delete",
      targetType: "review",
      targetId: String(reviewId),
      details: { job_id: jobId, reviewee_id: revieweeId },
    });

    revalidatePath("/admin/reviews");
    if (revieweeKind === "cleaner") {
      revalidatePath(`/cleaners/${revieweeId}`);
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Delete failed." };
  }
}
