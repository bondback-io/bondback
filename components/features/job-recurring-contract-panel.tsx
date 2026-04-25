"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { format, isValid, parseISO, startOfDay } from "date-fns";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarDays, CalendarIcon, Loader2, Pause, PlayCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { recurringFrequencyShortLabel } from "@/lib/service-types";
import {
  RECURRING_SKIP_REASON_KEYS,
  recurringSkipReasonLabel,
} from "@/lib/recurring/recurring-reasons";
import {
  pauseRecurringContract,
  resumeRecurringContract,
  skipRecurringOccurrence,
  moveRecurringOccurrence,
  type RecurringRescheduleMode,
} from "@/lib/actions/recurring-contracts";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/components/ui/use-toast";

type ContractRow = {
  id: string;
  frequency: string;
  next_occurrence_on: string | null;
  paused_at: string | null;
  resume_scheduled_for: string | null;
  visits_completed: number;
};

type OccRow = {
  id: string;
  scheduled_date: string;
  status: string;
  job_id: number | null;
};

export function JobRecurringContractPanel({
  listingId,
  isJobLister,
  isJobCleaner,
  allowMutations,
}: {
  listingId: string;
  isJobLister: boolean;
  isJobCleaner: boolean;
  /** False when job/listing is cancelled — show read-only snapshot if contract exists */
  allowMutations: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [contract, setContract] = useState<ContractRow | null>(null);
  const [occurrences, setOccurrences] = useState<OccRow[]>([]);
  const [showCalendar, setShowCalendar] = useState(false);

  const [pauseOpen, setPauseOpen] = useState(false);
  const [pauseReason, setPauseReason] = useState<string>(RECURRING_SKIP_REASON_KEYS[0]);
  const [pauseDetail, setPauseDetail] = useState("");
  const [resumeForDate, setResumeForDate] = useState<string>("");

  const [skipTargetId, setSkipTargetId] = useState<string | null>(null);
  const [skipReason, setSkipReason] = useState<string>(RECURRING_SKIP_REASON_KEYS[0]);
  const [skipDetail, setSkipDetail] = useState("");

  const [moveTargetId, setMoveTargetId] = useState<string | null>(null);
  const [moveDate, setMoveDate] = useState<Date | undefined>(undefined);
  const [moveReason, setMoveReason] = useState<string>(RECURRING_SKIP_REASON_KEYS[0]);
  const [moveDetail, setMoveDetail] = useState("");
  const [moveRescheduleMode, setMoveRescheduleMode] =
    useState<RecurringRescheduleMode>("update_series");

  const [pending, startTransition] = useTransition();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const supabase = createBrowserSupabaseClient();
      const { data: c, error: cErr } = await supabase
        .from("recurring_contracts")
        .select(
          "id, frequency, next_occurrence_on, paused_at, resume_scheduled_for, visits_completed"
        )
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

  const visitDates = occurrences
    .filter((o) => o.status !== "skipped")
    .map((o) => parseISO(o.scheduled_date))
    .filter((d) => isValid(d));

  const scheduledWithoutJob = occurrences.filter(
    (o) => o.status === "scheduled" && o.job_id == null
  );

  const canSee = isJobLister || isJobCleaner;
  const canPauseResume = allowMutations && isJobLister;
  const canSkipMove =
    allowMutations &&
    isJobLister &&
    !contract?.paused_at &&
    scheduledWithoutJob.length > 0;

  const afterMutate = (ok: boolean, err?: string) => {
    if (!ok) {
      toast({
        variant: "destructive",
        title: "Could not update schedule",
        description: err ?? "Try again or contact support.",
      });
      return;
    }
    toast({ title: "Updated", description: "Recurring schedule saved." });
    void load();
    router.refresh();
  };

  if (!canSee) return null;
  if (loading) {
    return (
      <Card className="border-sky-200/70 dark:border-sky-900/50">
        <CardContent className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Loading recurring schedule…
        </CardContent>
      </Card>
    );
  }
  if (!contract) return null;

  const freqLabel = recurringFrequencyShortLabel(contract.frequency) ?? contract.frequency;
  const nextRaw = contract.next_occurrence_on;
  const nextD = nextRaw ? parseISO(nextRaw) : null;
  const nextLabel =
    nextD && isValid(nextD) ? format(nextD, "d MMM yyyy") : "—";
  const paused = Boolean(contract.paused_at);

  return (
    <>
      <Card className="border-sky-200/80 bg-sky-50/30 dark:border-sky-900/45 dark:bg-sky-950/20">
        <CardHeader className="pb-2">
          <CardTitle className="flex flex-wrap items-center gap-2 text-base">
            Recurring clean
            <Badge
              variant="outline"
              className={cn(
                "font-normal",
                paused
                  ? "border-amber-500/60 bg-amber-100/80 text-amber-950 dark:bg-amber-950/50 dark:text-amber-100"
                  : "border-emerald-500/50 bg-emerald-100/70 text-emerald-950 dark:bg-emerald-950/40 dark:text-emerald-100"
              )}
            >
              {paused ? "Paused" : "Active"}
            </Badge>
          </CardTitle>
          <CardDescription>
            {freqLabel} · Next: {nextLabel}
            {contract.resume_scheduled_for && paused ? (
              <> · Resume on {contract.resume_scheduled_for}</>
            ) : null}
            {typeof contract.visits_completed === "number" ? (
              <> · {contract.visits_completed} visit{contract.visits_completed === 1 ? "" : "s"} completed</>
            ) : null}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {canPauseResume ? (
            <div className="flex flex-wrap gap-2">
              {paused ? (
                <Button
                  type="button"
                  size="sm"
                  variant="default"
                  className="gap-1.5"
                  disabled={pending}
                  onClick={() => {
                    startTransition(async () => {
                      const r = await resumeRecurringContract(listingId);
                      afterMutate(r.ok, "error" in r ? r.error : undefined);
                    });
                  }}
                >
                  {pending ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  ) : (
                    <PlayCircle className="h-4 w-4" aria-hidden />
                  )}
                  Resume series
                </Button>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="gap-1.5"
                  disabled={pending}
                  onClick={() => {
                    setPauseReason(RECURRING_SKIP_REASON_KEYS[0]);
                    setPauseDetail("");
                    setResumeForDate("");
                    setPauseOpen(true);
                  }}
                >
                  <Pause className="h-4 w-4" aria-hidden />
                  Pause series
                </Button>
              )}
            </div>
          ) : null}

          {canSkipMove ? (
            <div className="space-y-2 rounded-lg border border-border/80 bg-background/60 p-3 dark:border-gray-700 dark:bg-gray-950/40">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Upcoming visit (no job yet)
              </p>
              <ul className="space-y-2 text-sm">
                {scheduledWithoutJob.map((o) => (
                  <li
                    key={o.id}
                    className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <span className="tabular-nums text-foreground">
                      {format(parseISO(o.scheduled_date), "d MMM yyyy")}
                    </span>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        disabled={pending}
                        onClick={() => {
                          setSkipTargetId(o.id);
                          setSkipReason(RECURRING_SKIP_REASON_KEYS[0]);
                          setSkipDetail("");
                        }}
                      >
                        Skip
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={pending}
                        onClick={() => {
                          setMoveTargetId(o.id);
                          setMoveDate(undefined);
                          setMoveReason(RECURRING_SKIP_REASON_KEYS[0]);
                          setMoveDetail("");
                          setMoveRescheduleMode("update_series");
                        }}
                      >
                        Move date
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <details
            className="rounded-lg border border-border/60 bg-muted/20 dark:border-gray-800 dark:bg-gray-900/30"
            open={showCalendar}
            onToggle={(e) => setShowCalendar(e.currentTarget.open)}
          >
            <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2 text-sm font-medium outline-none marker:content-none [&::-webkit-details-marker]:hidden">
              <CalendarDays className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
              Visit calendar
            </summary>
            <div className="border-t border-border/60 px-3 pb-3 pt-2 dark:border-gray-800">
              <p className="mb-2 text-xs text-muted-foreground">
                Highlighted days are scheduled visits (including in progress).
              </p>
              <Calendar
                modifiers={{ visit: visitDates }}
                modifiersClassNames={{
                  visit:
                    "bg-sky-200 text-sky-950 font-semibold dark:bg-sky-800 dark:text-sky-50",
                }}
                className="rounded-md border border-border/50"
              />
            </div>
          </details>
        </CardContent>
      </Card>

      <Dialog open={pauseOpen} onOpenChange={setPauseOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Pause recurring series</DialogTitle>
            <DialogDescription>
              No new visit jobs will be scheduled until you resume. The assigned cleaner is notified.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-2">
              <Label>Reason</Label>
              <Select value={pauseReason} onValueChange={setPauseReason}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RECURRING_SKIP_REASON_KEYS.map((k) => (
                    <SelectItem key={k} value={k}>
                      {recurringSkipReasonLabel(k)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {pauseReason === "other" ? (
              <div className="space-y-2">
                <Label htmlFor="pause-detail">Details</Label>
                <Textarea
                  id="pause-detail"
                  value={pauseDetail}
                  onChange={(e) => setPauseDetail(e.target.value)}
                  rows={3}
                  placeholder="Short note"
                />
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="pause-extra">Extra detail (optional)</Label>
                <Textarea
                  id="pause-extra"
                  value={pauseDetail}
                  onChange={(e) => setPauseDetail(e.target.value)}
                  rows={2}
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="resume-planned">Planned resume date (optional)</Label>
              <Input
                id="resume-planned"
                type="date"
                value={resumeForDate}
                onChange={(e) => setResumeForDate(e.target.value)}
              />
              <p className="text-[11px] text-muted-foreground">
                Shown on your listing card while paused. You can still resume anytime.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setPauseOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={pending}
              onClick={() => {
                startTransition(async () => {
                  const r = await pauseRecurringContract(listingId, {
                    reasonKey: pauseReason,
                    reasonDetail: pauseDetail.trim() || null,
                    resumeScheduledFor: resumeForDate.trim() || null,
                  });
                  if (r.ok) setPauseOpen(false);
                  afterMutate(r.ok, "error" in r ? r.error : undefined);
                });
              }}
            >
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Pause"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={skipTargetId != null}
        onOpenChange={(o) => {
          if (!o) setSkipTargetId(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Skip this visit</DialogTitle>
            <DialogDescription>
              The visit moves to the next date in your series. The other party is notified.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-2">
              <Label>Reason</Label>
              <Select value={skipReason} onValueChange={setSkipReason}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RECURRING_SKIP_REASON_KEYS.map((k) => (
                    <SelectItem key={k} value={k}>
                      {recurringSkipReasonLabel(k)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="skip-detail">
                {skipReason === "other" ? "Details (required)" : "Details (optional)"}
              </Label>
              <Textarea
                id="skip-detail"
                value={skipDetail}
                onChange={(e) => setSkipDetail(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setSkipTargetId(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={pending || !skipTargetId}
              onClick={() => {
                const id = skipTargetId;
                if (!id) return;
                startTransition(async () => {
                  const r = await skipRecurringOccurrence(id, {
                    reasonKey: skipReason,
                    reasonDetail: skipDetail.trim() || null,
                  });
                  setSkipTargetId(null);
                  afterMutate(r.ok, "error" in r ? r.error : undefined);
                });
              }}
            >
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Skip visit"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={moveTargetId != null}
        onOpenChange={(o) => {
          if (!o) setMoveTargetId(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Move visit date</DialogTitle>
            <DialogDescription>
              Pick a new date. You can move only this visit or set a new regular day for the series.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-2">
              <Label>Apply to</Label>
              <RadioGroup
                className="grid gap-2"
                value={moveRescheduleMode}
                onValueChange={(v) => setMoveRescheduleMode(v as RecurringRescheduleMode)}
              >
                <label
                  className="flex cursor-pointer items-start gap-2 rounded-md border border-border/60 p-2.5 text-sm"
                  htmlFor="job-move-mode-series"
                >
                  <RadioGroupItem id="job-move-mode-series" value="update_series" className="mt-0.5" />
                  <span>
                    <span className="font-medium">New recurring day</span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      Future visits repeat on the same weekday as the date you pick.
                    </span>
                  </span>
                </label>
                <label
                  className="flex cursor-pointer items-start gap-2 rounded-md border border-border/60 p-2.5 text-sm"
                  htmlFor="job-move-mode-once"
                >
                  <RadioGroupItem id="job-move-mode-once" value="this_visit_only" className="mt-0.5" />
                  <span>
                    <span className="font-medium">This visit only</span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      After this job, the schedule returns to the original pattern.
                    </span>
                  </span>
                </label>
              </RadioGroup>
            </div>
            <div className="space-y-2">
              <Label>New date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !moveDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" aria-hidden />
                    {moveDate ? format(moveDate, "d MMM yyyy") : "Select date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={moveDate}
                    onSelect={setMoveDate}
                    fromDate={new Date()}
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2">
              <Label>Reason</Label>
              <Select value={moveReason} onValueChange={setMoveReason}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RECURRING_SKIP_REASON_KEYS.map((k) => (
                    <SelectItem key={k} value={k}>
                      {recurringSkipReasonLabel(k)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="move-detail">
                {moveReason === "other" ? "Details (required)" : "Details (optional)"}
              </Label>
              <Textarea
                id="move-detail"
                value={moveDetail}
                onChange={(e) => setMoveDetail(e.target.value)}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setMoveTargetId(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={pending || !moveTargetId || !moveDate}
              onClick={() => {
                const id = moveTargetId;
                if (!id || !moveDate) return;
                startTransition(async () => {
                  const r = await moveRecurringOccurrence(id, format(startOfDay(moveDate), "yyyy-MM-dd"), {
                    reasonKey: moveReason,
                    reasonDetail: moveDetail.trim() || null,
                    mode: moveRescheduleMode,
                  });
                  setMoveTargetId(null);
                  afterMutate(r.ok, "error" in r ? r.error : undefined);
                });
              }}
            >
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save new date"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
