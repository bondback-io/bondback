import { NextResponse } from "next/server";
import { sendBirthdayEmailsForToday } from "@/lib/actions/send-birthday-emails";

/**
 * Cron endpoint: send birthday emails to users whose date_of_birth is today (month/day).
 * Schedule daily (e.g. 9:00 AM). When CRON_SECRET is set, requests must include
 * Authorization: Bearer <CRON_SECRET> or ?secret=<CRON_SECRET>.
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

  const result = await sendBirthdayEmailsForToday();
  return NextResponse.json(result);
}

export async function POST(request: Request) {
  return GET(request);
}
