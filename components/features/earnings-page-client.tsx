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
  Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
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
  status: "pending_review" | "processing" | "paid";
  expectedReleaseAt: string | null;
  payoutDate: string | null;
  progressHoursRemaining: number | null;
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

const PLATFORM_FEE_RATE = 0.12;

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
    "Gross Amount",
    "Platform Fee (12%, paid by lister)",
    "Net Amount",
    "Payout Date",
    "Status",
  ];
  const rows = paid.map((t) => [
    t.jobId,
    t.title,
    formatDateDDMMYYYY(t.payoutDate ?? t.date),
    formatCentsTax(t.grossCents),
    formatCentsTax(t.feeCents),
    formatCentsTax(t.netCents),
    formatDateDDMMYYYY(t.payoutDate),
    t.status,
  ]);
  const totalGross = paid.reduce((s, t) => s + t.grossCents, 0);
  const totalFee = paid.reduce((s, t) => s + t.feeCents, 0);
  const totalNet = paid.reduce((s, t) => s + t.netCents, 0);
  const totalsRow = [
    "",
    "TOTAL",
    "",
    formatCentsTax(totalGross),
    formatCentsTax(totalFee),
    formatCentsTax(totalNet),
    "",
    "",
  ];
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

const FEE_EXPLANATION =
  "You will receive the full bid amount. The lister pays the platform fee separately.";

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
      URL.revokeObjectURL(url);
      toast({
        title: "CSV downloaded",
        description: "Check your downloads folder.",
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

    const byMonth = new Map<string, { grossCents: number; netCents: number }>();
    filtered.forEach((e) => {
      const key = format(e.dateObj, "MMM yyyy");
      const cur = byMonth.get(key) ?? { grossCents: 0, netCents: 0 };
      byMonth.set(key, {
        grossCents: cur.grossCents + e.grossCents,
        netCents: cur.netCents + e.netCents,
      });
    });
    return Array.from(byMonth.entries())
      .map(([label, v]) => ({
        label,
        gross: v.grossCents / 100,
        net: v.netCents / 100,
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
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground dark:text-gray-100 md:text-3xl">
            My Earnings
          </h1>
          <p className="mt-1 text-sm text-muted-foreground dark:text-gray-400">
            Your earnings and payout history as a cleaner.
          </p>
        </div>
        <Card className="border-border dark:border-gray-800 dark:bg-gray-900">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-muted dark:bg-gray-800">
              <span className="text-2xl" aria-hidden>
                💰
              </span>
            </div>
            <h2 className="mt-4 text-lg font-semibold text-foreground dark:text-gray-100">
              No earnings yet
            </h2>
            <p className="mt-2 max-w-sm text-sm text-muted-foreground dark:text-gray-400">
              Start bidding on bond clean jobs. When you win and complete jobs,
              your earnings will appear here and you can track payouts.
            </p>
            <Button asChild className="mt-6" size="lg">
              <Link href="/jobs">Browse Available Jobs</Link>
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
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground dark:text-gray-100 md:text-3xl">
          My Earnings
        </h1>
        <p className="mt-1 text-sm text-muted-foreground dark:text-gray-400">
          Transparent overview of your earnings, fees and payouts.
        </p>
        <div className="mt-3 space-y-1 text-sm text-muted-foreground dark:text-gray-400">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span>
              Your payout schedule: <strong className="font-medium text-foreground dark:text-gray-200">{payoutScheduleLabel}</strong>
            </span>
            {nextPayoutFormatted && (
              <span>Next payout estimate: {nextPayoutFormatted}</span>
            )}
            <Link
              href="/profile?tab=payments"
              className="text-primary underline-offset-4 hover:underline"
            >
              Edit
            </Link>
          </div>
          <p className="text-xs">
            Automatic payout scheduled (2–7 days). Want it faster? Use &quot;Withdraw Now&quot; in Settings → Payments (1% fee).
          </p>
        </div>
      </div>

      {/* Gross / Fee / Net breakdown card — prominent */}
      <Card className="border-border shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <CardHeader className="pb-2">
          <CardTitle className="text-base dark:text-gray-100 md:text-lg">
            Lifetime earnings breakdown
          </CardTitle>
          <p className="text-xs text-muted-foreground dark:text-gray-400">
            You will receive the full bid amount. The lister pays the platform fee separately.
          </p>
        </CardHeader>
        <CardContent>
          <TooltipProvider delayDuration={200}>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-lg border border-border bg-muted/30 px-4 py-3 dark:border-gray-700 dark:bg-gray-800/40">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground dark:text-gray-400">
                  Gross earnings
                </p>
                <p className="mt-1 text-2xl font-semibold tabular-nums text-muted-foreground dark:text-gray-400 sm:text-3xl">
                  {formatCents(periodBreakdown.lifetime.grossCents)}
                </p>
                <p className="text-[11px] text-muted-foreground dark:text-gray-500">
                  Total before fees
                </p>
              </div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="cursor-help rounded-lg border border-muted bg-muted/50 px-4 py-3 dark:border-gray-700 dark:bg-gray-800/50">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground dark:text-gray-400">
                      Platform fee (12%)
                    </p>
                    <p className="mt-1 text-2xl font-semibold tabular-nums text-muted-foreground dark:text-gray-400 sm:text-3xl">
                      {formatCents(periodBreakdown.lifetime.feeCents)}
                    </p>
                    <p className="text-[11px] text-muted-foreground dark:text-gray-500">
                      Paid by lister
                    </p>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-xs text-xs">
                  {FEE_EXPLANATION}
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="cursor-help rounded-lg border border-emerald-200 bg-emerald-50/50 px-4 py-3 dark:border-emerald-800/50 dark:bg-emerald-950/30">
                    <p className="text-xs font-medium uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
                      Net earnings
                    </p>
                    <p className="mt-1 text-3xl font-bold tabular-nums text-emerald-700 dark:text-emerald-400 sm:text-4xl">
                      {formatCents(periodBreakdown.lifetime.netCents)}
                    </p>
                    <p className="text-[11px] text-emerald-700/90 dark:text-emerald-400/80">
                      Full bid amount (lister pays platform fee separately)
                    </p>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-xs text-xs">
                  {FEE_EXPLANATION}
                </TooltipContent>
              </Tooltip>
            </div>
          </TooltipProvider>
        </CardContent>
      </Card>

      {/* Quick stats */}
      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="border-border shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <CardContent className="p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground dark:text-gray-400">
              This Month
            </p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground dark:text-gray-100">
              {formatCents(thisMonthCents)}
            </p>
            <p className="text-[11px] text-muted-foreground dark:text-gray-500">
              Net
            </p>
          </CardContent>
        </Card>
        <Card className="border-border shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <CardContent className="p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground dark:text-gray-400">
              Pending Payouts
            </p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-amber-600 dark:text-amber-400">
              {formatCents(pendingPayoutsCents)}
            </p>
            <p className="text-[11px] text-muted-foreground dark:text-gray-500">
              Held until job approved
            </p>
          </CardContent>
        </Card>
        <Card className="border-border shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <CardContent className="p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground dark:text-gray-400">
              Avg per Job
            </p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground dark:text-gray-100">
              {formatCents(averagePerJobCents)}
            </p>
            <p className="text-[11px] text-muted-foreground dark:text-gray-500">
              Net
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tax CSV export */}
      <div className="flex flex-col gap-2">
        <Button
          variant="secondary"
          size="lg"
          onClick={handleExportTaxCsv}
          disabled={exportingCsv}
          className="w-full sm:w-auto"
        >
          {exportingCsv ? (
            "Preparing…"
          ) : (
            <>
              <Download className="mr-2 h-4 w-4" />
              Export Earnings for Tax (CSV)
            </>
          )}
        </Button>
        <p className="text-xs text-muted-foreground dark:text-gray-500">
          For tax purposes only – contains only your earnings data.
        </p>
      </div>

      {/* Upcoming & Recent Payouts */}
      <Card className="border-border dark:border-gray-800 dark:bg-gray-900">
        <CardHeader>
          <CardTitle className="text-base dark:text-gray-100 md:text-lg">
            Upcoming &amp; Recent Payouts
          </CardTitle>
          <p className="text-xs text-muted-foreground dark:text-gray-400">
            Jobs in review, processing, or recently paid — sorted by expected or paid date.
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
                  className="flex flex-col gap-2 rounded-lg border border-border bg-muted/20 px-4 py-3 dark:border-gray-700 dark:bg-gray-800/40 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3"
                >
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/jobs/${item.jobId}`}
                      className="font-medium text-foreground underline-offset-2 hover:underline dark:text-gray-100"
                    >
                      {item.title}
                    </Link>
                    <p className="mt-0.5 text-lg font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">
                      {formatCents(item.netCents)} net
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                    {item.status === "pending_review" && (
                      <Badge variant="secondary" className="bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                        Pending Review
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
        <CardHeader className="flex flex-col gap-2 pb-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-base dark:text-gray-100 md:text-lg">
              Earnings Over Time
            </CardTitle>
            <p className="text-xs text-muted-foreground dark:text-gray-400">
              Gross vs net (after platform fee)
            </p>
          </div>
          <Tabs value={range} onValueChange={(v) => setRange(v as typeof range)}>
            <TabsList className="dark:bg-gray-800">
              <TabsTrigger value="3m" className="dark:data-[state=active]:bg-gray-700">
                3M
              </TabsTrigger>
              <TabsTrigger value="6m" className="dark:data-[state=active]:bg-gray-700">
                6M
              </TabsTrigger>
              <TabsTrigger value="12m" className="dark:data-[state=active]:bg-gray-700">
                12M
              </TabsTrigger>
              <TabsTrigger value="all" className="dark:data-[state=active]:bg-gray-700">
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
                    formatter={(value, name) => [
                      `$${Number(value).toFixed(0)}`,
                      name === "net" ? "Net Earnings (after 12% fee)" : "Gross Earnings",
                    ]}
                    labelFormatter={(label) => label}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: 12 }}
                    formatter={(value) =>
                      value === "net" ? "Net Earnings (after 12% fee)" : "Gross Earnings"
                    }
                    iconType="line"
                    iconSize={8}
                  />
                  <Line
                    type="monotone"
                    dataKey="gross"
                    name="gross"
                    stroke={isDark ? "#6b7280" : "#9ca3af"}
                    strokeWidth={1.5}
                    dot={false}
                    activeDot={{ r: 4 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="net"
                    name="net"
                    stroke={isDark ? "#4ade80" : "#22c55e"}
                    strokeWidth={2}
                    dot={{ r: 2 }}
                    activeDot={{ r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Period breakdown table */}
      <Card className="border-border dark:border-gray-800 dark:bg-gray-900">
        <CardHeader className="pb-2">
          <CardTitle className="text-base dark:text-gray-100 md:text-lg">
            Earnings by period
          </CardTitle>
          <TooltipProvider delayDuration={200}>
            <p className="text-xs text-muted-foreground dark:text-gray-400">
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="cursor-help underline decoration-dotted underline-offset-2">
                    Platform fee of 12% covers payment processing, support, and escrow protection.
                  </span>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-xs text-xs">
                  {FEE_EXPLANATION}
                </TooltipContent>
              </Tooltip>
            </p>
          </TooltipProvider>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className="dark:border-gray-800 dark:hover:bg-transparent">
                <TableHead className="dark:text-gray-300">Period</TableHead>
                <TableHead className="text-right dark:text-gray-300">Gross</TableHead>
                <TableHead className="text-right dark:text-gray-300">Fee</TableHead>
                <TableHead className="text-right dark:text-gray-300">Net</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow className="dark:border-gray-800 dark:hover:bg-gray-800/50">
                <TableCell className="font-medium dark:text-gray-200">This Month</TableCell>
                <TableCell className="text-right tabular-nums dark:text-gray-300">
                  {formatCents(periodBreakdown.thisMonth.grossCents)}
                </TableCell>
                <TableCell className="text-right tabular-nums text-muted-foreground dark:text-gray-400">
                  {formatCents(periodBreakdown.thisMonth.feeCents)} (lister)
                </TableCell>
                <TableCell className="text-right tabular-nums font-semibold text-emerald-700 dark:text-emerald-400">
                  {formatCents(periodBreakdown.thisMonth.netCents)}
                </TableCell>
              </TableRow>
              <TableRow className="dark:border-gray-800 dark:hover:bg-gray-800/50">
                <TableCell className="font-medium dark:text-gray-200">Last 30 Days</TableCell>
                <TableCell className="text-right tabular-nums dark:text-gray-300">
                  {formatCents(periodBreakdown.last30Days.grossCents)}
                </TableCell>
                <TableCell className="text-right tabular-nums text-muted-foreground dark:text-gray-400">
                  {formatCents(periodBreakdown.last30Days.feeCents)} (lister)
                </TableCell>
                <TableCell className="text-right tabular-nums font-semibold text-emerald-700 dark:text-emerald-400">
                  {formatCents(periodBreakdown.last30Days.netCents)}
                </TableCell>
              </TableRow>
              <TableRow className="dark:border-gray-800 dark:hover:bg-gray-800/50">
                <TableCell className="font-medium dark:text-gray-200">Year to Date</TableCell>
                <TableCell className="text-right tabular-nums dark:text-gray-300">
                  {formatCents(periodBreakdown.ytd.grossCents)}
                </TableCell>
                <TableCell className="text-right tabular-nums text-muted-foreground dark:text-gray-400">
                  {formatCents(periodBreakdown.ytd.feeCents)} (lister)
                </TableCell>
                <TableCell className="text-right tabular-nums font-semibold text-emerald-700 dark:text-emerald-400">
                  {formatCents(periodBreakdown.ytd.netCents)}
                </TableCell>
              </TableRow>
              <TableRow className="dark:border-gray-800 dark:hover:bg-gray-800/50">
                <TableCell className="font-medium dark:text-gray-200">Lifetime</TableCell>
                <TableCell className="text-right tabular-nums dark:text-gray-300">
                  {formatCents(periodBreakdown.lifetime.grossCents)}
                </TableCell>
                <TableCell className="text-right tabular-nums text-muted-foreground dark:text-gray-400">
                  {formatCents(periodBreakdown.lifetime.feeCents)} (lister)
                </TableCell>
                <TableCell className="text-right tabular-nums font-semibold text-emerald-700 dark:text-emerald-400">
                  {formatCents(periodBreakdown.lifetime.netCents)}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Transaction history */}
      <Card className="border-border dark:border-gray-800 dark:bg-gray-900">
        <CardHeader>
          <CardTitle className="text-base dark:text-gray-100 md:text-lg">
            Transaction History
          </CardTitle>
          <p className="text-xs text-muted-foreground dark:text-gray-400">
            Sort by date or net amount using the column headers.
          </p>
        </CardHeader>
        <CardContent>
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
                    className="font-medium underline-offset-2 hover:underline dark:text-gray-300"
                  >
                    Date {sortBy === "date" ? (sortDesc ? "↓" : "↑") : ""}
                  </button>
                </TableHead>
                <TableHead className="text-right dark:text-gray-300">Gross</TableHead>
                <TableHead className="text-right dark:text-gray-300">Fee (12%, paid by lister)</TableHead>
                <TableHead className="text-right dark:text-gray-300">
                  <button
                    type="button"
                    onClick={() => {
                      setSortBy("amount");
                      setSortDesc((d) => (sortBy === "amount" ? !d : true));
                    }}
                    className="font-medium underline-offset-2 hover:underline dark:text-gray-300"
                  >
                    Net {sortBy === "amount" ? (sortDesc ? "↓" : "↑") : ""}
                  </button>
                </TableHead>
                <TableHead className="dark:text-gray-300">Status</TableHead>
                <TableHead className="dark:text-gray-300">Payout</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleTransactions.map((tx) => (
                <TableRow key={tx.jobId}>
                  <TableCell className="font-medium dark:text-gray-100">
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
                  <TableCell className="text-muted-foreground dark:text-gray-400">
                    {format(new Date(tx.date), "d MMM yyyy")}
                  </TableCell>
                  <TableCell className="text-right tabular-nums dark:text-gray-200">
                    {formatCents(tx.grossCents)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground dark:text-gray-400">
                    {formatCents(tx.feeCents)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums font-medium dark:text-gray-100">
                    {formatCents(tx.netCents)}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={tx.status} />
                  </TableCell>
                  <TableCell className="text-muted-foreground dark:text-gray-400">
                    {tx.payoutDate
                      ? format(new Date(tx.payoutDate), "d MMM yyyy")
                      : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {hasMore && (
            <div className="mt-4 flex justify-center">
              <Button
                variant="outline"
                size="sm"
                className="dark:border-gray-600 dark:hover:bg-gray-800"
                onClick={() => setShowRows((n) => n + INITIAL_ROWS)}
              >
                Load more
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Payout History Table */}
      <Card className="border-border dark:border-gray-800 dark:bg-gray-900">
        <CardHeader>
          <CardTitle className="text-base dark:text-gray-100 md:text-lg">
            Payout History
          </CardTitle>
          <p className="text-xs text-muted-foreground dark:text-gray-400">
            Past payouts to your connected account (escrow released). Platform fee shown for transparency (paid by lister).
          </p>
        </CardHeader>
        <CardContent>
          {payoutHistory.length === 0 ? (
            <Alert className="border-dashed dark:border-gray-700 dark:bg-gray-800/50">
              <AlertDescription className="text-center py-4 text-muted-foreground dark:text-gray-400">
                No payouts yet – complete more jobs to get paid!
              </AlertDescription>
            </Alert>
          ) : (
            <>
              <div className="overflow-x-auto -mx-2 px-2">
                <Table>
                  <TableHeader>
                    <TableRow className="dark:border-gray-800 dark:hover:bg-transparent">
                      <TableHead className="whitespace-nowrap dark:text-gray-300">Job ID</TableHead>
                      <TableHead className="min-w-[120px] dark:text-gray-300">Job Title</TableHead>
                      <TableHead className="text-right whitespace-nowrap dark:text-gray-300">Gross</TableHead>
                      <TableHead className="text-right whitespace-nowrap dark:text-gray-300">Platform Fee (12%)</TableHead>
                      <TableHead className="text-right whitespace-nowrap dark:text-gray-300">Net</TableHead>
                      <TableHead className="whitespace-nowrap dark:text-gray-300">Payout Date</TableHead>
                      <TableHead className="whitespace-nowrap dark:text-gray-300">Status</TableHead>
                      <TableHead className="whitespace-nowrap dark:text-gray-300">Payout Method</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payoutHistory.slice(0, showPayoutRows).map((row) => (
                      <TableRow key={row.jobId} className="dark:border-gray-800 dark:hover:bg-gray-800/50">
                        <TableCell className="font-medium whitespace-nowrap dark:text-gray-100">
                          <Link
                            href={`/jobs/${row.jobId}`}
                            className="text-primary underline-offset-2 hover:underline dark:text-emerald-400 dark:hover:text-emerald-300"
                          >
                            #{row.jobId}
                          </Link>
                        </TableCell>
                        <TableCell className="max-w-[180px] truncate dark:text-gray-200" title={row.title}>
                          {row.title.length > 32 ? `${row.title.slice(0, 32)}…` : row.title}
                        </TableCell>
                        <TableCell className="text-right tabular-nums whitespace-nowrap dark:text-gray-200">
                          {formatCents(row.grossCents)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-muted-foreground whitespace-nowrap dark:text-gray-400">
                          {formatCents(row.feeCents)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums font-medium whitespace-nowrap text-emerald-700 dark:text-emerald-400">
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
                      <TableCell colSpan={2} className="dark:text-gray-100">
                        Total
                      </TableCell>
                      <TableCell className="text-right tabular-nums dark:text-gray-200">
                        {formatCents(payoutHistory.reduce((s, r) => s + r.grossCents, 0))}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground dark:text-gray-400">
                        {formatCents(payoutHistory.reduce((s, r) => s + r.feeCents, 0))}
                      </TableCell>
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
                    size="sm"
                    className="dark:border-gray-600 dark:hover:bg-gray-800"
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

      {/* Payout method */}
      <Card className="border-border dark:border-gray-800 dark:bg-gray-900">
        <CardHeader>
          <CardTitle className="text-base dark:text-gray-100 md:text-lg">
            Payout Method
          </CardTitle>
          <p className="text-xs text-muted-foreground dark:text-gray-400">
            Payments are released 48 hours after the lister approves the job.
          </p>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Badge
              variant="outline"
              className="border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-200"
            >
              Not Connected
            </Badge>
            <span className="text-sm text-muted-foreground dark:text-gray-400">
              Stripe Connect will be available soon for payouts to your bank.
            </span>
          </div>
          <Button
            variant="outline"
            disabled
            className="dark:border-gray-600 dark:hover:bg-gray-800"
          >
            Connect Payout Details (coming soon)
          </Button>
        </CardContent>
      </Card>
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
