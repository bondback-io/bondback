import { NextResponse } from "next/server";
import { sendScheduledTutorialEmails } from "@/lib/actions/send-tutorial-emails";

/**
 * Cron endpoint: send tutorial emails to users who signed up 24h ago.
 * When CRON_SECRET is set, requests must include Authorization: Bearer <CRON_SECRET>
 * or query param ?secret=<CRON_SECRET> (for cron services that can't set headers).
 * When CRON_SECRET is unset (e.g. local dev), the endpoint runs without auth.
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

  const result = await sendScheduledTutorialEmails();
  return NextResponse.json(result);
}

export async function POST(request: Request) {
  return GET(request);
}
