import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));

/** Coerce to string before trim — PostgREST/JSON can surface non-strings at runtime (`x?.trim()` does not guard numbers). */
export function trimStr(v: unknown): string {
  return String(v ?? "").trim();
}

/**
 * Parse an ISO timestamp as UTC. If the string has no timezone (Z or ±HH:MM),
 * treat it as UTC to avoid local-time interpretation (which causes wrong countdowns
 * e.g. 1 day showing as 14h in UTC+10).
 */
export function parseUtcTimestamp(isoOrTimestamp: string): number {
  const s = String(isoOrTimestamp).trim();
  const hasTz = s.endsWith("Z") || /[+-]\d{2}:?\d{2}$/.test(s);
  return new Date(hasTz ? s : s + "Z").getTime();
}

