import { NextResponse } from "next/server";
import {
  confirmEarlyBidByToken,
  declineEarlyBidByToken,
} from "@/lib/actions/early-bid-acceptance";
import { getSiteUrl } from "@/lib/site";

/**
 * Secure one-click actions from the early-acceptance email (no login required).
 * GET /api/bids/early-action?token=...&action=confirm|decline
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  const action = url.searchParams.get("action");
  const base = getSiteUrl().origin;

  if (!token?.trim() || (action !== "confirm" && action !== "decline")) {
    return NextResponse.redirect(new URL("/jobs?early_error=invalid", base));
  }

  const result =
    action === "confirm"
      ? await confirmEarlyBidByToken(token.trim())
      : await declineEarlyBidByToken(token.trim());

  if (!result.ok) {
    return NextResponse.redirect(
      new URL(`/jobs?early_error=${encodeURIComponent(result.error)}`, base)
    );
  }

  return NextResponse.redirect(new URL(result.redirectPath, base));
}
