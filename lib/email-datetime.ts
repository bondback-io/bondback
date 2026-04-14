/**
 * Bond Back email date/time display — always use an explicit IANA timezone so server
 * locale (often UTC on Vercel) does not leak into customer-facing copy.
 *
 * Override with `BOND_BACK_EMAIL_TIMEZONE` (e.g. `Australia/Perth`). Default: eastern Australia.
 */
const DEFAULT_EMAIL_TIMEZONE = "Australia/Sydney";

export function emailDisplayTimeZone(): string {
  const raw = process.env.BOND_BACK_EMAIL_TIMEZONE?.trim();
  if (raw) return raw;
  return DEFAULT_EMAIL_TIMEZONE;
}

function coerceDate(input: Date | string | number): Date {
  return input instanceof Date ? input : new Date(input);
}

/** e.g. "14 Apr 2026, 1:29 am" + optional short zone from Intl */
export function formatDateTimeForEmail(
  input: Date | string | number,
  opts?: { appendTimeZoneName?: boolean }
): string {
  const d = coerceDate(input);
  if (Number.isNaN(d.getTime())) return "—";
  const tz = emailDisplayTimeZone();
  const base = new Intl.DateTimeFormat("en-AU", {
    timeZone: tz,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(d);
  if (!opts?.appendTimeZoneName) return base;
  const parts = new Intl.DateTimeFormat("en-AU", {
    timeZone: tz,
    timeZoneName: "short",
  }).formatToParts(d);
  const zn = parts.find((p) => p.type === "timeZoneName")?.value;
  return zn ? `${base} (${zn})` : base;
}

/** Calendar date in the display zone (important when UTC crosses midnight). */
export function formatDateForEmail(input: Date | string | number): string {
  const d = coerceDate(input);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("en-AU", {
    timeZone: emailDisplayTimeZone(),
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(d);
}

/** Subject-style: "Wed, 15 Apr" in display timezone */
export function formatDigestSubjectDateForEmail(input: Date | string | number): string {
  const d = coerceDate(input);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("en-AU", {
    timeZone: emailDisplayTimeZone(),
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(d);
}
