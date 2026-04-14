/** Persisted role context at post time (dual lister/cleaner same UUID). */
export type ListingCommentPostedAsRole = "lister" | "cleaner" | "member";

export function parsePostedAsRole(
  raw: string | null | undefined
): ListingCommentPostedAsRole | null {
  if (raw === "lister" || raw === "cleaner" || raw === "member") return raw;
  return null;
}

export function listingCommentAuthorRoleLabel(params: {
  userId: string;
  listerId: string;
  roles: string[] | null | undefined;
  posted_as_role: ListingCommentPostedAsRole | null | undefined;
}): "Lister" | "Cleaner" | "Member" {
  const { posted_as_role, userId, listerId, roles } = params;
  if (posted_as_role) {
    if (posted_as_role === "lister") return "Lister";
    if (posted_as_role === "cleaner") return "Cleaner";
    return "Member";
  }
  if (String(userId) === String(listerId)) return "Lister";
  const r = Array.isArray(roles) ? roles.map((x) => String(x).toLowerCase()) : [];
  if (r.includes("cleaner")) return "Cleaner";
  return "Member";
}

/** Whether the lister may use Reply on this root (not a lister-only / legacy lister root). */
export function rootThreadAllowsListerReply(params: {
  rootUserId: string;
  listerId: string;
  posted_as_role: ListingCommentPostedAsRole | null | undefined;
}): boolean {
  const { rootUserId, listerId, posted_as_role } = params;
  if (posted_as_role === "lister") return false;
  if (posted_as_role === "cleaner" || posted_as_role === "member") return true;
  // Legacy rows: infer from UUID only
  return String(rootUserId) !== String(listerId);
}
