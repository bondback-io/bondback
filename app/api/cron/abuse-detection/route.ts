import { NextResponse } from "next/server";
import { processDisputeAbuseDetection } from "@/lib/actions/abuse-detection";

/**
 * Flags users who opened more than 3 disputes in 30 days; notifies admins.
 * Schedule daily. When CRON_SECRET is set, require Authorization or ?secret=.
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

  const result = await processDisputeAbuseDetection();
  return NextResponse.json(result);
}

export async function POST(request: Request) {
  return GET(request);
}
