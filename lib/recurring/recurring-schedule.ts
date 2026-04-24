import { addMonths, addWeeks, format, parseISO, isValid, startOfDay } from "date-fns";

export type RecurringFrequencyKey = "weekly" | "fortnightly" | "monthly";

export function nextRecurringDate(from: Date, frequency: RecurringFrequencyKey): Date {
  if (frequency === "weekly") return addWeeks(from, 1);
  if (frequency === "fortnightly") return addWeeks(from, 2);
  return addMonths(from, 1);
}

export function parseDateOnly(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const d = parseISO(String(iso).slice(0, 10));
  return isValid(d) ? startOfDay(d) : null;
}

export function formatDateOnlyAU(d: Date): string {
  return format(d, "d MMM yyyy");
}
