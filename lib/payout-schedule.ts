/**
 * Payout schedule types and helpers. Used by global settings, profiles, Stripe Connect, and earnings.
 */

export type PayoutScheduleInterval = "daily" | "weekly" | "monthly";

export type PreferredPayoutSchedule = PayoutScheduleInterval | "platform_default";

/** Resolve effective interval for a cleaner: profile preference or platform default. */
export function getEffectivePayoutSchedule(
  preferred: PreferredPayoutSchedule | null | undefined,
  platformDefault: PayoutScheduleInterval | null | undefined
): PayoutScheduleInterval {
  if (preferred && preferred !== "platform_default") {
    return preferred;
  }
  return platformDefault === "daily" || platformDefault === "monthly" ? platformDefault : "weekly";
}

/** Human label for schedule. */
export function formatPayoutScheduleLabel(interval: PayoutScheduleInterval): string {
  return interval.charAt(0).toUpperCase() + interval.slice(1);
}

/**
 * Estimate next payout date from today based on schedule (approximate; actual dates come from Stripe).
 * Weekly: next Monday; Monthly: 1st of next month; Daily: tomorrow.
 */
export function getNextPayoutEstimate(interval: PayoutScheduleInterval): Date {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  switch (interval) {
    case "daily": {
      d.setDate(d.getDate() + 1);
      return d;
    }
    case "weekly": {
      const day = d.getDay();
      const daysUntilMonday = day === 0 ? 1 : day === 1 ? 0 : 8 - day;
      d.setDate(d.getDate() + daysUntilMonday);
      return d;
    }
    case "monthly": {
      d.setMonth(d.getMonth() + 1);
      d.setDate(1);
      return d;
    }
    default:
      d.setDate(d.getDate() + 1);
      return d;
  }
}
