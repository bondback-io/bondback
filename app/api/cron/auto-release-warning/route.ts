import { NextResponse } from "next/server";
import { processAutoReleaseWarnings } from "@/lib/actions/notification-cron";

/**
 * Cron: warn listers when ~24h remains before auto-release. Use same auth as other crons.
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

  const result = await processAutoReleaseWarnings();
  return NextResponse.json(result);
}

export async function POST(request: Request) {
  return GET(request);
}
