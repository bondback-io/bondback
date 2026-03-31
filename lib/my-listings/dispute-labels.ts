/** Align with guided-dispute-form reason values */
const REASON_LABELS: Record<string, string> = {
  quality: "Quality of cleaning not up to standard",
  incomplete: "Job not completed / items missed",
  timeliness: "Cleaner was late or didn't show",
  damage: "Damage caused during clean",
  other: "Other",
};

export function formatDisputeReasonLabel(reason: string | null | undefined): string {
  if (!reason?.trim()) return "Reason not specified";
  const k = reason.trim().toLowerCase();
  return REASON_LABELS[k] ?? reason.replace(/_/g, " ");
}

export function formatDisputePhaseLabel(
  jobStatus: string | null | undefined,
  disputeStatus: string | null | undefined
): string {
  const js = String(jobStatus ?? "").toLowerCase();
  if (js === "disputed") return "Dispute opened — action may be needed";
  if (js === "in_review") return "Under admin review";
  if (js === "dispute_negotiating") return "Negotiating outcome";
  if (disputeStatus?.trim()) {
    return disputeStatus.replace(/_/g, " ");
  }
  return "Active dispute";
}
