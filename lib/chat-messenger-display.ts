/**
 * Shared UI label for the job messenger header status pill.
 */

export function buildChatStatusPill(opts: {
  status: string | null;
  hasPaymentHold: boolean;
  autoReleaseAt: string | null;
}): string {
  const st = opts.status;
  if (!st) return "—";
  if (st === "completed") return "Job completed";
  if (st === "disputed" || st === "dispute_negotiating") return "Dispute active";
  if (st === "in_review") return "Under review";
  if (
    st === "completed_pending_approval" &&
    opts.hasPaymentHold &&
    opts.autoReleaseAt
  ) {
    const ms = new Date(opts.autoReleaseAt).getTime() - Date.now();
    const h = Math.max(0, Math.ceil(ms / 3_600_000));
    return `Funds in escrow • ${h}h left`;
  }
  if (opts.hasPaymentHold) return "Funds in escrow";
  return "In progress";
}
