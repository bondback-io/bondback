/**
 * Mandatory reason codes when a lister skips an occurrence or pauses a recurring contract.
 * UI: dropdown + optional detail when "other".
 */

export const RECURRING_SKIP_REASON_KEYS = [
  "holiday_away",
  "property_unavailable",
  "scheduling_conflict",
  "cleaner_request",
  "other",
] as const;

export type RecurringSkipReasonKey = (typeof RECURRING_SKIP_REASON_KEYS)[number];

export function recurringSkipReasonLabel(key: string): string {
  switch (key) {
    case "holiday_away":
      return "On holiday / away";
    case "property_unavailable":
      return "Property unavailable";
    case "scheduling_conflict":
      return "Scheduling conflict";
    case "cleaner_request":
      return "Cleaner request / issue";
    case "other":
      return "Other (please specify)";
    default:
      return key;
  }
}

export function parseRecurringSkipReason(
  key: string,
  detail: string | null | undefined
): { ok: true; key: RecurringSkipReasonKey; detail: string | null } | { ok: false; error: string } {
  const k = String(key ?? "").trim() as RecurringSkipReasonKey;
  if (!RECURRING_SKIP_REASON_KEYS.includes(k)) {
    return { ok: false, error: "Select a reason." };
  }
  const d = (detail ?? "").trim();
  if (k === "other" && d.length < 3) {
    return { ok: false, error: "Please add a short note for “Other”." };
  }
  return { ok: true, key: k, detail: k === "other" ? d : d.length > 0 ? d : null };
}
