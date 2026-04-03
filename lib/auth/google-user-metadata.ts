import type { User } from "@supabase/supabase-js";

/** Fields derived from Google (and compatible) OAuth `user_metadata`. */
export type GoogleProfileFields = {
  givenName: string | null;
  familyName: string | null;
  /** Display full name for `profiles.full_name` when backfilling. */
  fullName: string;
  /** Google `picture` / `avatar_url` (HTTPS URL). */
  pictureUrl: string | null;
};

type IdentityWithData = {
  provider?: string;
  identity_data?: Record<string, unknown>;
};

/**
 * Merge `user_metadata` with Google identity `identity_data` (covers linked accounts and
 * provider-specific fields not yet copied to metadata).
 */
function mergedGoogleMetadata(user: User): Record<string, unknown> {
  const meta = { ...(user.user_metadata ?? {}) } as Record<string, unknown>;
  const identities = (user as User & { identities?: IdentityWithData[] | null }).identities;
  const google = identities?.find((i) => i.provider === "google");
  const idData = google?.identity_data;
  if (!idData) return meta;
  const keys = [
    "given_name",
    "family_name",
    "name",
    "full_name",
    "picture",
    "avatar_url",
    "email",
  ] as const;
  for (const key of keys) {
    const v = idData[key];
    if (v != null && v !== "" && (meta[key] == null || meta[key] === "")) {
      meta[key] = v;
    }
  }
  return meta;
}

/**
 * Read name and picture from Supabase Auth after Google sign-in.
 * Uses merged `user_metadata` + Google `identities[].identity_data` (`given_name`, `family_name`,
 * `picture`, etc.). The Google OAuth consent screen title (“Bond Back”) is configured in
 * Google Cloud Console → OAuth consent screen, not in app code.
 */
export function extractGoogleProfileFields(user: User): GoogleProfileFields {
  const meta = mergedGoogleMetadata(user);
  const givenName =
    typeof meta.given_name === "string" ? meta.given_name.trim() : "";
  const familyName =
    typeof meta.family_name === "string" ? meta.family_name.trim() : "";
  const pictureRaw =
    (typeof meta.picture === "string" && meta.picture.trim()) ||
    (typeof meta.avatar_url === "string" && meta.avatar_url.trim()) ||
    "";
  const pictureUrl = pictureRaw || null;

  const combined = `${givenName} ${familyName}`.trim();
  const fullName =
    combined ||
    (typeof meta.full_name === "string" && meta.full_name.trim()) ||
    (typeof meta.name === "string" && meta.name.trim()) ||
    user.email?.split("@")[0] ||
    "User";

  return {
    givenName: givenName || null,
    familyName: familyName || null,
    fullName,
    pictureUrl,
  };
}
