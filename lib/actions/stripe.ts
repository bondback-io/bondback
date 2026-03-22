"use server";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createBuyNowCheckoutSessionUrl } from "@/lib/stripe";
import type { Database } from "@/types/supabase";

type ListingRow = Database["public"]["Tables"]["listings"]["Row"];

/**
 * Create a Stripe Checkout Session for Buy-Now and return the redirect URL.
 * Client should redirect to the returned url.
 */
export async function createBuyNowCheckoutSession(
  listingId: string
): Promise<{ url?: string; error?: string }> {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { session }
    } = await supabase.auth.getSession();
    if (!session) {
      return { error: "You must be logged in to buy now." };
    }

    const { data: listing, error: fetchError } = await supabase
      .from("listings")
      .select("*")
      .eq("id", listingId)
      .single();

    if (fetchError || !listing) {
      return { error: "Listing not found." };
    }

    const row = listing as ListingRow;
    if (!row.buy_now_cents || row.buy_now_cents <= 0) {
      return { error: "This listing has no buy-now price." };
    }
    if (row.status !== "live") {
      return { error: "Listing is no longer available for buy-now." };
    }

    const { getGlobalSettings } = await import("@/lib/actions/global-settings");
    const settings = await getGlobalSettings();
    if (settings?.require_stripe_connect_before_bidding !== false) {
      const { data: profileRow } = await supabase
        .from("profiles")
        .select("stripe_connect_id, stripe_onboarding_complete")
        .eq("id", session.user.id)
        .maybeSingle();
      const pr = profileRow as { stripe_connect_id?: string | null; stripe_onboarding_complete?: boolean } | null;
      if (!pr?.stripe_connect_id?.trim() || pr?.stripe_onboarding_complete !== true) {
        return { error: "Please connect your bank account to receive payment. Go to Profile or Settings to connect." };
      }
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const url = await createBuyNowCheckoutSessionUrl(
      {
        id: row.id,
        title: row.title,
        suburb: row.suburb,
        postcode: row.postcode,
        buy_now_cents: row.buy_now_cents,
        lister_id: row.lister_id,
      },
      baseUrl
    );

    if (!url) return { error: "Failed to create checkout session." };
    return { url };
  } catch (err: any) {
    console.error("[buy-now] failed to create checkout session", err);
    const message =
      err?.message?.includes("STRIPE_SECRET_KEY") || err?.message?.includes("Stripe")
        ? "Buy now checkout is not configured yet. Please try again later."
        : "Failed to create checkout session.";
    return { error: message };
  }
}
