import { NextResponse } from "next/server";
import { sendDailyBrowseJobsNudge } from "@/lib/actions/sms-notifications";
import { recordNotificationCronRun } from "@/lib/cron/record-notification-cron-run";

/**
 * Cron: daily browse-jobs nudge for all qualifying cleaners (notification #2 toggles).
 * Staggered one hour after no-bid reminders on Hobby (3:00 → 4:00 UTC).
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const authHeader = request.headers.get("authorization");
    const url = new URL(request.url);
    const querySecret = url.searchParams.get("secret");
    const authorized =
      authHeader === `Bearer ${secret}` || querySecret === secret;
    if (!authorized) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const result = await sendDailyBrowseJobsNudge();
    await recordNotificationCronRun("daily_browse_jobs_nudge", {
      ok: result.ok,
      error: result.error ?? null,
      result: { sent: result.sent },
    });
    return NextResponse.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await recordNotificationCronRun("daily_browse_jobs_nudge", {
      ok: false,
      error: msg,
      result: null,
    });
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

export async function POST(request: Request) {
  return GET(request);
}
