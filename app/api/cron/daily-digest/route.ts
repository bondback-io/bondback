import { NextResponse } from "next/server";
import { runDailyDigestJob } from "@/lib/actions/daily-digest";

/**
 * Cron: send daily digest emails (role-based summary for the last 24 hours).
 *
 * Schedule (Vercel Cron): `0 22 * * *` UTC ≈ 8:00 AM Brisbane (AEST, UTC+10; Queensland does not observe DST).
 * If you need Sydney/Melbourne during AEDT, adjust the cron hour for UTC offset changes.
 *
 * When CRON_SECRET is set, requests must include Authorization: Bearer <CRON_SECRET>
 * or query param ?secret=<CRON_SECRET>.
 */
export const maxDuration = 300;

export async function GET(request: Request) {
  console.info("[email:cron]", { route: "daily-digest", phase: "request" });
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

  const result = await runDailyDigestJob();
  return NextResponse.json(result);
}

export async function POST(request: Request) {
  return GET(request);
}
