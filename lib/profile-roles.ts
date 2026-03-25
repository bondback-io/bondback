import type { ProfileRole } from "@/lib/types";

/** Normalize DB `active_role` (handles stray whitespace / casing). */
export function normalizeActiveRoleColumn(
  raw: unknown
): ProfileRole | null {
  if (typeof raw !== "string") return null;
  const t = raw.trim().toLowerCase();
  if (t === "lister" || t === "cleaner") return t;
  return null;
}

/**
 * Effective active role for nav + redirects — must match `getSessionWithProfile`.
 * Uses validated `active_role` when set; otherwise first entry in normalized `roles`.
 */
export function resolveActiveRoleFromProfile(row: {
  active_role?: unknown;
  roles?: unknown;
} | null): ProfileRole | null {
  if (!row) return null;
  const roles = normalizeProfileRolesFromDb(row.roles, true);
  if (roles.length === 0) return null;
  const fromCol = normalizeActiveRoleColumn(row.active_role);
  if (fromCol) return fromCol;
  return roles[0] ?? null;
}

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
