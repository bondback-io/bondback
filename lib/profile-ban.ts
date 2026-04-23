/**
 * Ban state for marketplace cleaners: `is_banned` with optional timed `ban_until`.
 * If `ban_until` is in the past, the ban is treated as expired for access checks.
 */
export function isProfileBanActiveForAccess(profile: {
  is_banned?: boolean | null;
  ban_until?: string | null;
} | null): boolean {
  if (!profile?.is_banned) return false;
  const until = String(profile.ban_until ?? "").trim();
  if (!until) return true;
  return new Date(until).getTime() > Date.now();
}
