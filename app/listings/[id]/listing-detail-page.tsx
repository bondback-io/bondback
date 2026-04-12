import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Database } from "@/types/supabase";
import { fulfillStripeCheckoutReturn } from "@/lib/actions/jobs";
import { buildJobListingMetadata } from "@/lib/seo/jobs-listings-seo";
import { BID_FULL_SELECT } from "@/lib/supabase/queries";
import {
  loadJobForListingDetailPage,
  loadListingFullForSession,
} from "@/lib/jobs/load-job-for-detail-route";
import { getCachedGlobalSettingsForPages } from "@/lib/cached-global-settings-read";
import { resolvePlatformFeePercent } from "@/lib/platform-fee";
import { JobPaymentReturnAck } from "@/components/features/job-payment-return-ack";
import { ListingAuctionDetail } from "@/components/features/listing-auction-detail";
import type { BidWithBidder } from "@/components/features/bid-history-table";

export const dynamic = "force-dynamic";

type ListingRow = Database["public"]["Tables"]["listings"]["Row"];
type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
type JobRow = Database["public"]["Tables"]["jobs"]["Row"];

function firstSearchParam(
  v: string | string[] | undefined
): string | undefined {
  if (v == null) return undefined;
  return Array.isArray(v) ? v[0] : v;
}

function isStripePaymentSuccessReturn(
  sp: Record<string, string | string[] | undefined>
): boolean {
  if (firstSearchParam(sp.payment) === "success") return true;
  if (sp["payment-success"] !== undefined) return true;
  return false;
}

function searchParamsToQueryString(
  sp: Record<string, string | string[] | undefined>
): string {
  const u = new URLSearchParams();
  for (const [key, val] of Object.entries(sp)) {
    const v = firstSearchParam(val);
    if (v != null) u.set(key, v);
  }
  const qs = u.toString();
  return qs ? `?${qs}` : "";
}

/** Do not use `redirect()` here — it throws NEXT_REDIRECT and shows as a dev overlay error. */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  try {
    const resolvedParams = await params;
    const id = resolvedParams.id.trim();
    return await buildJobListingMetadata(id, {
      canonical: "listings",
    });
  } catch (e) {
    console.error("[listings/[id]] generateMetadata failed", e);
    return {
      title: "Listing · Bond Back",
      robots: { index: false, follow: true },
    };
  }
}

export default async function ListingDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedParams = await params;
  const raw = resolvedParams.id.trim();

  const sp = searchParams ? await searchParams : {};

  const paymentParam = firstSearchParam(sp.payment);
  const checkoutSessionId = firstSearchParam(sp.session_id);
  const paymentNotice = firstSearchParam(sp.payment_notice);
  const paymentSuccessReturn = isStripePaymentSuccessReturn(sp);

  const paymentRedirectBase = `/listings/${encodeURIComponent(raw)}`;

  if (paymentSuccessReturn && checkoutSessionId?.startsWith("cs_")) {
    const result = await fulfillStripeCheckoutReturn(checkoutSessionId);
    redirect(
      `${paymentRedirectBase}?payment_notice=${result.ok ? "success" : "error"}`
    );
  }

  if (paymentParam === "canceled") {
    redirect(`${paymentRedirectBase}?payment_notice=canceled`);
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const sessionUserId = user?.id;

  let profile: Pick<ProfileRow, "roles" | "active_role"> | null = null;
  if (user) {
    const { data } = await supabase
      .from("profiles")
      .select("roles, active_role")
      .eq("id", user.id)
      .maybeSingle();
    profile = data as Pick<ProfileRow, "roles" | "active_role"> | null;
  }

  const roles = (profile?.roles as string[] | null) ?? [];
  const activeRole =
    (profile?.active_role as string | null) ?? (roles[0] ?? null);
  const isCleaner = roles.includes("cleaner") && activeRole === "cleaner";
  const isListerActive = roles.includes("lister") && activeRole === "lister";

  const listingId = raw;
  const job = await loadJobForListingDetailPage(
    supabase,
    listingId,
    sessionUserId
  );

  const listingLoaded = await loadListingFullForSession(
    supabase,
    listingId,
    sessionUserId,
    job
  );

  if (!listingLoaded) {
    notFound();
  }

  const listingRow = listingLoaded as ListingRow;
  /** Named `jobRow` (not `j`) so fee/amount lines never hit TDZ if declaration order shifts. */
  const jobRow = job as JobRow | null;

  const settings = await getCachedGlobalSettingsForPages();
  const stripeTestModeForPayment =
    (settings as { stripe_test_mode?: boolean } | null)?.stripe_test_mode === true;
  const feePercentage = resolvePlatformFeePercent(
    listingRow.platform_fee_percentage,
    settings
  );
  const jobAgreed = jobRow?.agreed_amount_cents;
  const listingBuyNow = listingRow.buy_now_cents;
  const listingReserve = listingRow.reserve_cents;
  const agreedAmountCents = jobRow
    ? jobAgreed != null && jobAgreed > 0
      ? jobAgreed
      : listingBuyNow ?? listingReserve ?? 0
    : 0;

  const { data: bids } = await supabase
    .from("bids")
    .select(BID_FULL_SELECT)
    .eq("listing_id", listingId)
    .order("created_at", { ascending: false });

  const initialBids: BidWithBidder[] = (bids ?? []) as BidWithBidder[];

  const hasActiveJob = !!jobRow && jobRow.status !== "cancelled";
  const numericJobId = jobRow?.id ?? null;

  /** You own the listing and have lister on your profile (independent of active role). */
  const ownsListingAsLister =
    !!user &&
    String(listingRow.lister_id) === String(user.id) &&
    roles.includes("lister");

  return (
    <section className="space-y-6 py-6">
      <JobPaymentReturnAck
        notice={
          paymentNotice === "success" ||
          paymentNotice === "error" ||
          paymentNotice === "canceled"
            ? paymentNotice
            : null
        }
        agreedAmountCents={agreedAmountCents}
        feePercentage={feePercentage}
        isStripeTestMode={stripeTestModeForPayment}
      />
      <ListingAuctionDetail
        listing={listingRow}
        initialBids={initialBids}
        isCleaner={isCleaner}
        isListerOwner={ownsListingAsLister}
        isListerSessionActive={isListerActive}
        hasActiveJob={hasActiveJob}
        numericJobId={numericJobId}
        currentUserId={sessionUserId ?? null}
      />
    </section>
  );
}
