"use client";

import { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import { format } from "date-fns";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useToast } from "@/components/ui/use-toast";
import { Download } from "lucide-react";
export type EarningsTransaction = {
  jobId: number;
  date: string;
  title: string;
  grossCents: number;
  feeCents: number;
  netCents: number;
  status: "Pending" | "Processing" | "Paid";
  payoutDate: string | null;
};

export type PeriodBreakdown = {
  grossCents: number;
  feeCents: number;
  netCents: number;
};

export type UpcomingPayoutItem = {
  jobId: number;
  title: string;
  netCents: number;
  status: "pending_review" | "processing" | "paid" | "in_progress";
  expectedReleaseAt: string | null;
  payoutDate: string | null;
  progressHoursRemaining: number | null;
  listSortKey?: number;
};

export type PayoutHistoryItem = {
  jobId: number;
  title: string;
  grossCents: number;
  feeCents: number;
  netCents: number;
  payoutDate: string;
  status: "Paid" | "Processing" | "Failed";
  payoutMethod: "stripe";
};

export type EarningsPageProps = {
  totalEarningsCents: number;
  thisMonthCents: number;
  pendingPayoutsCents: number;
  averagePerJobCents: number;
  transactions: EarningsTransaction[];
  chartEvents: { date: string; grossCents: number; netCents: number }[];
  periodBreakdown: {
    thisMonth: PeriodBreakdown;
    last30Days: PeriodBreakdown;
    ytd: PeriodBreakdown;
    lifetime: PeriodBreakdown;
  };
  upcomingPayouts: UpcomingPayoutItem[];
  payoutHistory: PayoutHistoryItem[];
  userName: string;
  payoutScheduleLabel: string;
  nextPayoutEstimateIso: string;
};

function formatCents(cents: number): string {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function formatCentsTax(cents: number): string {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

function formatDateDDMMYYYY(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

function escapeCsvField(value: string): string {
  const s = String(value);
  if (/[",\r\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function buildEarningsCsv(
  transactions: EarningsTransaction[],
  userName: string
): { csv: string; filename: string } {
  const paid = transactions.filter((t) => t.status === "Paid");
  const headers = [
    "Job ID",
    "Job Title",
    "Date Completed",
    "Your earnings (AUD)",
    "Payout Date",
    "Status",
  ];
  const rows = paid.map((t) => [
    t.jobId,
    t.title,
    formatDateDDMMYYYY(t.payoutDate ?? t.date),
    formatCentsTax(t.netCents),
    formatDateDDMMYYYY(t.payoutDate),
    t.status,
  ]);
  const totalNet = paid.reduce((s, t) => s + t.netCents, 0);
  const totalsRow = ["", "TOTAL", "", formatCentsTax(totalNet), "", ""];
  const allRows = [headers, ...rows.map((r) => r.map(String)), totalsRow];
  const csv = allRows
    .map((row) => row.map(escapeCsvField).join(","))
    .join("\r\n");
  const today = format(new Date(), "yyyy-MM-dd");
  const filename = `BondBack_Earnings_${userName}_${today}.csv`;
  return { csv, filename };
}

function useIsDark() {
  const [isDark, setIsDark] = useState(false);
  useEffect(() => {
    const check = () =>
      setIsDark(
        typeof document !== "undefined" &&
          document.documentElement.classList.contains("dark")
      );
    check();
    const observer = new MutationObserver(check);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => observer.disconnect();
  }, []);
  return isDark;
}

const INITIAL_ROWS = 10;

export function EarningsPageClient({
  totalEarningsCents,
  thisMonthCents,
  pendingPayoutsCents,
  averagePerJobCents,
  transactions,
  chartEvents,
  periodBreakdown,
  upcomingPayouts,
  payoutHistory,
  userName,
  payoutScheduleLabel,
  nextPayoutEstimateIso,
}: EarningsPageProps) {
  const [range, setRange] = useState<"3m" | "6m" | "12m" | "all">("12m");
  const [sortBy, setSortBy] = useState<"date" | "amount">("date");
  const [sortDesc, setSortDesc] = useState(true);
  const [showRows, setShowRows] = useState(INITIAL_ROWS);
  const PAYOUT_HISTORY_PAGE_SIZE = 10;
  const [showPayoutRows, setShowPayoutRows] = useState(PAYOUT_HISTORY_PAGE_SIZE);
  const [exportingCsv, setExportingCsv] = useState(false);
  const isDark = useIsDark();
  const { toast } = useToast();

  const handleExportTaxCsv = () => {
    setExportingCsv(true);
    try {
      const { csv, filename } = buildEarningsCsv(transactions, userName);
      const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();

      let revoked = false;
      const safeRevoke = () => {
        if (revoked) return;
        revoked = true;
        URL.revokeObjectURL(url);
      };
      const revokeSoon = window.setTimeout(safeRevoke, 10 * 60 * 1000);

      toast({
        title: "CSV downloaded",
        description: "Check your downloads folder, or open a preview in a new tab.",
        actionButton: {
          label: "View",
          onClick: () => {
            window.clearTimeout(revokeSoon);
            window.open(url, "_blank", "noopener,noreferrer");
            window.setTimeout(safeRevoke, 60_000);
          },
        },
      });
    } finally {
      setExportingCsv(false);
    }
  };

  const chartData = useMemo(() => {
    const events = [...chartEvents]
      .map((e) => ({ ...e, dateObj: new Date(e.date) }))
      .filter((e) => !Number.isNaN(e.dateObj.getTime()))
      .sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime());

    const now = new Date();
    const cutoffs: Record<typeof range, Date> = {
      "3m": new Date(now.getFullYear(), now.getMonth() - 3, 1),
      "6m": new Date(now.getFullYear(), now.getMonth() - 6, 1),
      "12m": new Date(now.getFullYear(), now.getMonth() - 12, 1),
      all: new Date(0),
    };
    const start = cutoffs[range];
    const filtered =
      range === "all" ? events : events.filter((e) => e.dateObj >= start);

    const byMonth = new Map<string, { netCents: number }>();
    filtered.forEach((e) => {
      const key = format(e.dateObj, "MMM yyyy");
      const cur = byMonth.get(key) ?? { netCents: 0 };
      byMonth.set(key, {
        netCents: cur.netCents + e.netCents,
      });
    });
    return Array.from(byMonth.entries())
      .map(([label, v]) => ({
        label,
        earnings: v.netCents / 100,
      }))
      .sort(
        (a, b) =>
          new Date(a.label).getTime() - new Date(b.label).getTime()
      );
  }, [chartEvents, range]);

  const sortedTransactions = useMemo(() => {
    const arr = [...transactions];
    if (sortBy === "date") {
      arr.sort((a, b) => {
        const t = new Date(b.date).getTime() - new Date(a.date).getTime();
        return sortDesc ? t : -t;
      });
    } else {
      arr.sort((a, b) => {
        const t = b.netCents - a.netCents;
        return sortDesc ? t : -t;
      });
    }
    return arr;
  }, [transactions, sortBy, sortDesc]);

  const visibleTransactions = sortedTransactions.slice(0, showRows);
  const hasMore = sortedTransactions.length > showRows;
  const isEmpty = transactions.length === 0;

  if (isEmpty) {
    return (
      <div className="space-y-6 pb-24 md:pb-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground dark:text-gray-100 md:text-3xl">
            My Earnings
          </h1>
          <p className="mt-1 text-sm text-muted-foreground dark:text-gray-400">
            Track what you&apos;ve earned from completed bond cleans.
          </p>
        </div>
        <Card className="border-border dark:border-gray-800 dark:bg-gray-900">
          <CardContent className="flex flex-col items-center justify-center px-4 py-14 text-center sm:py-16">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10 dark:bg-emerald-950/50">
              <span className="text-3xl" aria-hidden>
                💰
              </span>
            </div>
            <h2 className="mt-5 text-lg font-semibold text-foreground dark:text-gray-100">
              No earnings yet
            </h2>
            <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground dark:text-gray-400">
              Win jobs, complete cleans, and get paid — your totals will show up here.
            </p>
            <Button asChild className="mt-8 min-h-12 w-full max-w-xs rounded-xl text-base font-semibold sm:w-auto" size="lg">
              <Link href="/jobs">Browse jobs</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const nextPayoutFormatted =
    nextPayoutEstimateIso && !Number.isNaN(new Date(nextPayoutEstimateIso).getTime())
      ? format(new Date(nextPayoutEstimateIso), "EEEE, d MMM yyyy")
      : null;

  return (
    <div className="space-y-5 pb-24 md:space-y-6 md:pb-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground dark:text-gray-100 md:text-3xl">
          My Earnings
        </h1>
        <p className="mt-1 text-sm text-muted-foreground dark:text-gray-400">
          See what you&apos;ve earned from completed bond cleans.
        </p>
        <div className="mt-4 rounded-xl border border-border bg-muted/30 p-4 dark:border-gray-800 dark:bg-gray-900/50">
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
            <div className="space-y-1 text-sm text-muted-foreground dark:text-gray-400">
              <p>
                Payout schedule:{" "}
                <strong className="font-medium text-foreground dark:text-gray-200">{payoutScheduleLabel}</strong>
              </p>
              {nextPayoutFormatted && (
                <p>Next estimated payout: {nextPayoutFormatted}</p>
              )}
            </div>
            <Link
              href="/profile?tab=payments"
              className="inline-flex min-h-11 min-w-[44px] shrink-0 items-center justify-center rounded-lg border border-primary/30 bg-primary/5 px-4 py-2 text-sm font-semibold text-primary underline-offset-4 hover:bg-primary/10 hover:underline dark:border-emerald-800/50 dark:bg-emerald-950/30 dark:text-emerald-400"
            >
              Payment settings
            </Link>
          </div>
          <p className="mt-3 text-xs text-muted-foreground dark:text-gray-500">
            Automatic payouts typically land in 2–7 business days. For faster access, use{" "}
            <span className="font-medium text-foreground dark:text-gray-200">Withdraw now</span> in Settings → Payments (1% fee).
          </p>
        </div>
      </div>

      <Card className="overflow-hidden border-border shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <CardContent className="bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent px-5 py-8 dark:from-emerald-950/40 dark:via-emerald-950/20 sm:px-8 sm:py-10">
          <p className="text-xs font-medium uppercase tracking-wide text-emerald-800 dark:text-emerald-400/90">
            Total paid to you
          </p>
          <p className="mt-2 text-4xl font-bold tabular-nums tracking-tight text-emerald-700 dark:text-emerald-400 sm:text-5xl">
            {formatCents(totalEarningsCents)}
          </p>
          <p className="mt-2 max-w-md text-sm text-muted-foreground dark:text-gray-400">
            Lifetime earnings from completed jobs — amounts shown are what you receive.
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="border-border shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <CardContent className="p-4 sm:p-5">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground dark:text-gray-400">
              This month
            </p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground dark:text-gray-100">
              {formatCents(thisMonthCents)}
            </p>
            <p className="text-[11px] text-muted-foreground dark:text-gray-500">
              Your earnings
            </p>
          </CardContent>
        </Card>
        <Card className="border-border shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <CardContent className="p-4 sm:p-5">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground dark:text-gray-400">
              Pending payouts
            </p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-amber-600 dark:text-amber-400">
              {formatCents(pendingPayoutsCents)}
            </p>
            <p className="text-[11px] text-muted-foreground dark:text-gray-500">
              Held until the job is approved
            </p>
          </CardContent>
        </Card>
        <Card className="border-border shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <CardContent className="p-4 sm:p-5">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground dark:text-gray-400">
              Avg per job
            </p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground dark:text-gray-100">
              {formatCents(averagePerJobCents)}
            </p>
            <p className="text-[11px] text-muted-foreground dark:text-gray-500">
              Your earnings
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Upcoming & Recent Payouts */}
      <Card className="border-border dark:border-gray-800 dark:bg-gray-900">
        <CardHeader>
          <CardTitle className="text-base dark:text-gray-100 md:text-lg">
            Upcoming &amp; Recent Payouts
          </CardTitle>
          <p className="text-xs text-muted-foreground dark:text-gray-400">
            Jobs in progress, in review, processing, or recently paid — sorted by expected or paid date.
          </p>
        </CardHeader>
        <CardContent>
          {upcomingPayouts.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-10 dark:border-gray-700">
              <p className="text-sm font-medium text-muted-foreground dark:text-gray-400">
                No upcoming payouts – complete more jobs!
              </p>
              <p className="mt-1 text-xs text-muted-foreground dark:text-gray-500">
                Finish bond cleans and get them approved to see payouts here.
              </p>
            </div>
          ) : (
            <ul className="space-y-3">
              {upcomingPayouts.map((item) => (
                <li
                  key={item.jobId}
                  className="flex min-h-[52px] flex-col gap-2 rounded-xl border border-border bg-muted/20 px-4 py-3.5 dark:border-gray-700 dark:bg-gray-800/40 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3"
                >
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/jobs/${item.jobId}`}
                      className="font-medium text-foreground underline-offset-2 hover:underline dark:text-gray-100"
                    >
                      {item.title}
                    </Link>
                    <p className="mt-0.5 text-lg font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">
                      {formatCents(item.netCents)}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                    {item.status === "pending_review" && (
                      <Badge variant="secondary" className="bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                        Pending Review
                      </Badge>
                    )}
                    {item.status === "in_progress" && (
                      <Badge variant="secondary" className="bg-slate-100 text-slate-800 dark:bg-slate-800/60 dark:text-slate-200">
                        In progress
                      </Badge>
                    )}
                    {item.status === "processing" && (
                      <Badge variant="secondary" className="bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300">
                        Processing
                      </Badge>
                    )}
                    {item.status === "paid" && (
                      <Badge variant="secondary" className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
                        Paid
                      </Badge>
                    )}
                    {item.status === "in_progress" && (
                      <span className="text-xs text-muted-foreground dark:text-gray-400">
                        Mark the job complete to start the review window
                      </span>
                    )}
                    {item.expectedReleaseAt && (
                      <TooltipProvider delayDuration={200}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="text-xs text-muted-foreground dark:text-gray-400">
                              {item.status === "pending_review"
                                ? (() => {
                                    const days = (new Date(item.expectedReleaseAt!).getTime() - Date.now()) / (24 * 60 * 60 * 1000);
                                    if (days <= 0) return "Expected release today";
                                    if (days < 1) return "Expected release in under 1 day";
                                    return `Expected release in ${Math.ceil(days)} days`;
                                  })()
                                : "Expected in 1–3 business days"}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent side="bottom" className="max-w-xs text-xs">
                            {item.status === "pending_review"
                              ? "48-hour review window for the lister. After that, payout is released."
                              : "Platform processes payout after the review period."}
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                    {item.payoutDate && (
                      <span className="text-xs text-muted-foreground dark:text-gray-400">
                        Paid on {format(new Date(item.payoutDate), "d MMM yyyy")}
                      </span>
                    )}
                  </div>
                  {item.status === "pending_review" &&
                    item.progressHoursRemaining != null && (
                      <div className="w-full text-xs text-muted-foreground dark:text-gray-400 sm:w-auto">
                        48-hour review:{" "}
                        {item.progressHoursRemaining < 1
                          ? "under 1 hour remaining"
                          : `${Math.round(item.progressHoursRemaining)} hours remaining`}
                      </div>
                    )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Chart */}
      <Card className="border-border dark:border-gray-800 dark:bg-gray-900">
        <CardHeader className="flex flex-col gap-3 pb-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-base dark:text-gray-100 md:text-lg">
              Earnings over time
            </CardTitle>
            <p className="text-xs text-muted-foreground dark:text-gray-400">
              Your earnings by month
            </p>
          </div>
          <Tabs value={range} onValueChange={(v) => setRange(v as typeof range)}>
            <TabsList className="grid h-auto w-full grid-cols-4 gap-1 p-1 dark:bg-gray-800 sm:w-auto">
              <TabsTrigger
                value="3m"
                className="min-h-10 min-w-[44px] px-2 text-xs sm:text-sm dark:data-[state=active]:bg-gray-700"
              >
                3M
              </TabsTrigger>
              <TabsTrigger
                value="6m"
                className="min-h-10 min-w-[44px] px-2 text-xs sm:text-sm dark:data-[state=active]:bg-gray-700"
              >
                6M
              </TabsTrigger>
              <TabsTrigger
                value="12m"
                className="min-h-10 min-w-[44px] px-2 text-xs sm:text-sm dark:data-[state=active]:bg-gray-700"
              >
                12M
              </TabsTrigger>
              <TabsTrigger
                value="all"
                className="min-h-10 min-w-[44px] px-2 text-xs sm:text-sm dark:data-[state=active]:bg-gray-700"
              >
                All
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </CardHeader>
        <CardContent className="pt-0">
          {chartData.length === 0 ? (
            <div className="flex h-64 items-center justify-center rounded-md border border-dashed border-border dark:border-gray-700">
              <p className="text-sm text-muted-foreground dark:text-gray-400">
                No data for this period
              </p>
            </div>
          ) : (
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={chartData}
                  margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke={isDark ? "#374151" : "#e5e7eb"}
                    vertical={false}
                  />
                  <XAxis
                    dataKey="label"
                    tick={{
                      fontSize: 11,
                      fill: isDark ? "#9ca3af" : "#6b7280",
                    }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    tick={{
                      fontSize: 11,
                      fill: isDark ? "#9ca3af" : "#6b7280",
                    }}
                    tickFormatter={(v) =>
                      `$${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`
                    }
                    tickLine={false}
                    axisLine={false}
                  />
                  <RechartsTooltip
                    contentStyle={{
                      backgroundColor: isDark ? "#111827" : "hsl(var(--background))",
                      borderRadius: 8,
                      border: isDark ? "1px solid #374151" : "1px solid hsl(var(--border))",
                      color: isDark ? "#f3f4f6" : undefined,
                      fontSize: 12,
                    }}
                    formatter={(value) => [`$${Number(value).toFixed(0)}`, "Your earnings"]}
                    labelFormatter={(label) => label}
                  />
                  <Line
                    type="monotone"
                    dataKey="earnings"
                    name="earnings"
                    stroke={isDark ? "#4ade80" : "#22c55e"}
                    strokeWidth={2}
                    dot={{ r: 2 }}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-border dark:border-gray-800 dark:bg-gray-900">
        <CardHeader className="pb-2">
          <CardTitle className="text-base dark:text-gray-100 md:text-lg">
            Earnings by period
          </CardTitle>
          <p className="text-xs text-muted-foreground dark:text-gray-400">
            Totals are what you earn from completed work.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <ul className="space-y-2 md:hidden">
            {(
              [
                { label: "This month", cents: periodBreakdown.thisMonth.netCents },
                { label: "Last 30 days", cents: periodBreakdown.last30Days.netCents },
                { label: "Year to date", cents: periodBreakdown.ytd.netCents },
                { label: "Lifetime", cents: periodBreakdown.lifetime.netCents },
              ] as const
            ).map((row) => (
              <li
                key={row.label}
                className="flex min-h-[52px] items-center justify-between gap-3 rounded-xl border border-border bg-muted/20 px-4 py-3 dark:border-gray-700 dark:bg-gray-800/40"
              >
                <span className="text-sm font-medium text-foreground dark:text-gray-200">{row.label}</span>
                <span className="text-lg font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">
                  {formatCents(row.cents)}
                </span>
              </li>
            ))}
          </ul>
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow className="dark:border-gray-800 dark:hover:bg-transparent">
                  <TableHead className="dark:text-gray-300">Period</TableHead>
                  <TableHead className="text-right dark:text-gray-300">Your earnings</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow className="dark:border-gray-800 dark:hover:bg-gray-800/50">
                  <TableCell className="font-medium dark:text-gray-200">This month</TableCell>
                  <TableCell className="text-right tabular-nums font-semibold text-emerald-700 dark:text-emerald-400">
                    {formatCents(periodBreakdown.thisMonth.netCents)}
                  </TableCell>
                </TableRow>
                <TableRow className="dark:border-gray-800 dark:hover:bg-gray-800/50">
                  <TableCell className="font-medium dark:text-gray-200">Last 30 days</TableCell>
                  <TableCell className="text-right tabular-nums font-semibold text-emerald-700 dark:text-emerald-400">
                    {formatCents(periodBreakdown.last30Days.netCents)}
                  </TableCell>
                </TableRow>
                <TableRow className="dark:border-gray-800 dark:hover:bg-gray-800/50">
                  <TableCell className="font-medium dark:text-gray-200">Year to date</TableCell>
                  <TableCell className="text-right tabular-nums font-semibold text-emerald-700 dark:text-emerald-400">
                    {formatCents(periodBreakdown.ytd.netCents)}
                  </TableCell>
                </TableRow>
                <TableRow className="dark:border-gray-800 dark:hover:bg-gray-800/50">
                  <TableCell className="font-medium dark:text-gray-200">Lifetime</TableCell>
                  <TableCell className="text-right tabular-nums font-semibold text-emerald-700 dark:text-emerald-400">
                    {formatCents(periodBreakdown.lifetime.netCents)}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border dark:border-gray-800 dark:bg-gray-900">
        <CardHeader>
          <CardTitle className="text-base dark:text-gray-100 md:text-lg">
            Transaction history
          </CardTitle>
          <p className="text-xs text-muted-foreground dark:text-gray-400">
            Tap column headers on desktop to sort by date or amount.
          </p>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 lg:hidden">
            {visibleTransactions.map((tx) => (
              <li
                key={tx.jobId}
                className="rounded-xl border border-border bg-muted/20 p-4 dark:border-gray-700 dark:bg-gray-800/40"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/jobs/${tx.jobId}`}
                      className="text-base font-medium text-foreground underline-offset-2 hover:underline dark:text-emerald-300"
                    >
                      {tx.title.length > 40 ? `${tx.title.slice(0, 40)}…` : tx.title}
                    </Link>
                    <p className="mt-1 text-xs text-muted-foreground dark:text-gray-500">
                      #{tx.jobId} · {format(new Date(tx.date), "d MMM yyyy")}
                    </p>
                  </div>
                  <p className="shrink-0 text-lg font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">
                    {formatCents(tx.netCents)}
                  </p>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <StatusBadge status={tx.status} />
                  <span className="text-xs text-muted-foreground dark:text-gray-400">
                    Payout:{" "}
                    {tx.payoutDate ? format(new Date(tx.payoutDate), "d MMM yyyy") : "—"}
                  </span>
                </div>
              </li>
            ))}
          </ul>
          <div className="hidden overflow-x-auto lg:block">
            <Table>
              <TableHeader>
                <TableRow className="dark:border-gray-800 dark:hover:bg-transparent">
                  <TableHead className="dark:text-gray-300">Job</TableHead>
                  <TableHead className="dark:text-gray-300">
                    <button
                      type="button"
                      onClick={() => {
                        setSortBy("date");
                        setSortDesc((d) => (sortBy === "date" ? !d : true));
                      }}
                      className="inline-flex min-h-11 min-w-[44px] items-center font-medium underline-offset-2 hover:underline dark:text-gray-300"
                    >
                      Date {sortBy === "date" ? (sortDesc ? "↓" : "↑") : ""}
                    </button>
                  </TableHead>
                  <TableHead className="text-right dark:text-gray-300">
                    <button
                      type="button"
                      onClick={() => {
                        setSortBy("amount");
                        setSortDesc((d) => (sortBy === "amount" ? !d : true));
                      }}
                      className="inline-flex min-h-11 min-w-[44px] w-full items-center justify-end font-medium underline-offset-2 hover:underline dark:text-gray-300"
                    >
                      Your earnings {sortBy === "amount" ? (sortDesc ? "↓" : "↑") : ""}
                    </button>
                  </TableHead>
                  <TableHead className="dark:text-gray-300">Status</TableHead>
                  <TableHead className="dark:text-gray-300">Payout</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleTransactions.map((tx) => (
                  <TableRow key={tx.jobId}>
                    <TableCell className="max-w-[220px] font-medium dark:text-gray-100">
                      <Link
                        href={`/jobs/${tx.jobId}`}
                        className="text-foreground underline hover:no-underline dark:text-emerald-300 dark:hover:text-emerald-200"
                      >
                        {tx.title.length > 28 ? `${tx.title.slice(0, 28)}…` : tx.title}
                      </Link>
                      <span className="ml-1 text-muted-foreground dark:text-gray-500">
                        #{tx.jobId}
                      </span>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground dark:text-gray-400">
                      {format(new Date(tx.date), "d MMM yyyy")}
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-medium text-emerald-700 dark:text-emerald-400">
                      {formatCents(tx.netCents)}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={tx.status} />
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground dark:text-gray-400">
                      {tx.payoutDate
                        ? format(new Date(tx.payoutDate), "d MMM yyyy")
                        : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {hasMore && (
            <div className="mt-4 flex justify-center">
              <Button
                variant="outline"
                size="lg"
                className="min-h-11 w-full max-w-xs rounded-xl dark:border-gray-600 dark:hover:bg-gray-800 sm:w-auto"
                onClick={() => setShowRows((n) => n + INITIAL_ROWS)}
              >
                Load more
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-border dark:border-gray-800 dark:bg-gray-900">
        <CardHeader>
          <CardTitle className="text-base dark:text-gray-100 md:text-lg">
            Payout history
          </CardTitle>
          <p className="text-xs text-muted-foreground dark:text-gray-400">
            Money sent to your account after escrow is released.
          </p>
        </CardHeader>
        <CardContent>
          {payoutHistory.length === 0 ? (
            <Alert className="border-dashed dark:border-gray-700 dark:bg-gray-800/50">
              <AlertDescription className="py-4 text-center text-muted-foreground dark:text-gray-400">
                No payouts yet – complete more jobs to get paid!
              </AlertDescription>
            </Alert>
          ) : (
            <>
              <ul className="space-y-2 md:hidden">
                {payoutHistory.slice(0, showPayoutRows).map((row) => (
                  <li
                    key={row.jobId}
                    className="rounded-xl border border-border bg-muted/20 p-4 dark:border-gray-700 dark:bg-gray-800/40"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <Link
                          href={`/jobs/${row.jobId}`}
                          className="font-medium text-primary underline-offset-2 hover:underline dark:text-emerald-400"
                        >
                          #{row.jobId}
                        </Link>
                        <p className="mt-0.5 line-clamp-2 text-sm text-foreground dark:text-gray-200" title={row.title}>
                          {row.title}
                        </p>
                      </div>
                      <p className="shrink-0 text-lg font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">
                        {formatCents(row.netCents)}
                      </p>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <PayoutStatusBadge status={row.status} />
                      <span className="text-xs text-muted-foreground dark:text-gray-400">
                        {formatDateDDMMYYYY(row.payoutDate)}
                      </span>
                      <Badge variant="outline" className="font-normal dark:border-gray-600 dark:text-gray-300">
                        Stripe
                      </Badge>
                    </div>
                  </li>
                ))}
              </ul>
              <div className="hidden overflow-x-auto md:block">
                <Table>
                  <TableHeader>
                    <TableRow className="dark:border-gray-800 dark:hover:bg-transparent">
                      <TableHead className="whitespace-nowrap dark:text-gray-300">Job</TableHead>
                      <TableHead className="text-right whitespace-nowrap dark:text-gray-300">Your earnings</TableHead>
                      <TableHead className="whitespace-nowrap dark:text-gray-300">Payout date</TableHead>
                      <TableHead className="whitespace-nowrap dark:text-gray-300">Status</TableHead>
                      <TableHead className="whitespace-nowrap dark:text-gray-300">Method</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payoutHistory.slice(0, showPayoutRows).map((row) => (
                      <TableRow key={row.jobId} className="dark:border-gray-800 dark:hover:bg-gray-800/50">
                        <TableCell className="max-w-[200px] dark:text-gray-100">
                          <Link
                            href={`/jobs/${row.jobId}`}
                            className="font-medium text-primary underline-offset-2 hover:underline dark:text-emerald-400"
                          >
                            #{row.jobId}
                          </Link>
                          <p className="mt-0.5 truncate text-sm text-muted-foreground dark:text-gray-400" title={row.title}>
                            {row.title}
                          </p>
                        </TableCell>
                        <TableCell className="text-right tabular-nums font-medium text-emerald-700 dark:text-emerald-400">
                          {formatCents(row.netCents)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-muted-foreground dark:text-gray-400">
                          {formatDateDDMMYYYY(row.payoutDate)}
                        </TableCell>
                        <TableCell>
                          <PayoutStatusBadge status={row.status} />
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          <Badge variant="outline" className="font-normal dark:border-gray-600 dark:text-gray-300">
                            Stripe
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                  <tfoot>
                    <TableRow className="border-t-2 border-border font-semibold dark:border-gray-700 dark:bg-gray-800/30 dark:hover:bg-transparent">
                      <TableCell className="dark:text-gray-100">Total</TableCell>
                      <TableCell className="text-right tabular-nums text-emerald-700 dark:text-emerald-400">
                        {formatCents(payoutHistory.reduce((s, r) => s + r.netCents, 0))}
                      </TableCell>
                      <TableCell colSpan={3} />
                    </TableRow>
                  </tfoot>
                </Table>
              </div>
              {showPayoutRows < payoutHistory.length && (
                <div className="mt-4 flex justify-center">
                  <Button
                    variant="outline"
                    size="lg"
                    className="min-h-11 w-full max-w-xs rounded-xl dark:border-gray-600 dark:hover:bg-gray-800 sm:w-auto"
                    onClick={() => setShowPayoutRows((n) => n + PAYOUT_HISTORY_PAGE_SIZE)}
                  >
                    Load more
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-col gap-2">
        <Button
          variant="secondary"
          size="lg"
          onClick={handleExportTaxCsv}
          disabled={exportingCsv}
          className="min-h-12 w-full rounded-xl sm:w-auto"
        >
          {exportingCsv ? (
            "Preparing…"
          ) : (
            <>
              <Download className="mr-2 h-4 w-4" />
              Export earnings (CSV)
            </>
          )}
        </Button>
        <p className="text-xs text-muted-foreground dark:text-gray-500">
          For your records — your earnings only.
        </p>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: EarningsTransaction["status"] }) {
  const variant =
    status === "Paid"
      ? "default"
      : status === "Processing"
      ? "secondary"
      : "outline";
  const className =
    status === "Paid"
      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200 dark:border-emerald-800"
      : status === "Processing"
      ? "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200 dark:border-amber-800"
      : "dark:border-gray-600 dark:text-gray-400";
  return (
    <Badge variant={variant} className={className}>
      {status}
    </Badge>
  );
}

function PayoutStatusBadge({ status }: { status: PayoutHistoryItem["status"] }) {
  const className =
    status === "Paid"
      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200 dark:border-emerald-800"
      : status === "Processing"
      ? "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200 dark:border-sky-800"
      : "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200 dark:border-red-800";
  return (
    <Badge variant="outline" className={className}>
      {status}
    </Badge>
  );
}
