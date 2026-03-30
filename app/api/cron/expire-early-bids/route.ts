import { NextResponse } from "next/server";
import { expireStaleEarlyBidAcceptances } from "@/lib/actions/early-bid-acceptance";

/**
 * Expire pending early-acceptance offers after 24h without cleaner response.
 *
 * Vercel Hobby plan: crons cannot run more than once per day per route (hourly schedules fail
 * deployment). This job is scheduled **once daily** in vercel.json (`0 2 * * *` UTC). For hourly
 * expiry, use Vercel Pro or an external cron. Auth with CRON_SECRET when set.
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

  const result = await expireStaleEarlyBidAcceptances();
  return NextResponse.json(result);
}

export async function POST(request: Request) {
  return GET(request);
}
