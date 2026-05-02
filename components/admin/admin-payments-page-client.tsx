"use client";

import Link from "next/link";
import { format } from "date-fns";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AdminPaymentsCharts } from "@/components/admin/admin-payments-charts";
import { DollarSign } from "lucide-react";
import type {
  MonthlyPoint,
  RecentTransaction,
  PotentialListingRow,
  PotentialAcceptedJobRow,
  ActualEscrowJobRow,
} from "@/lib/actions/admin-payments";

function formatCents(cents: number) {
  return (cents / 100).toLocaleString("en-AU", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 0,
  });
}

type Props = {
  totalPlatformRevenueCents: number;
  actualActiveEscrowFeeCents: number;
  potentialTotalFeeCents: number;
  potentialLiveListingsFeeCents: number;
  potentialAcceptedJobsFeeCents: number;
  pendingPayoutsCents: number;
  paidOutThisMonthCents: number;
  averageFeePerJobCents: number;
  monthlyData: MonthlyPoint[];
  recentTransactions: RecentTransaction[];
  profilesById: Record<string, { full_name: string | null }>;
  potentialLiveListings: PotentialListingRow[];
  potentialAcceptedJobs: PotentialAcceptedJobRow[];
  actualEscrowJobs: ActualEscrowJobRow[];
};

export function AdminPaymentsPageClient(props: Props) {
  const {
    totalPlatformRevenueCents,
    actualActiveEscrowFeeCents,
    potentialTotalFeeCents,
    potentialLiveListingsFeeCents,
    potentialAcceptedJobsFeeCents,
    pendingPayoutsCents,
    paidOutThisMonthCents,
    averageFeePerJobCents,
    monthlyData,
    recentTransactions,
    profilesById,
    potentialLiveListings,
    potentialAcceptedJobs,
    actualEscrowJobs,
  } = props;

  return (
    <Tabs defaultValue="overview" className="space-y-6">
      <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1 bg-muted/50 p-1 dark:bg-gray-900/80">
        <TabsTrigger value="overview" className="text-xs sm:text-sm">
          Overview
        </TabsTrigger>
        <TabsTrigger value="potential" className="text-xs sm:text-sm">
          Potential platform revenue
        </TabsTrigger>
        <TabsTrigger value="actual" className="text-xs sm:text-sm">
          Actual platform revenue
        </TabsTrigger>
      </TabsList>

      <TabsContent value="overview" className="space-y-6">
        <div className="grid gap-3 text-xs sm:grid-cols-2 lg:grid-cols-4 sm:text-sm">
          <Card className="border-border bg-card/80 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <CardContent className="flex items-center gap-3 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-200">
                <DollarSign className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Realised revenue (completed jobs)
                </p>
                <p className="text-lg font-semibold text-foreground dark:text-gray-100">
                  {formatCents(totalPlatformRevenueCents)}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border bg-card/80 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <CardContent className="flex items-center gap-3 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-200">
                <DollarSign className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Fee in escrow (active jobs)
                </p>
                <p className="text-lg font-semibold text-foreground dark:text-gray-100">
                  {formatCents(actualActiveEscrowFeeCents)}
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
                  {formatCents(pendingPayoutsCents)}
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
                  {formatCents(paidOutThisMonthCents)}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Card className="border-border bg-card/80 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <CardContent className="flex items-center gap-3 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                <DollarSign className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Average fee per completed job
                </p>
                <p className="text-lg font-semibold text-foreground dark:text-gray-100">
                  {formatCents(averageFeePerJobCents)}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border bg-card/80 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <CardContent className="flex items-center gap-3 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-200">
                <DollarSign className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Potential Service Fees (estimate)
                </p>
                <p className="text-lg font-semibold text-foreground dark:text-gray-100">
                  {formatCents(potentialTotalFeeCents)}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  Live auctions + accepted jobs awaiting payment — see Potential tab
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="border-border bg-card/80 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <CardHeader>
            <CardTitle className="text-base md:text-lg dark:text-gray-100">
              Fees &amp; payout volume
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Line: Service Fees by month (completed jobs). Bar: payout volume to cleaners by month.
            </p>
          </CardHeader>
          <CardContent>
            <AdminPaymentsCharts monthlyData={monthlyData} />
          </CardContent>
        </Card>

        <Card className="border-border bg-card/80 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <CardHeader>
            <CardTitle className="text-base md:text-lg dark:text-gray-100">
              Recent completed transactions
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Completed jobs: cleaner payout (includes any Bond Back promo), net platform fee retained after promo, and
              promo amount funded from the service fee (not charged to the lister).
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentTransactions.length === 0 ? (
              <div className="rounded-md border border-dashed border-border bg-muted/30 px-4 py-8 text-center text-sm text-muted-foreground dark:border-gray-700 dark:bg-gray-900/60">
                No completed transactions yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Job ID</TableHead>
                      <TableHead className="hidden md:table-cell">Cleaner</TableHead>
                      <TableHead className="text-right">Cleaner received</TableHead>
                      <TableHead className="hidden lg:table-cell text-right" title="Before Bond Back promo">
                        Nominal fee
                      </TableHead>
                      <TableHead className="text-right">Net fee kept</TableHead>
                      <TableHead className="text-right">Bond Back promo</TableHead>
                      <TableHead className="hidden sm:table-cell">Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recentTransactions.map(
                      ({
                        job,
                        nominalFeeCents,
                        cleanerPromoBonusCents,
                        feeCents,
                        payoutCents,
                      }) => {
                      const cleaner = job.winner_id ? profilesById[job.winner_id] : null;
                      const date = job.updated_at || job.created_at;

                      return (
                        <TableRow key={job.id}>
                          <TableCell>
                            <span className="font-medium text-foreground dark:text-gray-100">#{job.id}</span>
                          </TableCell>
                          <TableCell className="hidden md:table-cell text-[11px] text-muted-foreground">
                            {cleaner?.full_name ?? "—"}
                          </TableCell>
                          <TableCell className="text-right text-[11px] font-medium tabular-nums text-foreground dark:text-gray-100 sm:text-xs">
                            {formatCents(payoutCents)}
                          </TableCell>
                          <TableCell className="hidden lg:table-cell text-right text-[11px] tabular-nums text-muted-foreground sm:text-xs">
                            {formatCents(nominalFeeCents)}
                          </TableCell>
                          <TableCell
                            className="text-right text-[11px] tabular-nums text-muted-foreground sm:text-xs"
                            title={
                              cleanerPromoBonusCents >= 1
                                ? `Net fee after ${formatCents(cleanerPromoBonusCents)} Bond Back promo from nominal ${formatCents(nominalFeeCents)}`
                                : undefined
                            }
                          >
                            {formatCents(feeCents)}
                          </TableCell>
                          <TableCell className="text-right text-[11px] tabular-nums text-emerald-700 dark:text-emerald-400 sm:text-xs">
                            {cleanerPromoBonusCents >= 1 ? formatCents(cleanerPromoBonusCents) : "—"}
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
                              <Button asChild size="xs" variant="outline" className="text-[11px]">
                                <Link href={`/jobs/${job.id}`}>View payout details</Link>
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
      </TabsContent>

      <TabsContent value="potential" className="space-y-6">
        <Card className="border-border bg-card/80 dark:border-gray-800 dark:bg-gray-900">
          <CardHeader>
            <CardTitle className="text-base dark:text-gray-100">Potential platform revenue</CardTitle>
            <p className="text-xs text-muted-foreground">
              Estimated fees if current bids win and accepted jobs are paid at today&apos;s amounts. Not charged until
              checkout (Pay &amp; Start Job).
            </p>
            <div className="flex flex-wrap gap-4 pt-2 text-sm">
              <div>
                <span className="text-muted-foreground">Live listings (estimate): </span>
                <span className="font-semibold tabular-nums text-foreground dark:text-gray-100">
                  {formatCents(potentialLiveListingsFeeCents)}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Accepted, awaiting payment: </span>
                <span className="font-semibold tabular-nums text-foreground dark:text-gray-100">
                  {formatCents(potentialAcceptedJobsFeeCents)}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Combined: </span>
                <span className="font-semibold tabular-nums text-teal-700 dark:text-teal-300">
                  {formatCents(potentialTotalFeeCents)}
                </span>
              </div>
            </div>
          </CardHeader>
        </Card>

        <Card className="border-border bg-card/80 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <CardHeader>
            <CardTitle className="text-sm dark:text-gray-100">Live listings (bidding)</CardTitle>
            <p className="text-xs text-muted-foreground">
              Fee uses current lowest bid when set; otherwise starting price. Listing fee % from each listing.
            </p>
          </CardHeader>
          <CardContent>
            {potentialLiveListings.length === 0 ? (
              <div className="rounded-md border border-dashed border-border bg-muted/30 px-4 py-8 text-center text-sm text-muted-foreground dark:border-gray-700 dark:bg-gray-900/60">
                No listings with status live.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Listing</TableHead>
                      <TableHead className="hidden sm:table-cell">Suburb</TableHead>
                      <TableHead className="text-right">Est. job $</TableHead>
                      <TableHead className="text-right">Fee %</TableHead>
                      <TableHead className="text-right">Est. Service Fee</TableHead>
                      <TableHead className="hidden md:table-cell">Ends</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {potentialLiveListings.map((row) => (
                      <TableRow key={row.listingId}>
                        <TableCell className="max-w-[200px] truncate font-medium text-foreground dark:text-gray-100">
                          {row.title}
                        </TableCell>
                        <TableCell className="hidden sm:table-cell text-[11px] text-muted-foreground">
                          {row.suburb}
                        </TableCell>
                        <TableCell className="text-right text-[11px] tabular-nums sm:text-xs">
                          {formatCents(row.estimatedJobAmountCents)}
                        </TableCell>
                        <TableCell className="text-right text-[11px] tabular-nums">{row.feePercent}%</TableCell>
                        <TableCell className="text-right text-[11px] font-medium tabular-nums text-teal-700 dark:text-teal-300 sm:text-xs">
                          {formatCents(row.estimatedPlatformFeeCents)}
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-[11px] text-muted-foreground">
                          {row.endTime ? format(new Date(row.endTime), "dd MMM yyyy HH:mm") : "—"}
                        </TableCell>
                        <TableCell>
                          <Button asChild size="xs" variant="outline" className="text-[11px]">
                            <Link href={`/listings/${row.listingId}`}>View listing</Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border bg-card/80 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <CardHeader>
            <CardTitle className="text-sm dark:text-gray-100">Jobs won — awaiting Pay &amp; Start Job</CardTitle>
            <p className="text-xs text-muted-foreground">
              Bid accepted; lister has not completed checkout yet (no escrow / PaymentIntent on the job).
            </p>
          </CardHeader>
          <CardContent>
            {potentialAcceptedJobs.length === 0 ? (
              <div className="rounded-md border border-dashed border-border bg-muted/30 px-4 py-8 text-center text-sm text-muted-foreground dark:border-gray-700 dark:bg-gray-900/60">
                No accepted jobs pending payment.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Job</TableHead>
                      <TableHead className="hidden md:table-cell">Cleaner</TableHead>
                      <TableHead className="text-right">Agreed amount</TableHead>
                      <TableHead className="text-right">Fee %</TableHead>
                      <TableHead className="text-right">Est. Service Fee</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {potentialAcceptedJobs.map((row) => (
                      <TableRow key={row.jobId}>
                        <TableCell>
                          <span className="font-medium text-foreground dark:text-gray-100">#{row.jobId}</span>
                          {row.title ? (
                            <p className="truncate text-[11px] text-muted-foreground">{row.title}</p>
                          ) : null}
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-[11px] text-muted-foreground">
                          {row.winnerName ?? "—"}
                        </TableCell>
                        <TableCell className="text-right text-[11px] tabular-nums sm:text-xs">
                          {formatCents(row.agreedAmountCents)}
                        </TableCell>
                        <TableCell className="text-right text-[11px] tabular-nums">{row.feePercent}%</TableCell>
                        <TableCell className="text-right text-[11px] font-medium tabular-nums text-teal-700 dark:text-teal-300 sm:text-xs">
                          {formatCents(row.estimatedPlatformFeeCents)}
                        </TableCell>
                        <TableCell>
                          <Button asChild size="xs" variant="outline" className="text-[11px]">
                            <Link href={`/jobs/${row.jobId}`}>Open job</Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="actual" className="space-y-6">
        <Card className="border-border bg-card/80 dark:border-gray-800 dark:bg-gray-900">
          <CardHeader>
            <CardTitle className="text-base dark:text-gray-100">Actual platform revenue (escrow active)</CardTitle>
            <p className="text-xs text-muted-foreground">
              Service Fee line items already charged at checkout while the job is in progress or awaiting your release
              review. Only jobs with a PaymentIntent (funds held) and status in progress or pending your approval after
              clean are included — not completed jobs (those appear under Overview → realised revenue).
            </p>
            <p className="pt-2 text-lg font-semibold tabular-nums text-violet-700 dark:text-violet-300">
              {formatCents(actualActiveEscrowFeeCents)}
            </p>
          </CardHeader>
        </Card>

        <Card className="border-border bg-card/80 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <CardHeader>
            <CardTitle className="text-sm dark:text-gray-100">Jobs with escrow &amp; fee paid</CardTitle>
          </CardHeader>
          <CardContent>
            {actualEscrowJobs.length === 0 ? (
              <div className="rounded-md border border-dashed border-border bg-muted/30 px-4 py-8 text-center text-sm text-muted-foreground dark:border-gray-700 dark:bg-gray-900/60">
                No active escrow jobs. When a lister completes Pay &amp; Start Job, the Service Fee appears here until the
                job is completed.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Job</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="hidden md:table-cell">Cleaner</TableHead>
                      <TableHead className="text-right">Job total</TableHead>
                      <TableHead className="text-right">Service Fee</TableHead>
                      <TableHead className="text-right">Cleaner share</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {actualEscrowJobs.map((row) => (
                      <TableRow key={row.jobId}>
                        <TableCell className="font-medium text-foreground dark:text-gray-100">#{row.jobId}</TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="text-[10px]">
                            {row.status === "completed_pending_approval" ? "Pending release" : "In progress"}
                          </Badge>
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-[11px] text-muted-foreground">
                          {row.winnerName ?? "—"}
                        </TableCell>
                        <TableCell className="text-right text-[11px] tabular-nums sm:text-xs">
                          {formatCents(row.jobAmountCents)}
                        </TableCell>
                        <TableCell className="text-right text-[11px] font-medium tabular-nums text-violet-700 dark:text-violet-300 sm:text-xs">
                          {formatCents(row.platformFeeCents)}
                        </TableCell>
                        <TableCell className="text-right text-[11px] tabular-nums text-muted-foreground sm:text-xs">
                          {formatCents(row.cleanerPayoutCents)}
                        </TableCell>
                        <TableCell>
                          <Button asChild size="xs" variant="outline" className="text-[11px]">
                            <Link href={`/jobs/${row.jobId}`}>Open job</Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
