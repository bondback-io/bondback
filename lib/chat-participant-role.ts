/**
 * Job chat: lister_id / winner_id vs auth user id may differ by UUID string casing.
 * Always compare with normalized ids (same approach as server job-messages).
 */
export function normalizeChatUid(id: string | null | undefined): string {
  if (id == null) return "";
  return String(id).trim().toLowerCase().replace(/-/g, "");
}

/**
 * Lister and winner are the same person (e.g. dual-role test or self-assigned edge case).
 * Job UI and message labels need the profile `active_role` to know lister vs cleaner context.
 */
export function isDualListerCleaner(
  listerId: string | null,
  cleanerId: string | null
): boolean {
  const l = normalizeChatUid(listerId);
  const c = normalizeChatUid(cleanerId);
  return Boolean(l && c && l === c);
}

/**
 * Whether the signed-in user is the lister or assigned cleaner on this job.
 * When lister_id and winner_id are the same as the user, `activeAppRole` picks lister vs cleaner
 * (matches the header role switcher); otherwise it is ignored.
 */
export function jobParticipantRole(
  userId: string,
  listerId: string | null,
  cleanerId: string | null,
  activeAppRole: "lister" | "cleaner" | null = null
): "lister" | "cleaner" | null {
  const u = normalizeChatUid(userId);
  const l = normalizeChatUid(listerId);
  const c = normalizeChatUid(cleanerId);
  if (l && c && l === c && l === u) {
    return activeAppRole ?? "lister";
  }
  if (listerId && u === l) return "lister";
  if (cleanerId && u === c) return "cleaner";
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
