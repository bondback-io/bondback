"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { PHOTO_LIMITS } from "@/lib/photo-validation";
import type { Database } from "@/types/supabase";
import type { ProfileRole } from "@/lib/types";

type ProfileUpdate = Database["public"]["Tables"]["profiles"]["Update"];

export type UpdateProfileResult = { ok: true } | { ok: false; error: string };

/**
 * Update the current user's profile. Session is verified with cookie client,
 * then admin client upserts by id only.
 */
export async function updateProfile(
  updates: ProfileUpdate
): Promise<UpdateProfileResult> {
  const supabase = await createServerSupabaseClient();

  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    return { ok: false, error: "You must be logged in." };
  }

  const safeUpdates = { ...updates } as Record<string, unknown>;
  if (Array.isArray(safeUpdates.portfolio_photo_urls)) {
    const arr = safeUpdates.portfolio_photo_urls as string[];
    if (arr.length > PHOTO_LIMITS.PORTFOLIO) {
      return {
        ok: false,
        error: `Too many portfolio photos (max ${PHOTO_LIMITS.PORTFOLIO} allowed).`,
      };
    }
    safeUpdates.portfolio_photo_urls = arr.length > 0 ? arr : null;
  }

  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("profiles")
    .update({ ...safeUpdates, updated_at: new Date().toISOString() } as never)
    .eq("id", session.user.id);

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath("/profile");
  revalidatePath("/dashboard");
  revalidatePath("/jobs");
  revalidatePath("/my-listings");
  return { ok: true };
}

export async function setActiveRole(role: ProfileRole): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createServerSupabaseClient();

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return { ok: false, error: "You must be logged in." };
  }

  const userId = session.user.id;

  const { data } = await supabase
    .from("profiles")
    .select("roles, active_role")
    .eq("id", userId)
    .maybeSingle();

  const profile = data as { roles: string[] | null; active_role: string | null } | null;
  const roles = (profile?.roles ?? []) as string[];

  if (!roles.includes(role)) {
    return { ok: false, error: "This role is not enabled for your account." };
  }

  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("profiles")
    .update({ active_role: role } as ProfileUpdate)
    .eq("id", userId);

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath("/");
  revalidatePath("/dashboard");
  revalidatePath("/jobs");
  revalidatePath("/my-listings");
  revalidatePath("/profile");

  return { ok: true };
}

const MAX_TRAVEL_KM_MIN = 5;
const MAX_TRAVEL_KM_MAX = 100;

export type UpdateMaxTravelKmResult = { ok: true } | { ok: false; error: string };

/**
 * Update the current user's max travel radius (cleaner profile). Stored as integer km.
 */
export async function updateMaxTravelKm(
  userId: string,
  km: number
): Promise<UpdateMaxTravelKmResult> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session || session.user.id !== userId) {
    return { ok: false, error: "You must be logged in." };
  }
  const clamped = Math.round(Math.max(MAX_TRAVEL_KM_MIN, Math.min(MAX_TRAVEL_KM_MAX, km)));
  const admin = createSupabaseAdminClient();
  if (!admin) return { ok: false, error: "Server error." };
  const { error } = await admin
    .from("profiles")
    .update({ max_travel_km: clamped, updated_at: new Date().toISOString() } as ProfileUpdate)
    .eq("id", userId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/profile");
  revalidatePath("/dashboard");
  revalidatePath("/jobs");
  return { ok: true };
}
