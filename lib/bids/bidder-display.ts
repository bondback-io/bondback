import type { BidBidderProfileSummary } from "@/lib/bids/bidder-types";

/** Headline name in bid tables: username (if set), else full name / first+last, else email, else id stub. */
export function bidderDisplayNameForBid(bid: {
  cleaner_id: string;
  bidder_email?: string | null;
  bidder_profile?: BidBidderProfileSummary | null;
}): string {
  const p = bid.bidder_profile;
  const un = p?.cleaner_username?.trim();
  if (un) return `@${un}`;
  const full = p?.full_name?.trim();
  if (full) return full;
  const fromParts = [p?.first_name, p?.last_name]
    .map((s) => (typeof s === "string" ? s.trim() : ""))
    .filter(Boolean)
    .join(" ")
    .trim();
  if (fromParts) return fromParts;
  const em = bid.bidder_email?.trim();
  if (em) return em;
  return `Cleaner ${String(bid.cleaner_id).slice(0, 8)}…`;
}

/** Full legal-style name for profile preview (username is separate). */
export function bidderLegalNameFromProfile(p: BidBidderProfileSummary | null | undefined): string {
  if (!p) return "Cleaner";
  const full = p.full_name?.trim();
  if (full) return full;
  const fromParts = [p.first_name, p.last_name]
    .map((s) => (typeof s === "string" ? s.trim() : ""))
    .filter(Boolean)
    .join(" ")
    .trim();
  if (fromParts) return fromParts;
  if (p.cleaner_username?.trim()) return `@${p.cleaner_username.trim()}`;
  return "Cleaner";
}
