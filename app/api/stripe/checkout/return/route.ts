import { NextResponse } from "next/server";
import { fulfillStripeCheckoutReturn } from "@/lib/actions/jobs";

function sanitizeNextPath(raw: string | null): string {
  const fallback = "/jobs";
  if (!raw) return fallback;
  const trimmed = raw.trim();
  if (!trimmed.startsWith("/")) return fallback;
  if (trimmed.startsWith("//")) return fallback;
  return trimmed;
}

/**
 * GET /api/stripe/checkout/return
 * Confirms Stripe Checkout return server-side and redirects back with `payment_notice`.
 * Query: session_id=cs_...&next=/jobs/123
 * Stripe success_url should point here directly (see `lib/stripe.ts`) so the browser does not
 * hit the job page with ?payment=success first (avoids extra redirects / reload loops).
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const sessionId = url.searchParams.get("session_id")?.trim() ?? "";
  const nextPath = sanitizeNextPath(url.searchParams.get("next"));

  if (!sessionId.startsWith("cs_")) {
    const dest = new URL(nextPath, url.origin);
    dest.searchParams.set("payment_notice", "error");
    return NextResponse.redirect(dest);
  }

  try {
    const result = await fulfillStripeCheckoutReturn(sessionId);
    const notice =
      result.ok && result.notice === "top_up_success"
        ? "top_up_success"
        : result.ok
          ? "success"
          : "error";
    const dest = new URL(nextPath, url.origin);
    dest.searchParams.set("payment_notice", notice);
    return NextResponse.redirect(dest);
  } catch (err) {
    console.error("[api/stripe/checkout/return] failed", err);
    const dest = new URL(nextPath, url.origin);
    dest.searchParams.set("payment_notice", "error");
    return NextResponse.redirect(dest);
  }
}
