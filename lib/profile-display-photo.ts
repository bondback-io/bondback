/**
 * Public profile photo shown in UI: user-uploaded storage URL, else OAuth provider avatar (e.g. Google).
 */
export function effectiveProfilePhotoUrl(
  row:
    | {
        profile_photo_url?: string | null;
        avatar_url?: string | null;
      }
    | null
    | undefined
): string | null {
  const uploaded = row?.profile_photo_url?.trim();
  if (uploaded) return uploaded;
  const oauth = row?.avatar_url?.trim();
  return oauth || null;
}
