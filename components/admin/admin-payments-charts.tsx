"use client";

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

export type MonthlyPoint = {
  month: string;
  feeDollars: number;
  payoutDollars: number;
};

function formatAUD(value: number) {
  return value.toLocaleString("en-AU", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 0,
  });
}

interface AdminPaymentsChartsProps {
  monthlyData: MonthlyPoint[];
}

export function AdminPaymentsCharts({ monthlyData }: AdminPaymentsChartsProps) {
  if (monthlyData.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center rounded-md border border-dashed border-border bg-muted/30 text-sm text-muted-foreground dark:border-gray-700 dark:bg-gray-900/60">
        No transaction data yet.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="h-56 w-full">
        <p className="mb-2 text-xs font-medium text-muted-foreground">
          Platform fees over time (monthly)
        </p>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={monthlyData}
            margin={{ top: 8, right: 8, left: -12, bottom: 0 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              className="stroke-muted"
              vertical={false}
            />
            <XAxis
              dataKey="month"
              tick={{ fontSize: 11, fill: "currentColor" }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              tick={{ fontSize: 11, fill: "currentColor" }}
              tickFormatter={(v) => formatAUD(v)}
              tickLine={false}
              axisLine={false}
            />
            <RechartsTooltip
              contentStyle={{
                backgroundColor: "hsl(var(--background))",
                borderRadius: 8,
                border: "1px solid hsl(var(--border))",
                fontSize: 12,
              }}
              formatter={(value: number) => [formatAUD(value), "Fees"]}
              labelFormatter={(label) => label}
            />
            <Line
              type="monotone"
              dataKey="feeDollars"
              name="Fees"
              stroke="#22c55e"
              strokeWidth={2}
              dot={{ r: 2 }}
              activeDot={{ r: 4 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="h-48 w-full">
        <p className="mb-2 text-xs font-medium text-muted-foreground">
          Payout volume by month
        </p>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={monthlyData}
            margin={{ top: 8, right: 8, left: -12, bottom: 0 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              className="stroke-muted"
              vertical={false}
            />
            <XAxis
              dataKey="month"
              tick={{ fontSize: 11, fill: "currentColor" }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              tick={{ fontSize: 11, fill: "currentColor" }}
              tickFormatter={(v) => formatAUD(v)}
              tickLine={false}
              axisLine={false}
            />
            <RechartsTooltip
              contentStyle={{
                backgroundColor: "hsl(var(--background))",
                borderRadius: 8,
                border: "1px solid hsl(var(--border))",
                fontSize: 12,
              }}
              formatter={(value: number) => [formatAUD(value), "Payouts"]}
              labelFormatter={(label) => label}
            />
            <Bar
              dataKey="payoutDollars"
              name="Payouts"
              fill="#0ea5e9"
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
