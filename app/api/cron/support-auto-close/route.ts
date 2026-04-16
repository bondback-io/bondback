import { NextResponse } from "next/server";
import { autoCloseInactiveSupportTickets } from "@/lib/actions/support-thread";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const authHeader = request.headers.get("authorization");
    const url = new URL(request.url);
    const querySecret = url.searchParams.get("secret");
    const authorized = authHeader === `Bearer ${secret}` || querySecret === secret;
    if (!authorized) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }
  const result = await autoCloseInactiveSupportTickets();
  return NextResponse.json(result);
}

export async function POST(request: Request) {
  return GET(request);
}
