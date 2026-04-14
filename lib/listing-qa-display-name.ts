/**
 * Public Q&A author label: listers always use full name; cleaners prefer marketplace username when set.
 */

function truncateLabel(s: string, max = 48): string {
  const t = s.trim();
  if (t.length === 0) return "";
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

function normalizeRoles(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.map((r) => String(r).toLowerCase().trim()).filter(Boolean);
  }
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed) return [];
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed.map((r) => String(r).toLowerCase().trim()).filter(Boolean);
      }
    } catch {
      /* ignore */
    }
    if (trimmed.includes(",")) {
      return trimmed
        .split(",")
        .map((r) => r.toLowerCase().trim())
        .filter(Boolean);
    }
    return [trimmed.toLowerCase()];
  }
  return [];
}

/**
 * @param fallback — when full name is empty (e.g. "Member")
 */
export function qaAuthorDisplayName(opts: {
  userId: string;
  listerId: string;
  fullName: string | null | undefined;
  cleanerUsername: string | null | undefined;
  roles: string[] | null | undefined;
  fallback?: string;
}): string {
  const fb = opts.fallback ?? "Member";
  if (String(opts.userId) === String(opts.listerId)) {
    const t = truncateLabel(String(opts.fullName ?? ""));
    return t || fb;
  }
  const roles = normalizeRoles(opts.roles);
  if (roles.includes("cleaner")) {
    const u = truncateLabel(String(opts.cleanerUsername ?? ""));
    if (u) return u;
  }
  const t = truncateLabel(String(opts.fullName ?? ""));
  return t || fb;
}
