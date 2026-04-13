"use server";

import { revalidatePath } from "next/cache";
import { createNotification } from "@/lib/actions/notifications";
import { revalidateJobsBrowseCaches } from "@/lib/cache-revalidate";
import { LISTER_PAY_AND_START_DEADLINE_DAYS } from "@/lib/jobs/lister-payment-deadline";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { trimStr } from "@/lib/utils";
export type ExpireListerPendingPaymentJobsResult = {
  expired: number;
  errors: string[];
};

/**
 * Auto-cancel jobs stuck in `accepted` without escrow after {@link LISTER_PAY_AND_START_DEADLINE_DAYS}.
 * Sets listing to `ended` when needed so the lister sees it under No Bids / Expired (relist pool).
 */
export async function expireListerPendingPaymentJobs(): Promise<ExpireListerPendingPaymentJobsResult> {
  const admin = createSupabaseAdminClient();
  if (!admin) {
    return { expired: 0, errors: ["SUPABASE_SERVICE_ROLE_KEY not configured"] };
  }

  const nowIso = new Date().toISOString();
  const { data: candidates, error: fetchErr } = await admin
    .from("jobs")
    .select(
      "id, listing_id, lister_id, winner_id, status, payment_intent_id, lister_payment_due_at, created_at"
    )
    .eq("status", "accepted")
    .lte("lister_payment_due_at", nowIso);

  if (fetchErr) {
    return { expired: 0, errors: [fetchErr.message] };
  }

  const rows = (candidates ?? []) as {
    id: number;
    listing_id: string;
    lister_id: string;
    winner_id: string | null;
    status: string;
    payment_intent_id: string | null;
    lister_payment_due_at: string | null;
    created_at: string;
  }[];

  let expired = 0;
  const errors: string[] = [];

  for (const row of rows) {
    if (trimStr(row.payment_intent_id)) {
      continue;
    }
    const jid = typeof row.id === "number" ? row.id : Number(row.id);
    const nowRow = new Date().toISOString();

    const { error: jobUp } = await admin
      .from("jobs")
      .update({ status: "cancelled", updated_at: nowRow } as never)
      .eq("id", jid)
      .eq("status", "accepted");

    if (jobUp) {
      errors.push(`job ${jid}: ${jobUp.message}`);
      continue;
    }

    const { data: listing } = await admin
      .from("listings")
      .select("id, status")
      .eq("id", row.listing_id)
      .maybeSingle();
    const lst = listing as { id: string; status: string } | null;
    if (lst && lst.status === "live") {
      const { error: listUp } = await admin
        .from("listings")
        .update({ status: "ended" } as never)
        .eq("id", row.listing_id)
        .eq("status", "live");
      if (listUp) {
        errors.push(`listing ${row.listing_id}: ${listUp.message}`);
      }
    }

    try {
      await createNotification(
        row.lister_id,
        "job_status_update",
        jid,
        `Pay & Start Job was not completed within ${LISTER_PAY_AND_START_DEADLINE_DAYS} days. The job was cancelled and the listing is under No Bids / Expired — you can relist when ready.`,
        { listingUuid: String(row.listing_id) }
      );
    } catch (e) {
      console.error("[expireListerPendingPaymentJobs] lister notify failed", e);
    }

    if (row.winner_id) {
      try {
        await createNotification(
          row.winner_id,
          "job_status_update",
          jid,
          `The lister did not complete Pay & Start Job within ${LISTER_PAY_AND_START_DEADLINE_DAYS} days. The assignment has ended and you have been unassigned.`,
          { listingUuid: String(row.listing_id) }
        );
      } catch (e) {
        console.error("[expireListerPendingPaymentJobs] cleaner notify failed", e);
      }
    }

    revalidatePath("/dashboard");
    revalidatePath("/jobs");
    revalidatePath(`/jobs/${jid}`);
    revalidatePath(`/listings/${row.listing_id}`);
    revalidatePath("/my-listings");
    revalidatePath("/lister/dashboard");
    revalidatePath("/cleaner/dashboard");

    expired++;
  }

  if (expired > 0) {
    revalidateJobsBrowseCaches();
  }

  return { expired, errors };
}
