"use client";

import { useMemo, useState, useEffect } from "react";
import {
  Line,
  LineChart,
  Bar,
  BarChart,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type EarningsEvent = {
  date: string;
  amountCents: number;
};

interface EarningsChartProps {
  events: EarningsEvent[];
  totalEarnedCents: number;
  pendingPayoutsCents: number;
  role: "cleaner" | "lister" | "admin";
}

type Range = "30d" | "3m" | "all";

function formatCurrencyCents(amountCents: number) {
  const dollars = amountCents / 100;
  return dollars.toLocaleString("en-AU", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 0,
  });
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

export function EarningsChart({
  events,
  totalEarnedCents,
  pendingPayoutsCents,
  role,
}: EarningsChartProps) {
  const [range, setRange] = useState<Range>("30d");
  const isDark = useIsDark();

  const parsedEvents = useMemo(() => {
    return (events ?? [])
      .map((e) => ({
        ...e,
        dateObj: new Date(e.date),
      }))
      .filter((e) => !Number.isNaN(e.dateObj.getTime()))
      .sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime());
  }, [events]);

  const filtered = useMemo(() => {
    if (parsedEvents.length === 0) return [];
    if (range === "all") return parsedEvents;
    const now = new Date();
    const start =
      range === "30d"
        ? new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        : new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
    return parsedEvents.filter((e) => e.dateObj >= start);
  }, [parsedEvents, range]);

  const dailySeries = useMemo(() => {
    const groups = new Map<string, number>();
    filtered.forEach((e) => {
      const key = format(e.dateObj, "MMM d");
      groups.set(key, (groups.get(key) ?? 0) + e.amountCents);
    });
    return Array.from(groups.entries()).map(([label, amountCents]) => ({
      label,
      amountDollars: amountCents / 100,
    }));
  }, [filtered]);

  const monthlySeries = useMemo(() => {
    const groups = new Map<string, number>();
    parsedEvents.forEach((e) => {
      const key = format(e.dateObj, "MMM yyyy");
      groups.set(key, (groups.get(key) ?? 0) + e.amountCents);
    });
    return Array.from(groups.entries()).map(([label, amountCents]) => ({
      label,
      amountDollars: amountCents / 100,
    }));
  }, [parsedEvents]);

  const jobsCount = events.length;
  const averagePerJobCents =
    jobsCount > 0 ? Math.round(totalEarnedCents / jobsCount) : 0;

  const isEmpty = events.length === 0;
  const isLoading = false;

  return (
    <Card className="border-border bg-card/80 shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <CardHeader className="flex flex-col gap-2 pb-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle className="text-base md:text-lg dark:text-gray-100">
            {role === "cleaner"
              ? "Earnings overview"
              : role === "lister"
              ? "Lister earnings overview"
              : "Service Fees overview"}
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Track how much you&apos;ve earned over time from completed bond cleans.
          </p>
        </div>
        <Tabs
          value={range}
          onValueChange={(v) => setRange(v as Range)}
          className="mt-1 sm:mt-0"
        >
          <TabsList>
            <TabsTrigger value="30d">Last 30 days</TabsTrigger>
            <TabsTrigger value="3m">Last 3 months</TabsTrigger>
            <TabsTrigger value="all">All time</TabsTrigger>
          </TabsList>
        </Tabs>
      </CardHeader>
      <CardContent className="space-y-4 pt-0">
        <div className="grid gap-3 text-xs sm:grid-cols-3 sm:text-sm">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Total earned
            </p>
            <p className="text-base font-semibold text-foreground dark:text-gray-100 sm:text-lg">
              {formatCurrencyCents(totalEarnedCents)}
            </p>
          </div>
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Average per job
            </p>
            <p className="text-base font-semibold text-foreground dark:text-gray-100 sm:text-lg">
              {jobsCount > 0
                ? formatCurrencyCents(averagePerJobCents)
                : formatCurrencyCents(0)}
            </p>
          </div>
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Pending payouts
            </p>
            <p className="text-base font-semibold text-foreground dark:text-gray-100 sm:text-lg">
              {formatCurrencyCents(pendingPayoutsCents)}
            </p>
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-6 w-1/2" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : isEmpty ? (
          <div className="space-y-2 rounded-md border border-dashed border-border bg-muted/40 px-4 py-6 text-center text-xs sm:text-sm dark:border-gray-700 dark:bg-gray-900/60">
            <p className="font-medium text-foreground dark:text-gray-100">
              No earnings yet – start bidding or listing!
            </p>
            <p className="text-[11px] text-muted-foreground dark:text-gray-400">
              Once your jobs are completed and funds are released, your earnings will
              appear here as a chart.
            </p>
          </div>
        ) : (
          <>
            <div className="h-56 w-full">
              <ResponsiveContainer>
                <LineChart
                  data={dailySeries}
                  margin={{ top: 10, right: 10, left: -15, bottom: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke={isDark ? "#374151" : undefined}
                    className={!isDark ? "stroke-muted" : undefined}
                    vertical={false}
                  />
                  <XAxis
                    dataKey="label"
                    tick={{
                      fontSize: 11,
                      fill: isDark ? "#e5e7eb" : "currentColor",
                    }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    tick={{
                      fontSize: 11,
                      fill: isDark ? "#e5e7eb" : "currentColor",
                    }}
                    tickFormatter={(v) =>
                      v.toLocaleString("en-AU", { maximumFractionDigits: 0 })
                    }
                    tickLine={false}
                    axisLine={false}
                  />
                  <RechartsTooltip
                    contentStyle={{
                      backgroundColor: isDark ? "#111827" : "hsl(var(--background))",
                      borderRadius: 8,
                      border: isDark
                        ? "1px solid #374151"
                        : "1px solid hsl(var(--border))",
                      color: isDark ? "#f3f4f6" : undefined,
                      fontSize: 12,
                    }}
                    labelStyle={{ fontWeight: 600 }}
                    formatter={(value: any) =>
                      formatCurrencyCents(Math.round(Number(value) * 100))
                    }
                  />
                  <Line
                    type="monotone"
                    dataKey="amountDollars"
                    stroke={isDark ? "#4ade80" : "#22c55e"}
                    strokeWidth={2}
                    dot={{ r: 2 }}
                    activeDot={{ r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="h-40 w-full">
              <ResponsiveContainer>
                <BarChart
                  data={monthlySeries}
                  margin={{ top: 5, right: 10, left: -15, bottom: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke={isDark ? "#374151" : undefined}
                    className={!isDark ? "stroke-muted" : undefined}
                    vertical={false}
                  />
                  <XAxis
                    dataKey="label"
                    tick={{
                      fontSize: 11,
                      fill: isDark ? "#e5e7eb" : "currentColor",
                    }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    tick={{
                      fontSize: 11,
                      fill: isDark ? "#e5e7eb" : "currentColor",
                    }}
                    tickFormatter={(v) =>
                      v.toLocaleString("en-AU", { maximumFractionDigits: 0 })
                    }
                    tickLine={false}
                    axisLine={false}
                  />
                  <RechartsTooltip
                    contentStyle={{
                      backgroundColor: isDark ? "#111827" : "hsl(var(--background))",
                      borderRadius: 8,
                      border: isDark
                        ? "1px solid #374151"
                        : "1px solid hsl(var(--border))",
                      color: isDark ? "#f3f4f6" : undefined,
                      fontSize: 12,
                    }}
                    labelStyle={{ fontWeight: 600 }}
                    formatter={(value: any) =>
                      formatCurrencyCents(Math.round(Number(value) * 100))
                    }
                  />
                  <Bar
                    dataKey="amountDollars"
                    fill={isDark ? "#4ade80" : "#22c55e"}
                    radius={[6, 6, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

