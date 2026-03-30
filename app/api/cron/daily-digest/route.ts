import { NextResponse } from "next/server";
import { runDailyDigestJob } from "@/lib/actions/daily-digest";

/**
 * Cron: send daily digest emails (role-based summary for the last 24 hours).
 *
 * Vercel Hobby plan allows at most one cron invocation per route per day; deployments fail if any
 * cron runs more frequently (e.g. hourly). The daily-digest **Vercel Cron trigger is omitted from
 * vercel.json** so Hobby deploys succeed. Re-add `{ path, schedule: "0 22 * * *" }` when on Pro or
 * call this endpoint from an external scheduler (e.g. 8:00 AM AEST ≈ `0 22 * * *` UTC for Brisbane).
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
