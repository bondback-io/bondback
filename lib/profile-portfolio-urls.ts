/**
 * Normalize `profiles.portfolio_photo_urls` from DB/API (text[], jsonb-as-array, or legacy JSON string).
 */
export function normalizePortfolioPhotoUrls(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.filter((u): u is string => typeof u === "string" && u.trim().length > 0);
  }
  if (typeof raw === "string" && raw.trim()) {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) {
        return parsed.filter((u): u is string => typeof u === "string" && u.trim().length > 0);
      }
    } catch {
      if (/^https?:\/\//i.test(raw.trim())) {
        return [raw.trim()];
      }
    }
  }
  return [];
}

function sessionKey(userId: string): string {
  return `bb-portfolio-urls-${userId}`;
}

/** Survives React Strict Mode remount + brief RSC stale props after save (dev). */
export function readPortfolioUrlsSessionCache(userId: string): string[] {
  if (typeof window === "undefined") return [];
  try {
    const s = sessionStorage.getItem(sessionKey(userId));
    if (!s) return [];
    return normalizePortfolioPhotoUrls(JSON.parse(s) as unknown);
  } catch {
    return [];
  }
}

export function writePortfolioUrlsSessionCache(userId: string, urls: string[]): void {
  if (typeof window === "undefined") return;
  try {
    if (urls.length === 0) {
      sessionStorage.removeItem(sessionKey(userId));
    } else {
      sessionStorage.setItem(sessionKey(userId), JSON.stringify(urls));
    }
  } catch {
    /* quota / private mode */
  }
}

export function clearPortfolioUrlsSessionCacheIfDbMatches(
  userId: string,
  dbUrls: unknown
): void {
  const fromDb = normalizePortfolioPhotoUrls(dbUrls);
  if (fromDb.length === 0) return;
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(sessionKey(userId));
  } catch {
    /* ignore */
  }
}
