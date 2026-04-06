import type { Database } from "@/types/supabase";
import { effectiveProfilePhotoUrl } from "@/lib/profile-display-photo";
import { normalizeProfileRolesFromDb } from "@/lib/profile-roles";

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

function hasMeaningfulAvailability(av: unknown): boolean {
  if (av == null) return false;
  if (Array.isArray(av)) return av.length > 0;
  if (typeof av === "object") {
    const o = av as Record<string, unknown>;
    const keys = Object.keys(o);
    if (keys.length === 0) return false;
    return Object.values(o).some((v) => v === true);
  }
  return false;
}

/**
 * Completion % for admin + dashboard “profile strength”.
 *
 * **Cleaners** are scored on photo, bio, contact/location, specialties, portfolio, ABN, and
 * availability (max 100).
 *
 * **Listers-only** (no cleaner role) are scored only on photo, bio, and phone + suburb — max raw
 * points 40, normalized to **100%** when those are complete (so listers are not stuck at 40%).
 */
export function calculateProfileStrengthPercent(profile: ProfileRow): number {
  const roles = normalizeProfileRolesFromDb(profile.roles, true);
  const isCleaner = roles.includes("cleaner");

  let score = 0;
  let max = 0;

  const add = (weight: number, ok: boolean) => {
    max += weight;
    if (ok) score += weight;
  };

  add(20, !!effectiveProfilePhotoUrl(profile));
  add(10, !!(profile.bio && profile.bio.trim().length > 0));
  const suburbOk = !!(profile.suburb && String(profile.suburb).trim().length > 0);
  add(10, !!(profile.phone && profile.phone.trim().length > 0 && suburbOk));

  if (isCleaner) {
    add(15, !!(profile.specialties && profile.specialties.length > 0));
    add(20, !!(profile.portfolio_photo_urls && profile.portfolio_photo_urls.length > 0));
    add(10, !!(profile.abn && profile.abn.trim().length > 0));
    add(15, hasMeaningfulAvailability(profile.availability));
  }

  if (max <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((score / max) * 100)));
}
