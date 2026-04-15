import type { Database } from "@/types/supabase";

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

/**
 * Shared UI label for the job messenger header status pill.
 */

/** Primary line for messages sidebar / headers: full name, first+last, @cleaner_username, or fallback. */
export function messengerPeerDisplayName(
  profile: ProfileRow | null | undefined,
  fallback: string
): string {
  if (!profile) return fallback;
  const full = String(profile.full_name ?? "").trim();
  if (full) return full;
  const first = String(profile.first_name ?? "").trim();
  const last = String(profile.last_name ?? "").trim();
  const composed = [first, last].filter(Boolean).join(" ").trim();
  if (composed) return composed;
  const raw = String(profile.cleaner_username ?? "").trim().toLowerCase();
  if (raw) return `@${raw}`;
  return fallback;
}

/** Lowercase cleaner marketplace username for “(username)” suffix; null if unset. */
export function messengerPeerCleanerUsername(
  profile: ProfileRow | null | undefined
): string | null {
  const raw = String(profile?.cleaner_username ?? "").trim().toLowerCase();
  return raw || null;
}

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
