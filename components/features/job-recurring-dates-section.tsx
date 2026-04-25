"use client";

import { useCallback, useEffect, useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, Loader2 } from "lucide-react";
import { formatDateDdMmYyyy, parseListingCalendarDate } from "@/lib/listing-detail-presenters";

type OccRow = {
  id: string;
  scheduled_date: string;
  status: string;
  job_id: number | null;
};

type ContractRow = { id: string; next_occurrence_on: string | null };

function ymd(raw: string): string {
  return String(raw ?? "").trim().slice(0, 10);
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const d = parseListingCalendarDate(iso);
  return d ? formatDateDdMmYyyy(d) : iso;
}

/**
 * Lister / cleaner job page — Dates card for `recurring_house_cleaning` (replaces move-out / bond window).
 */
export function JobRecurringDatesCard({
  listingId,
  jobId,
  recurringOccurrenceId,
}: {
  listingId: string;
  jobId: number;
  recurringOccurrenceId: string | null;
}) {
  const [loading, setLoading] = useState(true);
  const [contract, setContract] = useState<ContractRow | null>(null);
  const [occurrences, setOccurrences] = useState<OccRow[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const supabase = createBrowserSupabaseClient();
      const { data: c, error: cErr } = await supabase
        .from("recurring_contracts")
        .select("id, next_occurrence_on")
        .eq("listing_id", listingId)
        .maybeSingle();

      if (cErr || !c) {
        setContract(null);
        setOccurrences([]);
        return;
      }
      const cr = c as ContractRow;
      const { data: occ, error: oErr } = await supabase
        .from("recurring_occurrences")
        .select("id, scheduled_date, status, job_id")
        .eq("contract_id", cr.id)
        .order("scheduled_date", { ascending: true });

      if (oErr) {
        setContract(cr);
        setOccurrences([]);
        return;
      }
      setContract(cr);
      setOccurrences((occ ?? []) as OccRow[]);
    } finally {
      setLoading(false);
    }
  }, [listingId]);

  useEffect(() => {
    void load();
  }, [load]);

  let previousIso: string | null = null;
  let currentIso: string | null = null;
  let nextIso: string | null = null;

  const currentOcc =
    occurrences.find((o) => Boolean(recurringOccurrenceId) && o.id === recurringOccurrenceId) ??
    occurrences.find(
      (o) => Number.isFinite(jobId) && jobId > 0 && o.job_id != null && Number(o.job_id) === jobId
    );
  if (currentOcc) {
    currentIso = ymd(currentOcc.scheduled_date);
  }

  if (currentIso) {
    const completedBefore = occurrences.filter(
      (o) => o.status === "completed" && ymd(o.scheduled_date) < currentIso
    );
    if (completedBefore.length > 0) {
      completedBefore.sort(
        (a, b) => ymd(b.scheduled_date).localeCompare(ymd(a.scheduled_date))
      );
      previousIso = ymd(completedBefore[0]!.scheduled_date);
    }

    const future = occurrences.filter((o) => {
      const d = ymd(o.scheduled_date);
      if (d <= currentIso) return false;
      if (o.status === "skipped") return false;
      return o.status === "scheduled" || o.status === "in_progress";
    });
    future.sort((a, b) => ymd(a.scheduled_date).localeCompare(ymd(b.scheduled_date)));
    if (future.length > 0) {
      nextIso = ymd(future[0]!.scheduled_date);
    }
  }

  if (!nextIso && contract?.next_occurrence_on) {
    const n = ymd(contract.next_occurrence_on);
    if (n && n !== currentIso) {
      nextIso = n;
    }
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Calendar className="h-5 w-5 shrink-0" aria-hidden />
          Dates
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground dark:text-gray-400">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            Loading schedule…
          </div>
        ) : !contract ? (
          <p className="text-sm text-muted-foreground dark:text-gray-400">
            Recurring schedule will appear when the contract is set up.
          </p>
        ) : (
          <div className="grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
            <div className="min-w-0 space-y-1">
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground dark:text-gray-400">
                Previous clean
              </p>
              <p className="text-base font-semibold tabular-nums text-foreground dark:text-gray-100">
                {previousIso != null ? fmtDate(previousIso) : "—"}
              </p>
            </div>
            <div className="min-w-0 space-y-1 sm:border-l sm:border-border sm:pl-4 dark:sm:border-gray-800">
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground dark:text-gray-400">
                Current clean
              </p>
              <p className="text-base font-semibold tabular-nums text-foreground dark:text-gray-100">
                {currentIso != null ? fmtDate(currentIso) : "—"}
              </p>
            </div>
            <div className="min-w-0 space-y-1 sm:border-l sm:border-border sm:pl-4 dark:sm:border-gray-800 lg:pl-4">
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground dark:text-gray-400">
                Next scheduled clean
              </p>
              <p className="text-base font-semibold tabular-nums text-foreground dark:text-gray-100">
                {nextIso != null ? fmtDate(nextIso) : "—"}
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
