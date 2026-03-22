"use server";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { PHOTO_LIMITS } from "@/lib/photo-validation";
import type { Database } from "@/types/supabase";
import { recomputeVerificationBadgesForUser } from "@/lib/actions/verification";

type ReviewsRow = Database["public"]["Tables"]["reviews"]["Row"];

export type SubmitReviewInput = {
  jobId: number;
  revieweeType: "cleaner" | "lister";
  overallRating: number;
  qualityOfWork?: number | null;
  reliability?: number | null;
  communication?: number | null;
  punctuality?: number | null;
  cleanliness?: number | null;
  reviewText?: string | null;
};

export type SubmitReviewResult =
  | { ok: true; reviewId: number }
  | { ok: false; error: string };

export async function submitReview(
  input: SubmitReviewInput
): Promise<SubmitReviewResult> {
  const supabase = await createServerSupabaseClient();

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return { ok: false, error: "You must be logged in to leave a review." };
  }

  // Load job to validate participation and status
  const { data: job, error: jobError } = await supabase
    .from("jobs")
    .select("id, lister_id, winner_id, status, payment_released_at")
    .eq("id", input.jobId as never)
    .maybeSingle();

  if (jobError || !job) {
    return { ok: false, error: "Job not found." };
  }

  if (job.status !== "completed") {
    return {
      ok: false,
      error: "You can only leave a review after the job is completed.",
    };
  }

  if (!(job as { payment_released_at?: string | null }).payment_released_at) {
    return {
      ok: false,
      error: "Reviews are available only after escrow funds are released.",
    };
  }

  const userId = session.user.id;
  const isLister = userId === job.lister_id;
  const isCleaner = userId === job.winner_id;

  if (!isLister && !isCleaner) {
    return {
      ok: false,
      error: "Only participants in this job can leave a review.",
    };
  }

  // Determine reviewer / reviewee
  let revieweeId: string | null = null;
  if (input.revieweeType === "cleaner") {
    revieweeId = job.winner_id;
  } else {
    revieweeId = job.lister_id;
  }

  if (!revieweeId) {
    return { ok: false, error: "Job has no matching reviewee for this review." };
  }

  // Ensure only appropriate role can review each side
  if (input.revieweeType === "cleaner" && !isLister) {
    return { ok: false, error: "Only the owner can review the cleaner." };
  }
  if (input.revieweeType === "lister" && !isCleaner) {
    return { ok: false, error: "Only the cleaner can review the owner." };
  }

  // Enforce single review per (job, reviewer, reviewee_type)
  const { data: existing } = await supabase
    .from("reviews")
    .select("id")
    .eq("job_id", job.id as never)
    .eq("reviewer_id", userId as never)
    .eq("reviewee_type", input.revieweeType as never)
    .limit(1);

  if (existing && existing.length > 0) {
    return {
      ok: false,
      error: "You have already left a review for this job.",
    };
  }

  const overall = Math.round(Number(input.overallRating));
  if (!Number.isFinite(overall) || overall < 1 || overall > 5) {
    return { ok: false, error: "Overall rating must be between 1 and 5." };
  }
  const categoryOrNull = (v?: number | null) => {
    if (v == null) return null;
    const n = Math.round(Number(v));
    if (!Number.isFinite(n) || n < 1 || n > 5) return null;
    return n;
  };
  const text =
    input.reviewText == null ? null : String(input.reviewText).trim().slice(0, 1000);

  const { data: inserted, error: insertError } = await supabase
    .from("reviews")
    .insert({
      job_id: job.id as number,
      reviewer_id: userId,
      reviewee_id: revieweeId,
      reviewee_role: input.revieweeType,
      reviewee_type: input.revieweeType,
      overall_rating: overall,
      quality_of_work: categoryOrNull(input.qualityOfWork),
      reliability: categoryOrNull(input.reliability),
      communication: categoryOrNull(input.communication),
      punctuality: categoryOrNull(input.punctuality),
      cleanliness: input.cleanliness ?? null,
      review_text: text,
    } as never)
    .select("id, reviewee_id, reviewee_type")
    .maybeSingle();

  if (insertError || !inserted) {
    return {
      ok: false,
      error: insertError?.message ?? "Failed to submit review.",
    };
  }

  // Best-effort: recompute averages for the reviewee
  try {
    await recomputeProfileAverages(
      inserted.reviewee_id as string,
      inserted.reviewee_type as "cleaner" | "lister"
    );
    await recomputeVerificationBadgesForUser(inserted.reviewee_id as string);
  } catch {
    // ignore rating recompute errors
  }

  return { ok: true, reviewId: inserted.id as number };
}

export type AttachReviewPhotosResult =
  | { ok: true }
  | { ok: false; error: string };

export async function attachReviewPhotos(
  reviewId: number,
  photoPaths: string[]
): Promise<AttachReviewPhotosResult> {
  const supabase = await createServerSupabaseClient();

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return { ok: false, error: "You must be logged in." };
  }

  const { data: review, error } = await supabase
    .from("reviews")
    .select("id, reviewer_id, review_photos, reviewee_id, reviewee_type")
    .eq("id", reviewId as never)
    .maybeSingle();

  if (error || !review) {
    return { ok: false, error: "Review not found." };
  }

  if (review.reviewer_id !== session.user.id) {
    return { ok: false, error: "You can only modify your own reviews." };
  }

  const existing = (review.review_photos ?? []) as string[];
  const maxReviewPhotos = PHOTO_LIMITS.REVIEW;
  if (photoPaths.length > maxReviewPhotos - existing.length) {
    return {
      ok: false,
      error: `Too many photos (max ${maxReviewPhotos} per review). You have ${existing.length} and tried to add ${photoPaths.length}.`,
    };
  }
  const next = [...existing, ...photoPaths].slice(0, maxReviewPhotos);

  const { error: updateError } = await supabase
    .from("reviews")
    .update({ review_photos: next } as Partial<ReviewsRow> as never)
    .eq("id", reviewId as never);

  if (updateError) {
    return { ok: false, error: updateError.message };
  }

  // Best-effort: recompute averages
  try {
    await recomputeProfileAverages(
      review.reviewee_id as string,
      review.reviewee_type as "cleaner" | "lister"
    );
    await recomputeVerificationBadgesForUser(review.reviewee_id as string);
  } catch {
    // ignore errors
  }

  return { ok: true };
}

async function recomputeProfileAverages(
  userId: string,
  revieweeType: "cleaner" | "lister"
) {
  const supabase = await createServerSupabaseClient();

  const { data: rows, error } = await supabase
    .from("reviews")
    .select("overall_rating")
    .eq("reviewee_id", userId as never)
    .eq("reviewee_type", revieweeType as never);

  if (error) {
    throw error;
  }

  const ratings = (rows ?? []).map((r: any) => r.overall_rating as number);
  if (ratings.length === 0) {
    return;
  }

  const total = ratings.reduce((sum, v) => sum + v, 0);
  const avg = total / ratings.length;

  const update: Partial<Database["public"]["Tables"]["profiles"]["Update"]> = {};
  if (revieweeType === "cleaner") {
    (update as any).cleaner_avg_rating = avg;
    (update as any).cleaner_total_reviews = ratings.length;
    (update as any).review_count = ratings.length;
  } else {
    (update as any).lister_avg_rating = avg;
    (update as any).lister_total_reviews = ratings.length;
    (update as any).review_count = ratings.length;
  }

  await supabase
    .from("profiles")
    .update(update as never)
    .eq("id", userId as never);
}

