import { cache } from "react";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Database } from "@/types/supabase";
import type {
  DistanceUnitPref,
  ProfileRole,
  SessionWithProfile,
  ThemePreference,
} from "@/lib/types";
import {
  normalizeProfileRolesFromDb,
  resolveActiveRoleFromProfile,
} from "@/lib/profile-roles";
import type { NotificationPreferences } from "@/lib/notification-preferences";

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

/**
 * Get current session and profile (role, full_name, etc.) for Server Components.
 * Cached per-request with React.cache so multiple callers share one fetch.
 */
export const getSessionWithProfile = cache(async (): Promise<SessionWithProfile | null> => {
  const supabase = await createServerSupabaseClient();

  /**
   * Prefer getUser() over getSession() on the server: validates the JWT with Supabase
   * and avoids trusting cookie-only session data (stale / wrong user after login).
   */
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*, is_admin")
    .eq("id", user.id)
    .maybeSingle();

  const row = profile as ProfileRow | null;

  /** Normalize is_admin: DB may return boolean or text (e.g. "true"). */
  const isAdminValue = row?.is_admin;
  const isAdmin =
    isAdminValue === true ||
    (typeof isAdminValue === "string" &&
      ["true", "t", "yes", "1"].includes(String(isAdminValue).toLowerCase().trim()));

  const isSuperAdminRaw = (row as { is_super_admin?: unknown } | null)?.is_super_admin;
  const isSuperAdmin =
    isSuperAdminRaw === true ||
    (typeof isSuperAdminRaw === "string" &&
      ["true", "t", "yes", "1"].includes(String(isSuperAdminRaw).toLowerCase().trim()));

  /**
   * Roles: `[]` in DB = signed up but not yet chosen lister/cleaner (Airtasker-style flow).
   * `null` on legacy rows = treat as lister-only for backwards compatibility.
   */
  const roles: ProfileRole[] = normalizeProfileRolesFromDb(
    row?.roles,
    !!row
  );

  const activeRole: ProfileRole | null =
    roles.length === 0 ? null : resolveActiveRoleFromProfile(row);

  const parseThemePref = (v: unknown): ThemePreference =>
    v === "light" || v === "dark" || v === "system" ? v : "system";
  const parseDistanceUnit = (v: unknown): DistanceUnitPref => (v === "mi" ? "mi" : "km");

  if (process.env.NODE_ENV !== "production") {
    // Server-side debug log for admin/roles issues
     
    console.log("[getSessionWithProfile]", {
      userId: user.id,
      email: user.email,
      is_admin: row?.is_admin,
      isAdmin,
    });
  }

  const out: SessionWithProfile = {
    user: { id: user.id, email: user.email ?? undefined },
    profile: row
      ? {
          full_name: row.full_name,
          roles,
          activeRole,
          profile_photo_url: row.profile_photo_url ?? null,
          avatar_url: row.avatar_url ?? null,
          theme_preference: parseThemePref(
            (row as { theme_preference?: string | null }).theme_preference
          ),
          distance_unit: parseDistanceUnit(
            (row as { distance_unit?: string | null }).distance_unit
          ),
          notification_preferences:
            (row as { notification_preferences?: NotificationPreferences | null }).notification_preferences ?? null,
          is_email_verified: row.is_email_verified === true,
          hasSeenOnboardingTour:
            (row as { has_seen_onboarding_tour?: boolean | null }).has_seen_onboarding_tour === true,
        }
      : null,
    roles,
    activeRole,
    isAdmin,
    isSuperAdmin: isAdmin ? isSuperAdmin : false,
  };
  return out;
});
