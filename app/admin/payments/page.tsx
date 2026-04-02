import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getPaymentsOverview } from "@/lib/actions/admin-payments";
import { AdminShell } from "@/components/admin/admin-shell";
import { AdminPaymentsPageClient } from "@/components/admin/admin-payments-page-client";

export default async function AdminPaymentsPage() {
  const supabase = await createServerSupabaseClient();

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    redirect("/");
  }

  const { data: profileData } = await supabase
    .from("profiles")
    .select("id, is_admin")
    .eq("id", session.user.id)
    .maybeSingle();

  if (!profileData || !(profileData as { is_admin?: boolean }).is_admin) {
    redirect("/dashboard");
  }

  const overview = await getPaymentsOverview();
  const profilesById = Object.fromEntries(overview.profilesMap.entries());

  return (
    <AdminShell activeHref="/admin/payments">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl dark:text-gray-100">
            Payments &amp; Revenue
          </h1>
          <p className="text-sm text-muted-foreground">
            Platform fees, escrow, and payout overview. Use the tabs for potential fees (live auctions and jobs awaiting
            payment) versus actual fees already charged while work is in escrow.
          </p>
        </div>

        <AdminPaymentsPageClient
          totalPlatformRevenueCents={overview.totalPlatformRevenueCents}
          actualActiveEscrowFeeCents={overview.actualActiveEscrowFeeCents}
          potentialTotalFeeCents={overview.potentialTotalFeeCents}
          potentialLiveListingsFeeCents={overview.potentialLiveListingsFeeCents}
          potentialAcceptedJobsFeeCents={overview.potentialAcceptedJobsFeeCents}
          pendingPayoutsCents={overview.pendingPayoutsCents}
          paidOutThisMonthCents={overview.paidOutThisMonthCents}
          averageFeePerJobCents={overview.averageFeePerJobCents}
          monthlyData={overview.monthlyData}
          recentTransactions={overview.recentTransactions}
          profilesById={profilesById}
          potentialLiveListings={overview.potentialLiveListings}
          potentialAcceptedJobs={overview.potentialAcceptedJobs}
          actualEscrowJobs={overview.actualEscrowJobs}
        />
      </div>
    </AdminShell>
  );
}
