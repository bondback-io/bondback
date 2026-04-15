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
 * Resolves which marketplace “hat” drives job messenger access for dual-role accounts.
 * Uses `profiles.active_role` when set; otherwise falls back from `roles` (same idea as listing/job routes).
 */
export function effectiveMessengerRoleFromProfile(profile: {
  active_role?: string | null;
  roles?: string[] | null;
}): "lister" | "cleaner" {
  const ar = profile.active_role;
  if (ar === "lister" || ar === "cleaner") return ar;
  const roles = Array.isArray(profile.roles) ? profile.roles : [];
  const hasL = roles.some((r) => String(r).toLowerCase() === "lister");
  const hasC = roles.some((r) => String(r).toLowerCase() === "cleaner");
  if (hasL && !hasC) return "lister";
  if (hasC && !hasL) return "cleaner";
  if (hasL && hasC) return "lister";
  if (hasC) return "cleaner";
  return "lister";
}

/**
 * Whether this job’s thread should appear for the user in the current messenger mode.
 * Same person as both lister and winner → always allowed (labels use `activeAppRole`).
 */
export function isJobThreadVisibleForMessengerRole(params: {
  userId: string;
  listerId: string | null;
  cleanerId: string | null;
  messengerRole: "lister" | "cleaner";
}): boolean {
  const u = normalizeChatUid(params.userId);
  const l = normalizeChatUid(params.listerId);
  const c = normalizeChatUid(params.cleanerId);
  const isLister = Boolean(l && u === l);
  const isCleaner = Boolean(c && u === c);
  if (!isLister && !isCleaner) return false;
  if (isLister && isCleaner) return true;
  return params.messengerRole === "lister" ? isLister : isCleaner;
}

/**
 * Whether the signed-in user is the lister or assigned cleaner on this job.
 * When lister_id and winner_id are the same as the user, `activeAppRole` picks lister vs cleaner
 * (matches the header role switcher); otherwise it is ignored.
 *
 * `messengerRoleFilter` restricts dual-role accounts: in lister mode you only count as lister on jobs
 * where you own the listing; in cleaner mode only as the assigned winner.
 */
export function jobParticipantRole(
  userId: string,
  listerId: string | null,
  cleanerId: string | null,
  activeAppRole: "lister" | "cleaner" | null = null,
  messengerRoleFilter: "lister" | "cleaner" | null = null
): "lister" | "cleaner" | null {
  const u = normalizeChatUid(userId);
  const l = normalizeChatUid(listerId);
  const c = normalizeChatUid(cleanerId);
  if (l && c && l === c && l === u) {
    return activeAppRole ?? "lister";
  }
  const isLister = Boolean(l && u === l);
  const isCleaner = Boolean(c && u === c);
  if (!isLister && !isCleaner) return null;
  const mf = messengerRoleFilter;
  if (mf === "lister") return isLister ? "lister" : null;
  if (mf === "cleaner") return isCleaner ? "cleaner" : null;
  if (isLister) return "lister";
  if (isCleaner) return "cleaner";
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
