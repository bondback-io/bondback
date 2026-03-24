import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createBuyNowCheckoutSessionUrl } from "@/lib/stripe";
import type { Database } from "@/types/supabase";

type ListingRow = Database["public"]["Tables"]["listings"]["Row"];

/**
 * POST /api/stripe/checkout – Create Stripe Checkout Session for Buy-Now.
 * Body: { listingId: string }
 * Returns: { url: string } for redirect to Stripe Checkout.
 */
export async function POST(request: Request) {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { session }
    } = await supabase.auth.getSession();
    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const listingId = body?.listingId as string | undefined;
    if (!listingId) {
      return NextResponse.json(
        { error: "listingId required" },
        { status: 400 }
      );
    }

    const { data: listing, error: fetchError } = await supabase
      .from("listings")
      .select("*")
      .eq("id", listingId)
      .single();

    if (fetchError || !listing) {
      return NextResponse.json(
        { error: "Listing not found" },
        { status: 404 }
      );
    }

    const row = listing as ListingRow;
    if (!row.buy_now_cents || row.buy_now_cents <= 0) {
      return NextResponse.json(
        { error: "Listing has no buy-now price" },
        { status: 400 }
      );
    }
    if (row.status !== "live") {
      return NextResponse.json(
        { error: "Listing is not available for buy-now" },
        { status: 400 }
      );
    }

    const url = await createBuyNowCheckoutSessionUrl({
      id: row.id,
      title: row.title,
      suburb: row.suburb,
      postcode: row.postcode,
      buy_now_cents: row.buy_now_cents,
      lister_id: row.lister_id,
    });

    if (!url) {
      return NextResponse.json(
        { error: "Failed to create checkout session" },
        { status: 500 }
      );
    }

    return NextResponse.json({ url });
  } catch (err) {
    console.error("[stripe/checkout]", err);
    return NextResponse.json(
      { error: "Checkout failed" },
      { status: 500 }
    );
  }
}
