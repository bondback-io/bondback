import { NextResponse } from "next/server";
import { sendDailyBrowseJobsNudge } from "@/lib/actions/sms-notifications";

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

  const result = await sendDailyBrowseJobsNudge();
  return NextResponse.json(result);
}

export async function POST(request: Request) {
  return GET(request);
}
