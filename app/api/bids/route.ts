import { NextResponse } from "next/server";
import { placeBid } from "@/lib/actions/bids";

/**
 * POST /api/bids
 * Place a bid (used by Background Sync from service worker and by client when online).
 * Body: { listingId: string, amountCents: number }
 * Uses session cookies for auth. Returns { ok: true } or { ok: false, error: string }.
 */
export async function POST(request: Request) {
  let body: { listingId?: string; amountCents?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const listingId =
    typeof body.listingId === "string" ? body.listingId.trim() : null;
  const amountCents =
    typeof body.amountCents === "number" && Number.isFinite(body.amountCents)
      ? Math.round(body.amountCents)
      : null;

  if (!listingId || amountCents == null || amountCents <= 0) {
    return NextResponse.json(
      { ok: false, error: "listingId and amountCents required" },
      { status: 400 }
    );
  }

  const result = await placeBid(listingId, amountCents);

  if (result.ok) {
    return NextResponse.json({ ok: true });
  }

  const status = result.error?.toLowerCase().includes("logged in")
    ? 401
    : 400;
  return NextResponse.json({ ok: false, error: result.error }, { status });
}
