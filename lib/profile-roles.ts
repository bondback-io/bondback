import type { ProfileRole } from "@/lib/types";

/**
 * Single source of truth for interpreting `profiles.roles` from the DB.
 * Must stay in sync with `getSessionWithProfile` in `lib/supabase/session.ts`.
 *
 * - `null` on an existing profile row = legacy lister-only (before `roles[]` existed).
 * - `[]` = signed up but not yet chosen lister/cleaner (keep empty).
 */
export function normalizeProfileRolesFromDb(
  roles: unknown,
  hasProfileRow: boolean
): ProfileRole[] {
  let out: ProfileRole[] = [];
  if (roles != null) {
    if (Array.isArray(roles)) {
      out = (roles as unknown[]).filter(
        (r): r is ProfileRole => r === "lister" || r === "cleaner"
      );
      if (out.length === 0 && roles.length > 0) {
        out = ["lister"];
      }
    } else if (typeof roles === "string") {
      try {
        const parsed = JSON.parse(roles) as unknown;
        if (Array.isArray(parsed)) {
          out = (parsed as unknown[]).filter(
            (r): r is ProfileRole => r === "lister" || r === "cleaner"
          );
          if (out.length === 0 && parsed.length > 0) {
            out = ["lister"];
          }
        } else {
          out = ["lister"];
        }
      } catch {
        out = ["lister"];
      }
    }
  } else if (hasProfileRow) {
    out = ["lister"];
  }
  return out;
}
