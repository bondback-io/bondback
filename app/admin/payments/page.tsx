import { redirect } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getPaymentsOverview } from "@/lib/actions/admin-payments";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AdminShell } from "@/components/admin/admin-shell";
import { AdminPaymentsCharts } from "@/components/admin/admin-payments-charts";
import { DollarSign } from "lucide-react";

function formatCents(cents: number) {
  return (cents / 100).toLocaleString("en-AU", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 0,
  });
}

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

  return (
    <AdminShell activeHref="/admin/payments">
      <div className="space-y-6">
        <div>
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl dark:text-gray-100">
          Payments &amp; Revenue
        </h1>
        <p className="text-sm text-muted-foreground">
          Platform fees, escrow and payout overview. Revenue is computed from
          completed jobs (12% fee).
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid gap-3 text-xs sm:grid-cols-2 lg:grid-cols-4 sm:text-sm">
        <Card className="border-border bg-card/80 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-200">
              <DollarSign className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Total platform revenue
              </p>
              <p className="text-lg font-semibold text-foreground dark:text-gray-100">
                {formatCents(overview.totalPlatformRevenueCents)}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-card/80 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-200">
              <DollarSign className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Pending payouts (escrow)
              </p>
              <p className="text-lg font-semibold text-foreground dark:text-gray-100">
                {formatCents(overview.pendingPayoutsCents)}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-card/80 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-sky-100 text-sky-700 dark:bg-sky-900/50 dark:text-sky-200">
              <DollarSign className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Paid out this month
              </p>
              <p className="text-lg font-semibold text-foreground dark:text-gray-100">
                {formatCents(overview.paidOutThisMonthCents)}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-card/80 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
              <DollarSign className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Average fee per job
              </p>
              <p className="text-lg font-semibold text-foreground dark:text-gray-100">
                {formatCents(overview.averageFeePerJobCents)}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <Card className="border-border bg-card/80 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <CardHeader>
          <CardTitle className="text-base md:text-lg dark:text-gray-100">
            Fees &amp; payout volume
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Line: platform fees by month. Bar: payout volume to cleaners by
            month.
          </p>
        </CardHeader>
        <CardContent>
          <AdminPaymentsCharts monthlyData={overview.monthlyData} />
        </CardContent>
      </Card>

      {/* Recent transactions table */}
      <Card className="border-border bg-card/80 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <CardHeader>
          <CardTitle className="text-base md:text-lg dark:text-gray-100">
            Recent transactions
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Completed jobs: amount paid to cleaner, fee retained, date. Status
            paid when escrow released (job completed).
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          {overview.recentTransactions.length === 0 ? (
            <div className="rounded-md border border-dashed border-border bg-muted/30 px-4 py-8 text-center text-sm text-muted-foreground dark:border-gray-700 dark:bg-gray-900/60">
              No completed transactions yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Job ID</TableHead>
                    <TableHead className="hidden md:table-cell">
                      Cleaner
                    </TableHead>
                    <TableHead className="text-right">Amount paid</TableHead>
                    <TableHead className="text-right">Fee taken</TableHead>
                    <TableHead className="hidden sm:table-cell">Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {overview.recentTransactions.map(({ job, feeCents, payoutCents }) => {
                    const cleaner = job.winner_id
                      ? overview.profilesMap.get(job.winner_id)
                    : null;
                  const date = job.updated_at || job.created_at;

                  return (
                    <TableRow key={job.id}>
                      <TableCell>
                        <span className="font-medium text-foreground dark:text-gray-100">
                          #{job.id}
                        </span>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-[11px] text-muted-foreground">
                        {cleaner?.full_name ?? "—"}
                      </TableCell>
                      <TableCell className="text-right text-[11px] font-medium tabular-nums text-foreground dark:text-gray-100 sm:text-xs">
                        {formatCents(payoutCents)}
                      </TableCell>
                      <TableCell className="text-right text-[11px] tabular-nums text-muted-foreground sm:text-xs">
                        {formatCents(feeCents)}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-[11px] text-muted-foreground">
                        {date ? format(new Date(date), "dd MMM yyyy") : "—"}
                      </TableCell>
                      <TableCell>
                        <Badge className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200">
                          Paid
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          <Button
                            asChild
                            size="xs"
                            variant="outline"
                            className="text-[11px]"
                          >
                            <Link href={`/jobs/${job.id}`}>
                              View payout details
                            </Link>
                          </Button>
                          <Button
                            size="xs"
                            variant="ghost"
                            className="text-[11px] text-muted-foreground"
                            disabled
                            title="Stub: connect Stripe for manual payouts"
                          >
                            Manual payout (stub)
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
      </div>
    </AdminShell>
  );
}
