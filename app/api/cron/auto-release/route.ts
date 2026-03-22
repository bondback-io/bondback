import { NextResponse } from "next/server";
import { processAutoRelease } from "@/lib/actions/jobs";

/**
 * Cron endpoint: auto-release payment for jobs where the cleaner marked complete
 * but the lister did not approve within global_settings.auto_release_hours.
 * Schedule frequently (e.g. every 15–60 min). When CRON_SECRET is set, requests
 * must include Authorization: Bearer <CRON_SECRET> or ?secret=<CRON_SECRET>.
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

  const result = await processAutoRelease();
  return NextResponse.json(result);
}

export async function POST(request: Request) {
  return GET(request);
}
