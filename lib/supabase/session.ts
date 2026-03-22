import { cache } from "react";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Database } from "@/types/supabase";
import type { ProfileRole, SessionWithProfile } from "@/lib/types";

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

/**
 * Get current session and profile (role, full_name, etc.) for Server Components.
 * Cached per-request with React.cache so multiple callers share one fetch.
 */
export const getSessionWithProfile = cache(async (): Promise<SessionWithProfile | null> => {
  const supabase = await createServerSupabaseClient();

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.user) {
    return null;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*, is_admin")
    .eq("id", session.user.id)
    .maybeSingle();

  const row = profile as ProfileRow | null;

  /** Normalize is_admin: DB may return boolean or text (e.g. "true"). */
  const isAdminValue = row?.is_admin;
  const isAdmin =
    isAdminValue === true ||
    (typeof isAdminValue === "string" &&
      ["true", "t", "yes", "1"].includes(String(isAdminValue).toLowerCase().trim()));

  let roles: ProfileRole[] = (row ? ["lister"] : []);
  if (row?.roles != null) {
    if (Array.isArray(row.roles)) {
      roles = (row.roles as unknown[]).filter(
        (r): r is ProfileRole => r === "lister" || r === "cleaner"
      );
      if (roles.length === 0) roles = ["lister"];
    } else if (typeof row.roles === "string") {
      try {
        const parsed = JSON.parse(row.roles) as unknown;
        roles = Array.isArray(parsed)
          ? (parsed as unknown[]).filter(
              (r): r is ProfileRole => r === "lister" || r === "cleaner"
            )
          : ["lister"];
        if (roles.length === 0) roles = ["lister"];
      } catch {
        roles = ["lister"];
      }
    }
  }

  let activeRole: ProfileRole | null =
    (row?.active_role === "lister" || row?.active_role === "cleaner"
      ? row.active_role
      : null) ?? (roles[0] ?? null);

  if (process.env.NODE_ENV !== "production") {
    // Server-side debug log for admin/roles issues
    // eslint-disable-next-line no-console
    console.log("[getSessionWithProfile]", {
      userId: session.user.id,
      email: session.user.email,
      is_admin: row?.is_admin,
      isAdmin,
    });
  }

  const out: SessionWithProfile = {
    user: { id: session.user.id, email: session.user.email ?? undefined },
    profile: row
      ? {
          full_name: row.full_name,
          roles,
          activeRole,
          profile_photo_url: row.profile_photo_url ?? null,
        }
      : null,
    roles,
    activeRole,
    isAdmin,
  };
  return out;
});
