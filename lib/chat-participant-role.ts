/**
 * Job chat: lister_id / winner_id vs auth user id may differ by UUID string casing.
 * Always compare with normalized ids (same approach as server job-messages).
 */
export function normalizeChatUid(id: string | null | undefined): string {
  if (id == null) return "";
  return String(id).trim().toLowerCase().replace(/-/g, "");
}

/**
 * Whether the signed-in user is the lister or assigned cleaner on this job (not app nav role).
 */
export function jobParticipantRole(
  userId: string,
  listerId: string | null,
  cleanerId: string | null
): "lister" | "cleaner" | null {
  const u = normalizeChatUid(userId);
  if (listerId && u === normalizeChatUid(listerId)) return "lister";
  if (cleanerId && u === normalizeChatUid(cleanerId)) return "cleaner";
  return null;
}

/**
 * Role of the message sender on this job (drives label + bubble colour).
 */
export function messageSenderJobRole(
  senderId: string | null | undefined,
  listerId: string | null,
  cleanerId: string | null
): "lister" | "cleaner" {
  const s = normalizeChatUid(senderId);
  const l = normalizeChatUid(listerId);
  const c = normalizeChatUid(cleanerId);
  const isLister = Boolean(l && s === l);
  const isCleaner = Boolean(c && s === c);
  if (isLister && !isCleaner) return "lister";
  if (isCleaner && !isLister) return "cleaner";
  if (isLister && isCleaner) return "lister";
  return "cleaner";
}
