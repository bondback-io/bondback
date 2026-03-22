/**
 * Strip markdown to plain text for excerpts (no links, headers, bold, etc.).
 */
export function stripMarkdownToPlainText(md: string, maxLength: number = 160): string {
  if (!md) return "";
  let text = md
    .replace(/^#+\s+/gm, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/^\s*[-*]\s+/gm, " ")
    .replace(/\n+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).trim() + "…";
}

/**
 * Escape user input for use in Supabase .ilike() pattern so % and _ are literal.
 */
export function escapeLikePattern(raw: string): string {
  return raw
    .replace(/\\/g, "\\\\")
    .replace(/%/g, "\\%")
    .replace(/_/g, "\\_")
    .replace(/'/g, "''");
}

/**
 * Bond-cleaning–focused keyword expansion for search fallback.
 * Returns the original term plus synonyms/related terms (no duplicates, original first).
 */
const SEARCH_SYNONYMS: Record<string, string[]> = {
  bid: ["bids", "bidding", "place a bid", "place bid", "buy now"],
  bids: ["bid", "bidding", "place a bid", "buy now"],
  pay: ["paid", "payment", "payout", "payments", "get paid", "earnings"],
  paid: ["pay", "payment", "payout", "get paid", "earnings"],
  payment: ["pay", "paid", "payout", "payments", "earnings"],
  dispute: ["disputes", "disputed", "issue", "issues"],
  disputes: ["dispute", "disputed", "issue"],
  listing: ["listings", "list", "create listing"],
  listings: ["listing", "list", "create listing"],
  clean: ["cleaning", "cleaner", "cleaners", "bond clean"],
  cleaning: ["clean", "cleaner", "cleaners", "bond clean"],
  cleaner: ["cleaners", "clean", "cleaning", "bond cleaning"],
  reserve: ["reserve price", "reserve price and", "auction"],
  price: ["reserve", "reserve price", "buy now", "pricing"],
  photos: ["photo", "pictures", "before and after", "upload"],
  photo: ["photos", "pictures", "before and after", "upload"],
  upload: ["photos", "photo", "before and after"],
  complete: ["completed", "completion", "mark complete", "finish"],
  completed: ["complete", "completion", "mark complete"],
  approve: ["approval", "approve completion", "release funds"],
  account: ["profile", "ABN", "settings", "account & profile"],
  profile: ["account", "ABN", "profile details"],
  abn: ["ABN", "profile", "business"],
  role: ["roles", "lister", "cleaner", "switch role"],
  roles: ["role", "lister", "cleaner", "switch role"],
  lister: ["listers", "listing", "role"],
  signup: ["sign up", "register", "getting started"],
  "sign up": ["signup", "register", "getting started"],
};

/**
 * Expand a search query into an array of terms (original first, then related).
 * Used as fallback when primary search returns no results.
 */
export function expandSearchTerms(query: string): string[] {
  const trimmed = query.replace(/,/g, " ").trim().toLowerCase();
  if (!trimmed) return [];

  const words = trimmed.split(/\s+/).filter(Boolean);
  const out = new Set<string>([trimmed]);

  for (const word of words) {
    const key = word.length > 2 ? word : "";
    const synonyms = key ? SEARCH_SYNONYMS[key] : undefined;
    if (synonyms) {
      synonyms.forEach((s) => out.add(s));
    }
    if (word.length > 3) {
      out.add(word + "s");
      if (word.endsWith("s")) out.add(word.slice(0, -1));
    }
  }

  return Array.from(out);
}
