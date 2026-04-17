import { NextResponse } from "next/server";
import { sendNoBidListingReminderNotifications } from "@/lib/actions/sms-notifications";
import { recordNotificationCronRun } from "@/lib/cron/record-notification-cron-run";

/**
 * Cron: remind cleaners about live no-bid listings in/near their area.
 * Sends in-app + email only (no SMS/push), deduped by configurable interval.
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
    const result = await sendNoBidListingReminderNotifications();
    await recordNotificationCronRun("new_listing_reminders", {
      ok: result.ok,
      error: result.error ?? null,
      result: {
        listingsConsidered: result.listingsConsidered,
        listingsMatched: result.listingsMatched,
        notificationsSent: result.notificationsSent,
      },
    });
    return NextResponse.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await recordNotificationCronRun("new_listing_reminders", {
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
