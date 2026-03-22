/**
 * Server-safe profile strength calculation (same logic as ProfileStrengthCard).
 * Used for welcome bar "XX% complete" and other server-rendered UI.
 */
export function getProfileStrengthPercent(profile: {
  profile_photo_url?: string | null;
  bio?: string | null;
  specialties?: string[] | null;
  portfolio_photo_urls?: string[] | null;
  abn?: string | null;
  phone?: string | null;
  suburb?: string | null;
  availability?: Record<string, unknown> | null;
}): number {
  let score = 0;
  if (profile.profile_photo_url) score += 20;
  if (profile.bio && profile.bio.trim().length > 0) score += 10;
  if (profile.specialties && profile.specialties.length > 0) score += 15;
  if (profile.portfolio_photo_urls && profile.portfolio_photo_urls.length > 0) score += 20;
  if (profile.abn && profile.abn.trim().length > 0) score += 10;
  if (profile.phone && profile.phone.trim().length > 0 && profile.suburb) score += 10;
  if (profile.availability && Object.keys(profile.availability).length > 0) score += 15;
  return Math.max(0, Math.min(100, score));
}
