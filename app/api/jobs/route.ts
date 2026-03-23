import { NextResponse } from "next/server";
import { getJobsPage } from "@/lib/actions/jobs-list";
import type { JobsListFilters } from "@/lib/jobs-query";

/**
 * GET /api/jobs
 * Returns jobs list (live listings + bid counts) for offline cache and client use.
 * Query: same filters as jobs page (suburb, postcode, sort, prices, bid range, buy_now_only, bedrooms, etc.).
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const filters: JobsListFilters = {
    suburb: searchParams.get("suburb") ?? undefined,
    postcode: searchParams.get("postcode") ?? undefined,
    sort: searchParams.get("sort") ?? undefined,
    min_price: searchParams.get("min_price") ?? undefined,
    max_price: searchParams.get("max_price") ?? undefined,
    min_bid_price: searchParams.get("min_bid_price") ?? undefined,
    max_bid_price: searchParams.get("max_bid_price") ?? undefined,
    buy_now_only: searchParams.get("buy_now_only") ?? undefined,
    bedrooms: searchParams.get("bedrooms") ?? undefined,
    bathrooms: searchParams.get("bathrooms") ?? undefined,
    property_type: searchParams.get("property_type") ?? undefined,
  };

  const result = await getJobsPage(1, filters);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.error?.includes("logged in") ? 401 : 400 });
  }
  return NextResponse.json({
    listings: result.listings,
    bidCountByListingId: result.bidCountByListingId,
  });
}
