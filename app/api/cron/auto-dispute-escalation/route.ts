import { NextResponse } from "next/server";
import { processAutoDisputeEscalation } from "@/lib/actions/jobs";

/**
 * Cron endpoint: auto-escalate disputes to admin review after 72 hours without agreement.
 * Supports Authorization: Bearer <CRON_SECRET> or ?secret=<CRON_SECRET>.
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

  const result = await processAutoDisputeEscalation();
  return NextResponse.json(result);
}

export async function POST(request: Request) {
  return GET(request);
}

