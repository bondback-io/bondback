/**
 * Must stay in sync with `vercel.json` `crons` for these routes.
 * Vercel Cron uses UTC.
 */
export const NOTIFICATION_CRON_JOBS = [
  {
    key: "new_listing_reminders" as const,
    label: "Daily no-bid listing reminders",
    description:
      "Reminds cleaners about live listings with no bids yet (in/near their area). Uses notification #1 + #2 toggles.",
    path: "/api/cron/new-listing-reminders",
    /** Minute hour dom month dow — UTC */
    cron: "0 3 * * *",
    utcHour: 3,
    utcMinute: 0,
  },
  {
    key: "daily_browse_jobs_nudge" as const,
    label: "Daily browse-jobs nudge",
    description:
      "Nudge for cleaners to open Browse jobs at preferred radius + buffer. Uses notification #2 toggles.",
    path: "/api/cron/daily-browse-jobs-nudge",
    cron: "0 4 * * *",
    utcHour: 4,
    utcMinute: 0,
  },
] as const;

export type NotificationCronJobKey = (typeof NOTIFICATION_CRON_JOBS)[number]["key"];

/** Next calendar execution in UTC for a simple daily HH:MM UTC schedule. */
export function getNextDailyUtcRun(utcHour: number, utcMinute: number): Date {
  const now = new Date();
  const next = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
      utcHour,
      utcMinute,
      0,
      0
    )
  );
  if (next.getTime() <= now.getTime()) {
    next.setUTCDate(next.getUTCDate() + 1);
  }
  return next;
}
