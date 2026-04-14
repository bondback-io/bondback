"use client";

import { useState, useTransition } from "react";
import { adminLookupAbnDetails } from "@/lib/actions/admin-abn-lookup";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ExternalLink, Loader2, Search } from "lucide-react";
import { cn } from "@/lib/utils";

export function AdminAbnCheckerClient() {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<{ key: string; label: string; value: string }[] | null>(
    null
  );
  const [rawJson, setRawJson] = useState<string | null>(null);
  const [abnLabel, setAbnLabel] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const runLookup = () => {
    setError(null);
    setRows(null);
    setRawJson(null);
    setAbnLabel(null);
    startTransition(async () => {
      const res = await adminLookupAbnDetails(value);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setAbnLabel(res.abnFormatted);
      setRows(res.rows);
      setRawJson(res.rawJson);
    });
  };

  return (
    <div className="space-y-6">
      <Card className="border-border/80 dark:border-gray-800 dark:bg-gray-950/50">
        <CardHeader>
          <CardTitle className="text-lg">Look up ABN</CardTitle>
          <CardDescription>
            Queries the{" "}
            <a
              href="https://abr.business.gov.au/json/"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-emerald-700 underline-offset-4 hover:underline dark:text-emerald-400"
            >
              Australian Business Register JSON service
              <ExternalLink className="ml-0.5 inline h-3 w-3 align-[-0.1em] opacity-70" aria-hidden />
            </a>{" "}
            using your server <code className="rounded bg-muted px-1 text-xs">ABR_GUID</code>. All
            fields returned in the payload are listed below (flattened for nested objects and arrays).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="min-w-0 flex-1 space-y-2">
              <Label htmlFor="admin-abn-input">ABN</Label>
              <Input
                id="admin-abn-input"
                inputMode="numeric"
                autoComplete="off"
                placeholder="e.g. 12 345 678 901"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") runLookup();
                }}
                className="max-w-md font-mono text-base"
              />
            </div>
            <Button
              type="button"
              className="min-h-11 w-full gap-2 sm:w-auto"
              disabled={pending}
              onClick={() => void runLookup()}
            >
              {pending ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <Search className="h-4 w-4" aria-hidden />
              )}
              Check ABN
            </Button>
          </div>
          {error && (
            <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive dark:bg-destructive/15">
              {error}
            </p>
          )}
        </CardContent>
      </Card>

      {rows != null && (
        <Card className="border-border/80 dark:border-gray-800 dark:bg-gray-950/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">ABR fields</CardTitle>
            {abnLabel ? (
              <CardDescription className="font-mono text-foreground dark:text-gray-200">
                {abnLabel}
              </CardDescription>
            ) : null}
          </CardHeader>
          <CardContent className="overflow-x-auto">
            {rows.length === 0 ? (
              <p className="text-sm text-muted-foreground dark:text-gray-400">
                No fields were returned in a flattenable shape — see raw JSON below.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="dark:border-gray-800">
                    <TableHead className="w-[min(40%,220px)]">Field</TableHead>
                    <TableHead>Value</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.key} className="dark:border-gray-800">
                      <TableCell
                        className="align-top text-xs font-medium text-muted-foreground dark:text-gray-400"
                        title={r.key}
                      >
                        {r.label}
                      </TableCell>
                      <TableCell
                        className={cn(
                          "max-w-[min(100vw-8rem,520px)] whitespace-pre-wrap break-words text-sm",
                          "text-foreground dark:text-gray-100"
                        )}
                      >
                        {r.value}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {rawJson && (
        <Card className="border-border/80 dark:border-gray-800 dark:bg-gray-950/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Raw JSON response</CardTitle>
            <CardDescription>Exact payload from AbnDetails.aspx (for debugging).</CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="max-h-[min(60vh,480px)] overflow-auto rounded-lg border border-border bg-muted/40 p-3 text-[11px] leading-relaxed dark:border-gray-800 dark:bg-gray-900/80">
              {rawJson}
            </pre>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
