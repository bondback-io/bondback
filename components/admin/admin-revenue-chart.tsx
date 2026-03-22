"use client";

import { useMemo, useState } from "react";
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export type AdminRevenuePoint = {
  date: string; // ISO string
  monthKey: string; // YYYY-MM
  feeCents: number;
  grossCents: number;
};

export type AdminRevenueSummary = {
  totalRevenueCents: number;
  averageMonthlyFeeCents: number;
  growthPercent: number;
};

type RangeKey = "30d" | "3m" | "6m" | "all";

const RANGE_LABELS: { key: RangeKey; label: string }[] = [
  { key: "30d", label: "Last 30 days" },
  { key: "3m", label: "3 months" },
  { key: "6m", label: "6 months" },
  { key: "all", label: "All time" },
];

type Props = {
  points: AdminRevenuePoint[];
  summary: AdminRevenueSummary | null;
};

export function AdminRevenueChart({ points, summary }: Props) {
  const [range, setRange] = useState<RangeKey>("3m");

  const { filtered, hasData } = useMemo(() => {
    if (!points || points.length === 0) {
      return { filtered: [] as AdminRevenuePoint[], hasData: false };
    }
    const now = new Date();
    let cutoff: Date | null = null;
    if (range === "30d") {
      cutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    } else if (range === "3m") {
      cutoff = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
    } else if (range === "6m") {
      cutoff = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate());
    }

    const filteredPoints =
      cutoff == null
        ? points
        : points.filter((p) => new Date(p.date) >= cutoff);

    return { filtered: filteredPoints, hasData: filteredPoints.length > 0 };
  }, [points, range]);

  if (!points || points.length === 0) {
    return (
      <Card className="border-border bg-card/80 dark:border-gray-800 dark:bg-gray-900/80">
        <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
          <div>
            <CardTitle className="text-base font-semibold dark:text-gray-100">
              Platform Revenue Over Time
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Track platform fees collected from completed jobs.
            </p>
          </div>
        </CardHeader>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          No revenue yet – wait for first completed jobs.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border bg-card/80 dark:border-gray-800 dark:bg-gray-900/80">
      <CardHeader className="flex flex-row items-center justify-between gap-3 pb-3">
        <div>
          <CardTitle className="text-base font-semibold dark:text-gray-100">
            Platform Revenue Over Time
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Monthly platform fees (line) vs total job volume (bars).
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {RANGE_LABELS.map((r) => (
            <Button
              key={r.key}
              type="button"
              variant={range === r.key ? "default" : "outline"}
              size="xs"
              onClick={() => setRange(r.key)}
              className="h-7 px-2 text-[11px]"
            >
              {r.label}
            </Button>
          ))}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {summary && (
          <div className="grid gap-3 text-xs sm:grid-cols-3">
            <div>
              <p className="font-medium text-muted-foreground">Total revenue</p>
              <p className="mt-0.5 text-lg font-semibold dark:text-gray-100">
                ${(summary.totalRevenueCents / 100).toLocaleString("en-AU", {
                  maximumFractionDigits: 0,
                })}
              </p>
            </div>
            <div>
              <p className="font-medium text-muted-foreground">Avg monthly fee</p>
              <p className="mt-0.5 text-lg font-semibold dark:text-gray-100">
                ${(summary.averageMonthlyFeeCents / 100).toLocaleString("en-AU", {
                  maximumFractionDigits: 0,
                })}
              </p>
            </div>
            <div>
              <p className="font-medium text-muted-foreground">Recent growth</p>
              <div className="mt-0.5 flex items-baseline gap-1">
                <span
                  className={`text-lg font-semibold ${
                    summary.growthPercent > 0
                      ? "text-emerald-600 dark:text-emerald-400"
                      : summary.growthPercent < 0
                        ? "text-red-600 dark:text-red-400"
                        : "text-muted-foreground"
                  }`}
                >
                  {summary.growthPercent > 0 ? "+" : ""}
                  {summary.growthPercent.toFixed(1)}%
                </span>
                <Badge variant="outline" className="text-[10px]">
                  vs prev. month
                </Badge>
              </div>
            </div>
          </div>
        )}

        <div className="h-64 w-full text-xs text-muted-foreground dark:text-gray-300">
          {hasData ? (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={filtered}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="rgba(148, 163, 184, 0.2)"
                />
                <XAxis
                  dataKey="monthKey"
                  tick={{ fontSize: 11, fill: "currentColor" }}
                  tickMargin={8}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "currentColor" }}
                  tickFormatter={(v: number) =>
                    `$${(v / 1000).toLocaleString("en-AU", {
                      maximumFractionDigits: 1,
                    })}k`
                  }
                />
                <Tooltip
                  contentStyle={{
                    fontSize: 11,
                    backgroundColor: "rgba(15,23,42,0.9)",
                    border: "1px solid rgba(148,163,184,0.5)",
                    color: "white",
                  }}
                  formatter={(value: any, name: string) => {
                    const dollars = (Number(value) / 100).toLocaleString("en-AU", {
                      style: "currency",
                      currency: "AUD",
                      maximumFractionDigits: 0,
                    });
                    return [dollars, name === "feeCents" ? "Platform fees" : "Job volume"];
                  }}
                  labelFormatter={(label) => label}
                />
                <Bar
                  dataKey="grossCents"
                  name="Job volume"
                  barSize={20}
                  fill="rgba(148, 163, 184, 0.6)"
                />
                <Line
                  type="monotone"
                  dataKey="feeCents"
                  name="Platform fees"
                  stroke="rgb(16, 185, 129)"
                  strokeWidth={2}
                  dot={{ r: 2 }}
                  activeDot={{ r: 4 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
              No revenue data in this range.
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

