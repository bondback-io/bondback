/** Trust row for job cards: lister display name + verification_badges + avatar from profiles. */
export type ListerCardData = {
  listerName: string | null;
  listerVerificationBadges: string[] | null;
  /** Public profile image URL (storage or OAuth); null if unset. */
  listerAvatarUrl: string | null;
};

/**
 * Batch-load lister profiles for live listing cards (Find Jobs feed, load-more).
 */
export async function buildListerCardDataByListingId(
   
  supabase: any,
  listings: { id: string; lister_id: string }[]
): Promise<Record<string, ListerCardData>> {
  const uniqueListerIds = [
    ...new Set(listings.map((l) => l.lister_id).filter((id) => Boolean(id))),
  ] as string[];
  if (uniqueListerIds.length === 0) return {};

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name, verification_badges, avatar_url, profile_photo_url")
    .in("id", uniqueListerIds);

  const byUser = new Map<
    string,
    {
      full_name: string | null;
      verification_badges: string[] | null;
      listerAvatarUrl: string | null;
    }
  >();
  for (const p of profiles ?? []) {
    const row = p as {
      id: string;
      full_name?: string | null;
      verification_badges?: string[] | null;
      avatar_url?: string | null;
      profile_photo_url?: string | null;
    };
    const uploaded = row.profile_photo_url?.trim() || null;
    const oauth = row.avatar_url?.trim() || null;
    const listerAvatarUrl = uploaded || oauth || null;
    byUser.set(row.id, {
      full_name: row.full_name ?? null,
      verification_badges: Array.isArray(row.verification_badges)
        ? row.verification_badges
        : null,
      listerAvatarUrl,
    });
  }

  const out: Record<string, ListerCardData> = {};
  for (const l of listings) {
    const prof = byUser.get(l.lister_id);
    out[String(l.id)] = {
      listerName: prof?.full_name ?? null,
      listerVerificationBadges: prof?.verification_badges ?? null,
      listerAvatarUrl: prof?.listerAvatarUrl ?? null,
    };
  }
  return out;
}
