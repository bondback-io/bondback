/**
 * Strip admin-only dispute thread rows that the viewer is not allowed to see.
 * Non-admin messages are always visible to both parties on the dispute hub.
 */
export function filterDisputeMessageRowsForPartyViewer(
  rows: unknown[],
  viewerUserId: string,
  job: { lister_id: string; winner_id: string | null }
): unknown[] {
  if (!Array.isArray(rows)) return [];
  const isLister = viewerUserId === job.lister_id;
  const isCleaner = job.winner_id != null && viewerUserId === job.winner_id;
  if (!isLister && !isCleaner) return [];

  return rows.filter((raw) => {
    const m = raw as Record<string, unknown>;
    const role = String(m.author_role ?? "").toLowerCase();
    if (role !== "admin") return true;
    const vL = m.visible_to_lister === true;
    const vC = m.visible_to_cleaner === true;
    if (isLister) return vL;
    return vC;
  });
}
