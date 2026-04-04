import { NextRequest, NextResponse } from "next/server";
import { handleAuthConfirmRequest } from "@/lib/auth/confirm-email-handler";

export const dynamic = "force-dynamic";

/**
 * Server-side email confirmation (POST only).
 * The browser hits `/auth/confirm?...` (page) first for instant loading UI, then POSTs the same query here.
 * GET is not supported so one-time codes are never consumed by prefetch.
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({})) as { search?: string };
  const search = typeof body.search === "string" ? body.search : "";
  const qs = search.startsWith("?") ? search.slice(1) : search;
  const origin = request.nextUrl.origin;
  const url = new URL(`${origin}/auth/confirm${qs ? `?${qs}` : ""}`);
  const synthetic = new NextRequest(url, {
    headers: request.headers,
    method: "GET",
  });
  return handleAuthConfirmRequest(synthetic);
}

export async function GET() {
  return NextResponse.json(
    { error: "Method Not Allowed", hint: "Open /auth/confirm from your email link, or POST JSON { search: \"?...\" } from the app." },
    { status: 405, headers: { Allow: "POST" } }
  );
}
