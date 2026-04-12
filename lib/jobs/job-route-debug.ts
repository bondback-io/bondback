import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/types/supabase";
import { LISTING_FULL_SELECT } from "@/lib/supabase/queries";
import type { ServerSupabaseClient } from "@/lib/jobs/load-job-for-detail-route";
import { isMarketplaceVisibleListing } from "@/lib/jobs/load-job-for-detail-route";

export type JobRouteDebugPayload = {
  routeParam: string;
  numericJobId: number;
  sessionPresent: boolean;
  sessionUserIdPrefix: string | null;
  userSawJobRow: boolean;
  adminClientConfigured: boolean;
  adminSawJobRow: boolean;
  userQueryError: { code?: string; message?: string } | null;
  adminQueryError: { code?: string; message?: string } | null;
  listingIdFromAdmin: string | null;
  /** When the job row exists (admin): whether the linked listing passes `isMarketplaceVisibleListing`. */
  listingMarketplaceVisible: boolean | null;
};

const JOB_GATE_SELECT = "id, listing_id";

/**
 * Low-level snapshot for `?debug=1` when `loadJobByNumericIdForSession` returns null.
 */
export async function buildJobRouteDebugSnapshot(
  supabase: ServerSupabaseClient,
  numericId: number,
  raw: string,
  sessionUserId: string | null
): Promise<JobRouteDebugPayload> {
  const admin = createSupabaseAdminClient();

  const [userRes, adminRes] = await Promise.all([
    supabase.from("jobs").select(JOB_GATE_SELECT).eq("id", numericId).maybeSingle(),
    admin
      ? admin.from("jobs").select(JOB_GATE_SELECT).eq("id", numericId).maybeSingle()
      : Promise.resolve({
          data: null as { id: number; listing_id: string } | null,
          error: null as { message: string; code?: string } | null,
        }),
  ]);

  const userSawJobRow = !!userRes.data;
  const adminSawJobRow = !!adminRes.data;
  const listingIdFromAdmin = adminRes.data?.listing_id ?? null;

  let listingMarketplaceVisible: boolean | null = null;
  if (admin && listingIdFromAdmin) {
    const { data: lr } = await admin
      .from("listings")
      .select(LISTING_FULL_SELECT)
      .eq("id", listingIdFromAdmin)
      .maybeSingle();
    if (lr) {
      listingMarketplaceVisible = isMarketplaceVisibleListing(
        lr as Database["public"]["Tables"]["listings"]["Row"]
      );
    }
  }

  return {
    routeParam: raw,
    numericJobId: numericId,
    sessionPresent: !!sessionUserId,
    sessionUserIdPrefix: sessionUserId ? `${sessionUserId.slice(0, 8)}…` : null,
    userSawJobRow,
    adminClientConfigured: !!admin,
    adminSawJobRow,
    userQueryError: userRes.error
      ? { code: userRes.error.code, message: userRes.error.message }
      : null,
    adminQueryError: adminRes.error
      ? { code: adminRes.error.code, message: adminRes.error.message }
      : null,
    listingIdFromAdmin,
    listingMarketplaceVisible,
  };
}
