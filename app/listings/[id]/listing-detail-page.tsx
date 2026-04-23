import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Database } from "@/types/supabase";
import { applyListingAuctionOutcomes } from "@/lib/actions/listings";
import { buildJobListingMetadata } from "@/lib/seo/jobs-listings-seo";
import { BID_FULL_SELECT } from "@/lib/supabase/queries";
import {
  loadJobForListingDetailPage,
  loadListingFullForSession,
} from "@/lib/jobs/load-job-for-detail-route";
import { profileFieldIsAdmin } from "@/lib/is-admin";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getCachedGlobalSettingsForPages } from "@/lib/cached-global-settings-read";
import { resolvePlatformFeePercent } from "@/lib/platform-fee";
import { JobPaymentReturnAck } from "@/components/features/job-payment-return-ack";
import { JobPaymentBreakdown } from "@/components/features/job-payment-breakdown";
import { ListingAuctionDetail } from "@/components/features/listing-auction-detail";
import { parseJobTopUpPayments } from "@/lib/job-top-up";
import type { BidWithBidder } from "@/components/features/bid-history-table";
import { enrichBidsWithBidderProfiles } from "@/lib/bids/enrich-bids-with-bidders";
import { cn } from "@/lib/utils";
import { shouldShowPublicListingComments } from "@/lib/listing-public-comments-visibility";
import { fetchListingCommentsPublic } from "@/lib/actions/listing-comments";
import { countUnreadListingQaNotifications } from "@/lib/actions/notifications";
import { ListingPublicCommentsDock } from "@/components/features/listing-public-comments-dock";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ListerAdditionalPaymentReviewDialog } from "@/components/disputes/lister-additional-payment-review-dialog";
import {
  isJobCancelledStatus,
  JOB_STATUS_NOT_IN_LISTING_SLOT,
} from "@/lib/jobs/job-status-helpers";
import { Badge } from "@/components/ui/badge";
import {
  deepCleanPurposeLabel,
  normalizeServiceType,
  recurringFrequencyShortLabel,
  serviceTypeLabel,
} from "@/lib/service-types";

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
  const justPublished = firstSearchParam(sp.published) === "1";
  const paymentSuccessReturn = isStripePaymentSuccessReturn(sp);

  const paymentRedirectBase = `/listings/${encodeURIComponent(raw)}`;

  if (paymentSuccessReturn && checkoutSessionId?.startsWith("cs_")) {
    const qs = new URLSearchParams({
      session_id: checkoutSessionId,
      next: paymentRedirectBase,
    });
    redirect(`/api/stripe/checkout/return?${qs.toString()}`);
  }

  if (paymentParam === "canceled") {
    redirect(`${paymentRedirectBase}?payment_notice=canceled`);
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const sessionUserId = user?.id;

  let profile: Pick<ProfileRow, "roles" | "active_role" | "is_admin"> | null = null;
  if (user) {
    const { data } = await supabase
      .from("profiles")
      .select("roles, active_role, is_admin")
      .eq("id", user.id)
      .maybeSingle();
    profile = data as Pick<ProfileRow, "roles" | "active_role" | "is_admin"> | null;
  }

  const sessionIsAdmin = profileFieldIsAdmin(profile?.is_admin);
  const detailLoadOpts = { isAdmin: sessionIsAdmin };

  const roles = (profile?.roles as string[] | null) ?? [];
  const activeRole =
    (profile?.active_role as string | null) ?? (roles[0] ?? null);
  const isCleaner = roles.includes("cleaner") && activeRole === "cleaner";
  const isListerActive = roles.includes("lister") && activeRole === "lister";

  const listingId = raw;

  await applyListingAuctionOutcomes();

  const job = await loadJobForListingDetailPage(
    supabase,
    listingId,
    sessionUserId,
    detailLoadOpts
  );

  const listingLoaded = await loadListingFullForSession(
    supabase,
    listingId,
    sessionUserId,
    job,
    detailLoadOpts
  );

  if (!listingLoaded) {
    notFound();
  }

  const listingRow = listingLoaded as ListingRow;
  /** Named `jobRow` (not `j`) so fee/amount lines never hit TDZ if declaration order shifts. */
  let jobRow = job as JobRow | null;
  if (
    jobRow == null &&
    sessionUserId &&
    (sessionIsAdmin || String(listingRow.lister_id) === String(sessionUserId))
  ) {
    const admin = createSupabaseAdminClient();
    if (admin) {
      const { data: ownerJobFallback } = await admin
        .from("jobs")
        .select("id, status, agreed_amount_cents, top_up_payments")
        .eq("listing_id", listingId)
        .not("status", "in", JOB_STATUS_NOT_IN_LISTING_SLOT)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (ownerJobFallback) {
        jobRow = ownerJobFallback as JobRow;
      }
    }
  }

  const settings = await getCachedGlobalSettingsForPages();
  const stripeTestModeForPayment =
    (settings as { stripe_test_mode?: boolean } | null)?.stripe_test_mode === true;
  const feePercentage = resolvePlatformFeePercent(
    listingRow.platform_fee_percentage,
    settings,
    listingRow.service_type ?? null
  );
  const jobAgreed = jobRow?.agreed_amount_cents;
  const listingBuyNow = listingRow.buy_now_cents;
  const listingReserve = listingRow.reserve_cents;
  const agreedAmountCents = jobRow
    ? jobAgreed != null && jobAgreed > 0
      ? jobAgreed
      : listingBuyNow ?? listingReserve ?? 0
    : 0;
  const jobTopUpPayments = jobRow
    ? parseJobTopUpPayments(jobRow.top_up_payments)
    : [];

  const { data: bids } = await supabase
    .from("bids")
    .select(BID_FULL_SELECT)
    .eq("listing_id", listingId)
    .order("created_at", { ascending: false });

  const initialBids: BidWithBidder[] = await enrichBidsWithBidderProfiles(bids ?? []);

  const hasActiveJob = !!jobRow && !isJobCancelledStatus(jobRow.status);
  const numericJobId = jobRow?.id ?? null;
  const securedViaBuyNow =
    Boolean(
      (jobRow as { secured_via_buy_now?: boolean | null } | null)?.secured_via_buy_now
    ) === true;
  const buyNowHistoryAmountCents: number | null = securedViaBuyNow
    ? typeof listingRow.buy_now_cents === "number" && listingRow.buy_now_cents > 0
      ? listingRow.buy_now_cents
      : agreedAmountCents > 0
        ? agreedAmountCents
        : null
    : null;

  /** You own the listing and have lister on your profile (independent of active role). */
  const ownsListingAsLister =
    !!user &&
    String(listingRow.lister_id) === String(user.id) &&
    roles.includes("lister");

  const ownsThisListing =
    !!sessionUserId && String(listingRow.lister_id) === String(sessionUserId);
  const showPublishedBanner = justPublished && ownsThisListing;
  /** Browsing as Lister on someone else's listing — no Q&A posting (switch to Cleaner to participate). */
  const listerActiveViewingOthersListing =
    !!sessionUserId && !ownsThisListing && isListerActive;

  const showPublicComments = shouldShowPublicListingComments(listingRow, hasActiveJob);
  const [initialPublicComments, initialQaUnreadCount] = await Promise.all([
    showPublicComments
      ? fetchListingCommentsPublic(listingId, String(listingRow.lister_id))
      : Promise.resolve([]),
    showPublicComments && sessionUserId
      ? countUnreadListingQaNotifications(listingId)
      : Promise.resolve(0),
  ]);

  let pendingCleanerPaymentRequest: {
    id: string;
    amount_cents: number;
    reason: string;
    job_id: number;
  } | null = null;
  if (ownsListingAsLister && jobRow?.id != null && sessionUserId) {
    const adminPay = createSupabaseAdminClient();
    if (adminPay) {
      const { data: payReq } = await adminPay
        .from("cleaner_additional_payment_requests")
        .select("id, amount_cents, reason, job_id")
        .eq("job_id", jobRow.id)
        .eq("lister_id", sessionUserId)
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      const pr = payReq as {
        id?: string;
        amount_cents?: number;
        reason?: string | null;
        job_id?: number;
      } | null;
      if (pr?.id) {
        pendingCleanerPaymentRequest = {
          id: String(pr.id),
          amount_cents: Number(pr.amount_cents ?? 0),
          reason: String(pr.reason ?? ""),
          job_id: Number(pr.job_id ?? jobRow.id),
        };
      }
    }
  }

  return (
    <section
      className={cn(
        "space-y-4 pt-1 pb-6 sm:space-y-6 sm:pt-4",
        showPublicComments && "pb-20 xl:pb-6"
      )}
    >
      <JobPaymentReturnAck
        notice={
          paymentNotice === "success" ||
          paymentNotice === "top_up_success" ||
          paymentNotice === "error" ||
          paymentNotice === "canceled"
            ? paymentNotice
            : null
        }
        agreedAmountCents={agreedAmountCents}
        feePercentage={feePercentage}
        isStripeTestMode={stripeTestModeForPayment}
      />
      {showPublishedBanner ? (
        <div className="page-inner mx-auto w-full max-w-6xl px-3 pt-2 sm:px-4">
          <Alert
            variant="success"
            className="border-emerald-200 bg-emerald-50/90 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-50"
          >
            <AlertDescription className="flex flex-col gap-2 text-sm sm:flex-row sm:items-center sm:justify-between">
              <span>
                Your listing is live — cleaners can bid now. You&apos;ll get notifications as bids come in.
              </span>
              <Link
                href={`/listings/${encodeURIComponent(listingId)}`}
                className="shrink-0 font-semibold text-emerald-900 underline-offset-4 hover:underline dark:text-emerald-100"
              >
                Dismiss
              </Link>
            </AlertDescription>
          </Alert>
        </div>
      ) : null}
      {pendingCleanerPaymentRequest ? (
        <div className="page-inner mx-auto w-full max-w-6xl px-3 pt-2 sm:px-4">
          <Alert className="border-violet-300/80 bg-violet-50/90 text-violet-950 dark:border-violet-800 dark:bg-violet-950/35 dark:text-violet-50">
            <AlertDescription className="flex flex-col gap-3 text-sm sm:flex-row sm:items-center sm:justify-between">
              <span>
                Your cleaner requested an additional payment of{" "}
                <strong className="text-foreground dark:text-white">
                  ${(pendingCleanerPaymentRequest.amount_cents / 100).toFixed(2)} AUD
                </strong>{" "}
                for this job. Review the details to accept (you&apos;ll pay through Stripe) or deny.
              </span>
              <ListerAdditionalPaymentReviewDialog
                requestId={pendingCleanerPaymentRequest.id}
                amountCents={pendingCleanerPaymentRequest.amount_cents}
                reason={pendingCleanerPaymentRequest.reason}
                jobId={pendingCleanerPaymentRequest.job_id}
                triggerClassName="shrink-0 bg-violet-600 text-white hover:bg-violet-700 dark:bg-violet-600 dark:hover:bg-violet-500"
              />
            </AlertDescription>
          </Alert>
        </div>
      ) : null}
      <div className="page-inner mx-auto w-full max-w-6xl px-3 sm:px-4">
        <div
          className={cn(
            "xl:grid xl:gap-6",
            showPublicComments
              ? "xl:grid-cols-[minmax(0,1fr)_min(300px,32%)] xl:items-stretch xl:gap-8"
              : "xl:items-start"
          )}
        >
          <div className="min-w-0 xl:min-h-0">
            {hasActiveJob &&
              jobRow &&
              ownsListingAsLister &&
              agreedAmountCents > 0 &&
              (jobRow.status === "accepted" ||
                jobRow.status === "in_progress" ||
                jobRow.status === "completed_pending_approval") && (
                <div className="mb-4 space-y-3">
                  <JobPaymentBreakdown
                    agreedAmountCents={agreedAmountCents}
                    feePercentage={feePercentage}
                    isStripeTestMode={stripeTestModeForPayment}
                    variant={
                      jobRow.status === "accepted" ? "pay" : "release"
                    }
                    topUpPayments={jobTopUpPayments}
                  />
                </div>
              )}
            {(() => {
              const lr = listingRow as ListingRow & {
                recurring_frequency?: string | null;
                airbnb_guest_capacity?: number | null;
                airbnb_turnaround_hours?: number | null;
                deep_clean_purpose?: string | null;
              };
              const st = normalizeServiceType(lr.service_type);
              const metaBits: string[] = [];
              if (st === "recurring_house_cleaning" && lr.recurring_frequency) {
                metaBits.push(recurringFrequencyShortLabel(lr.recurring_frequency));
              }
              if (st === "airbnb_turnover") {
                if (typeof lr.airbnb_guest_capacity === "number")
                  metaBits.push(`${lr.airbnb_guest_capacity} guests`);
                if (typeof lr.airbnb_turnaround_hours === "number")
                  metaBits.push(`${lr.airbnb_turnaround_hours}h turnaround`);
              }
              if (st === "deep_clean" && lr.deep_clean_purpose) {
                metaBits.push(deepCleanPurposeLabel(lr.deep_clean_purpose));
              }
              return (
                <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-border/80 bg-muted/25 px-3 py-3 dark:border-gray-800 dark:bg-gray-900/50">
                  <Badge variant="secondary" className="text-xs font-semibold">
                    {serviceTypeLabel(st)}
                  </Badge>
                  {lr.is_urgent === true ? (
                    <Badge className="border border-red-400/50 bg-red-600 text-xs font-black uppercase tracking-wide text-white">
                      Urgent
                    </Badge>
                  ) : null}
                  {metaBits.length > 0 ? (
                    <span className="text-sm text-muted-foreground dark:text-gray-400">
                      {metaBits.join(" · ")}
                    </span>
                  ) : null}
                </div>
              );
            })()}
            <ListingAuctionDetail
              listing={listingRow}
              initialBids={initialBids}
              isCleaner={isCleaner}
              isListerOwner={ownsListingAsLister}
              isListerSessionActive={isListerActive}
              hasActiveJob={hasActiveJob}
              numericJobId={numericJobId}
              currentUserId={sessionUserId ?? null}
              securedViaBuyNow={securedViaBuyNow}
              buyNowHistoryAmountCents={buyNowHistoryAmountCents}
            />
          </div>
          {showPublicComments ? (
            <ListingPublicCommentsDock
              listingId={listingId}
              listerId={String(listingRow.lister_id)}
              initialComments={initialPublicComments}
              currentUserId={sessionUserId ?? null}
              ownerListerSession={ownsListingAsLister && isListerActive}
              listerActiveViewingOthersListing={listerActiveViewingOthersListing}
              initialQaUnreadCount={initialQaUnreadCount}
            />
          ) : null}
        </div>
      </div>
    </section>
  );
}
