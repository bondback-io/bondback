import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { GoogleProfileFields } from "@/lib/auth/google-user-metadata";

/**
 * Persist Google identity fields to `profiles` on every Google OAuth completion.
 * Runs for new sign-ups and existing users (including email users who link Google).
 *
 * - `first_name` / `last_name` / `avatar_url`: set when Google provides values.
 * - `profile_photo_url`: only set from Google picture when the user has no custom photo yet.
 * - `full_name`: only backfilled when currently empty (does not overwrite manual edits).
 */
export async function syncGoogleIdentityToProfile(
  userId: string,
  fields: GoogleProfileFields
): Promise<void> {
  const admin = createSupabaseAdminClient();
  if (!admin) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[syncGoogleIdentityToProfile] admin client unavailable; skip profile sync");
    }
    return;
  }

  const { data: existing } = await admin
    .from("profiles")
    .select("full_name, profile_photo_url, first_name, last_name")
    .eq("id", userId)
    .maybeSingle();

  const row = existing as {
    full_name?: string | null;
    profile_photo_url?: string | null;
    first_name?: string | null;
    last_name?: string | null;
  } | null;

  const update: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (fields.givenName) update.first_name = fields.givenName;
  if (fields.familyName) update.last_name = fields.familyName;
  if (fields.pictureUrl) update.avatar_url = fields.pictureUrl;

  const noCustomPhoto = !row?.profile_photo_url?.trim();
  if (noCustomPhoto && fields.pictureUrl) {
    update.profile_photo_url = fields.pictureUrl;
  }

  if (!row?.full_name?.trim() && fields.fullName) {
    update.full_name = fields.fullName;
  }

  const { error } = await admin.from("profiles").update(update as never).eq("id", userId);
  if (error) {
    console.error("[syncGoogleIdentityToProfile] update failed", {
      userId,
      message: error.message,
    });
  }
}
