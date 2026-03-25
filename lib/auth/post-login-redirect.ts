import {
  normalizeProfileRolesFromDb,
  resolveActiveRoleFromProfile,
} from "@/lib/profile-roles";

type ProfileLike = {
  roles?: unknown;
  active_role?: unknown;
} | null;

/**
 * Same destination as `app/dashboard/page.tsx` — single source of truth so OAuth can skip `/dashboard`.
 */
export function getPostLoginDashboardPath(profile: ProfileLike): string {
  if (!profile) return "/onboarding/role-choice";
  const roles = normalizeProfileRolesFromDb(profile.roles, true);
  if (roles.length === 0) return "/onboarding/role-choice";
  const activeRole = resolveActiveRoleFromProfile(profile);
  if (!activeRole) return "/onboarding/role-choice";
  if (roles.length === 1) {
    return roles[0] === "cleaner" ? "/cleaner/dashboard" : "/lister/dashboard";
  }
  return activeRole === "cleaner" ? "/cleaner/dashboard" : "/lister/dashboard";
}
