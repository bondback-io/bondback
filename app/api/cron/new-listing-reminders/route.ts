import { NextResponse } from "next/server";
import { sendNoBidListingReminderNotifications } from "@/lib/actions/sms-notifications";

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

  const result = await sendNoBidListingReminderNotifications();
  return NextResponse.json(result);
}

export async function POST(request: Request) {
  return GET(request);
}
