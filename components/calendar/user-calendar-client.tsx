"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  parseISO,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { ChevronLeft, ChevronRight, CalendarDays, Pencil, SkipForward, Shuffle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { UserCalendarEvent, UserCalendarPayload } from "@/lib/calendar/user-calendar-types";
import {
  calendarDotClassForService,
  CALENDAR_EVENT_LEGEND_LABEL,
  CALENDAR_EVENT_DOT_CLASS,
} from "@/lib/calendar/service-type-calendar";
import type { ServiceTypeKey } from "@/lib/service-types";
import { updateListingCleaningDates } from "@/lib/actions/user-calendar";
import {
  skipRecurringOccurrence,
  moveRecurringOccurrence,
} from "@/lib/actions/recurring-contracts";
import {
  RECURRING_SKIP_REASON_KEYS,
  recurringSkipReasonLabel,
  type RecurringSkipReasonKey,
} from "@/lib/recurring/recurring-reasons";
import { useToast } from "@/components/ui/use-toast";

function kindLabel(kind: UserCalendarEvent["kind"]): string {
  switch (kind) {
    case "preferred":
      return "Preferred date";
    case "move_out":
      return "Move-out / key date";
    case "recurring_visit":
      return "Recurring visit";
    case "recurring_series_start":
      return "Series start";
    case "contract_resume":
      return "Contract resumes";
    case "auction_end":
      return "Auction ends";
    default:
      return kind;
  }
}

function eventsByDateMap(events: UserCalendarEvent[]): Map<string, UserCalendarEvent[]> {
  const m = new Map<string, UserCalendarEvent[]>();
  for (const e of events) {
    const arr = m.get(e.date) ?? [];
    arr.push(e);
    m.set(e.date, arr);
  }
  for (const [, arr] of m) {
    arr.sort((a, b) => a.kind.localeCompare(b.kind));
  }
  return m;
}

function eventSummaryLine(e: UserCalendarEvent): string {
  const price =
    e.jobPriceAud != null && e.jobPriceAud > 0 ? ` · $${e.jobPriceAud} AUD` : "";
  return `${kindLabel(e.kind)} · ${e.title}${price}`;
}

export function UserCalendarClient({ initial }: { initial: UserCalendarPayload }) {
  const router = useRouter();
  const { toast } = useToast();
  const [month, setMonth] = React.useState(() => startOfMonth(new Date()));
  const [events, setEvents] = React.useState(initial.events);
  const [hints, setHints] = React.useState(initial.preferredDateHints);

  React.useEffect(() => {
    setEvents(initial.events);
    setHints(initial.preferredDateHints);
  }, [initial.events, initial.preferredDateHints]);

  const byDate = React.useMemo(() => eventsByDateMap(events), [events]);

  const gridDays = React.useMemo(() => {
    const start = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(month), { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [month]);

  const [editOpen, setEditOpen] = React.useState(false);
  const [editListingId, setEditListingId] = React.useState<string | null>(null);
  const [editTitle, setEditTitle] = React.useState("");
  const [editService, setEditService] = React.useState<ServiceTypeKey>("bond_cleaning");
  const [editMoveOut, setEditMoveOut] = React.useState("");
  const [editSeriesStart, setEditSeriesStart] = React.useState("");
  const [editPreferredLines, setEditPreferredLines] = React.useState("");
  const [editSaving, setEditSaving] = React.useState(false);

  const [skipOpen, setSkipOpen] = React.useState(false);
  const [skipOccId, setSkipOccId] = React.useState<string | null>(null);
  const [skipReason, setSkipReason] = React.useState<RecurringSkipReasonKey>(
    RECURRING_SKIP_REASON_KEYS[0]
  );
  const [skipDetail, setSkipDetail] = React.useState("");
  const [skipPending, setSkipPending] = React.useState(false);

  const [moveOpen, setMoveOpen] = React.useState(false);
  const [moveOccId, setMoveOccId] = React.useState<string | null>(null);
  const [moveDate, setMoveDate] = React.useState<Date | undefined>(undefined);
  const [moveReason, setMoveReason] = React.useState<RecurringSkipReasonKey>(
    RECURRING_SKIP_REASON_KEYS[0]
  );
  const [moveDetail, setMoveDetail] = React.useState("");
  const [movePending, setMovePending] = React.useState(false);

  const openEditForHint = (h: (typeof hints)[0]) => {
    setEditListingId(h.listingId);
    setEditTitle(h.title);
    setEditService(h.serviceType);
    setEditMoveOut("");
    setEditSeriesStart("");
    setEditPreferredLines("");
    setEditOpen(true);
  };

  const openEditFromEvent = (e: UserCalendarEvent) => {
    if (!e.canEditListingDates) return;
    setEditListingId(e.listingId);
    setEditTitle(e.title);
    setEditService(e.serviceType);
    setEditMoveOut(e.kind === "move_out" ? e.date : "");
    setEditSeriesStart(e.kind === "recurring_series_start" ? e.date : "");
    const prefOnDay = events.filter(
      (x) => x.listingId === e.listingId && x.kind === "preferred"
    );
    setEditPreferredLines(prefOnDay.map((x) => x.date).join("\n"));
    setEditOpen(true);
  };

  const submitEdit = async () => {
    if (!editListingId) return;
    setEditSaving(true);
    try {
      const preferredDates = editPreferredLines
        .split(/\r?\n/)
        .map((s) => s.trim())
        .filter(Boolean);
      const r = await updateListingCleaningDates(editListingId, {
        preferredDates: preferredDates.length > 0 ? preferredDates : null,
        moveOutDate: editMoveOut.trim() || null,
        recurringSeriesStartDate: editSeriesStart.trim() || null,
      });
      if (!r.ok) {
        toast({ variant: "destructive", title: "Could not save", description: r.error });
        return;
      }
      toast({ title: "Dates updated" });
      setEditOpen(false);
      router.refresh();
    } finally {
      setEditSaving(false);
    }
  };

  const submitSkip = async () => {
    if (!skipOccId) return;
    setSkipPending(true);
    try {
      const r = await skipRecurringOccurrence(skipOccId, {
        reasonKey: skipReason,
        reasonDetail: skipDetail.trim() || null,
      });
      if (!r.ok) {
        toast({ variant: "destructive", title: "Skip failed", description: r.error });
        return;
      }
      toast({ title: "Visit skipped", description: "Next occurrence was scheduled." });
      setSkipOpen(false);
      setSkipOccId(null);
      router.refresh();
    } finally {
      setSkipPending(false);
    }
  };

  const submitMove = async () => {
    if (!moveOccId || !moveDate) return;
    const iso = format(moveDate, "yyyy-MM-dd");
    setMovePending(true);
    try {
      const r = await moveRecurringOccurrence(moveOccId, iso, {
        reasonKey: moveReason,
        reasonDetail: moveDetail.trim() || null,
      });
      if (!r.ok) {
        toast({ variant: "destructive", title: "Move failed", description: r.error });
        return;
      }
      toast({ title: "Visit moved" });
      setMoveOpen(false);
      setMoveOccId(null);
      router.refresh();
    } finally {
      setMovePending(false);
    }
  };

  return (
    <TooltipProvider delayDuration={200}>
      <div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-6 md:py-10">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground dark:text-gray-100">
              My calendar
            </h1>
            <p className="text-sm text-muted-foreground dark:text-gray-400">
              Preferred cleans, recurring visits, and key milestones — colour-coded by service type.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="Previous month"
              onClick={() => setMonth((m) => addMonths(m, -1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="min-w-[10rem] text-center text-sm font-medium capitalize">
              {format(month, "MMMM yyyy")}
            </span>
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="Next month"
              onClick={() => setMonth((m) => addMonths(m, 1))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {initial.userHasListerRole && hints.length > 0 ? (
          <Alert className="border-amber-200 bg-amber-50/80 dark:border-amber-900/50 dark:bg-amber-950/30">
            <div className="flex gap-3">
              <CalendarDays
                className="mt-0.5 h-4 w-4 shrink-0 text-amber-700 dark:text-amber-400"
                aria-hidden
              />
              <div className="min-w-0 space-y-2">
                <p className="text-sm font-semibold text-amber-950 dark:text-amber-100">
                  Add cleaning dates for active jobs
                </p>
                <AlertDescription className="text-amber-900/90 dark:text-amber-200/90">
                  <p className="mb-3 text-sm">
                    Some listings with active work are missing preferred or key dates. Add them so
                    everyone shares the same schedule.
                  </p>
                  <ul className="space-y-2">
                {hints.map((h) => (
                  <li
                    key={h.listingId}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-amber-200/60 bg-background/60 px-3 py-2 dark:border-amber-900/40 dark:bg-gray-900/40"
                  >
                    <span className="text-sm font-medium text-foreground dark:text-gray-100">
                      {h.title}
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {h.jobId != null ? (
                        <Button type="button" variant="outline" size="sm" asChild>
                          <Link href={`/jobs/${h.jobId}`}>Open job</Link>
                        </Button>
                      ) : null}
                      <Button type="button" size="sm" onClick={() => openEditForHint(h)}>
                        <Pencil className="mr-1 h-3.5 w-3.5" />
                        Add / edit dates
                      </Button>
                    </div>
                  </li>
                ))}
                  </ul>
                </AlertDescription>
              </div>
            </div>
          </Alert>
        ) : null}

        <Card className="border-border dark:border-gray-800 dark:bg-gray-900/40">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Legend</CardTitle>
            <CardDescription>Each dot on a day matches the service type colour.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            {(Object.keys(CALENDAR_EVENT_DOT_CLASS) as ServiceTypeKey[]).map((k) => (
              <div key={k} className="flex items-center gap-2 text-xs">
                <span className={cn("h-2.5 w-2.5 rounded-full", CALENDAR_EVENT_DOT_CLASS[k])} />
                <span className="text-muted-foreground dark:text-gray-400">
                  {CALENDAR_EVENT_LEGEND_LABEL[k]}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="border-border dark:border-gray-800 dark:bg-gray-900/40">
          <CardContent className="p-3 sm:p-4">
            <div className="mb-2 grid grid-cols-7 gap-1 text-center text-[10px] font-medium uppercase tracking-wide text-muted-foreground sm:text-xs">
              {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
                <div key={d} className="py-1">
                  {d}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {gridDays.map((day) => {
                const key = format(day, "yyyy-MM-dd");
                const dayEvents = byDate.get(key) ?? [];
                const outside = !isSameMonth(day, month);
                return (
                  <Tooltip key={key}>
                    <TooltipTrigger asChild>
                      <div
                        className={cn(
                          "flex min-h-[4.25rem] flex-col rounded-lg border border-transparent p-1 text-left transition-colors sm:min-h-[5rem] sm:p-1.5",
                          outside && "opacity-40",
                          !outside && "bg-muted/30 hover:bg-muted/60 dark:bg-gray-800/40 dark:hover:bg-gray-800/70",
                          dayEvents.length > 0 && !outside && "border-primary/20 ring-1 ring-primary/10"
                        )}
                      >
                        <span
                          className={cn(
                            "text-[11px] font-semibold sm:text-xs",
                            outside ? "text-muted-foreground" : "text-foreground dark:text-gray-100"
                          )}
                        >
                          {format(day, "d")}
                        </span>
                        <div className="mt-auto flex flex-wrap gap-0.5">
                          {dayEvents.slice(0, 4).map((e) => (
                            <span
                              key={e.id}
                              className={cn(
                                "h-1.5 w-1.5 rounded-full sm:h-2 sm:w-2",
                                calendarDotClassForService(e.serviceType)
                              )}
                              title={eventSummaryLine(e)}
                            />
                          ))}
                          {dayEvents.length > 4 ? (
                            <span className="text-[9px] text-muted-foreground">+</span>
                          ) : null}
                        </div>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent
                      side="top"
                      className="max-w-xs border-border bg-popover p-3 text-xs dark:border-gray-700 dark:bg-gray-900"
                    >
                      {dayEvents.length === 0 ? (
                        <span>No events</span>
                      ) : (
                        <ul className="space-y-2">
                          {dayEvents.map((e) => (
                            <li key={e.id} className="border-b border-border/50 pb-2 last:border-0 last:pb-0 dark:border-gray-800">
                              <p className="font-semibold text-foreground dark:text-gray-100">{e.title}</p>
                              <p className="text-muted-foreground dark:text-gray-400">
                                {kindLabel(e.kind)} · {CALENDAR_EVENT_LEGEND_LABEL[e.serviceType]}
                              </p>
                              <p className="text-muted-foreground dark:text-gray-400">
                                {[e.suburb, e.postcode].filter(Boolean).join(" ")}
                                {e.propertyAddress ? ` · ${e.propertyAddress}` : ""}
                              </p>
                              <p className="text-muted-foreground dark:text-gray-400">
                                Lister: {e.listerName}
                                {e.cleanerName ? ` · Cleaner: ${e.cleanerName}` : ""}
                              </p>
                              {e.jobPriceAud != null && e.jobPriceAud > 0 ? (
                                <p className="font-medium text-foreground dark:text-gray-200">
                                  Job price: ${e.jobPriceAud} AUD
                                </p>
                              ) : null}
                              <div className="mt-2 flex flex-wrap gap-1.5">
                                {e.jobId != null ? (
                                  <Button variant="outline" size="sm" className="h-7 text-[10px]" asChild>
                                    <Link href={`/jobs/${e.jobId}`}>Job</Link>
                                  </Button>
                                ) : null}
                                <Button variant="outline" size="sm" className="h-7 text-[10px]" asChild>
                                  <Link href={`/listings/${e.listingId}`}>Listing</Link>
                                </Button>
                                {e.canEditListingDates ? (
                                  <Button
                                    variant="secondary"
                                    size="sm"
                                    className="h-7 text-[10px]"
                                    type="button"
                                    onClick={() => openEditFromEvent(e)}
                                  >
                                    Edit dates
                                  </Button>
                                ) : null}
                                {e.canRescheduleOccurrence && e.occurrenceId ? (
                                  <>
                                    <Button
                                      variant="secondary"
                                      size="sm"
                                      className="h-7 text-[10px]"
                                      type="button"
                                      onClick={() => {
                                        setSkipOccId(e.occurrenceId);
                                        setSkipOpen(true);
                                      }}
                                    >
                                      <SkipForward className="mr-0.5 h-3 w-3" />
                                      Skip
                                    </Button>
                                    <Button
                                      variant="secondary"
                                      size="sm"
                                      className="h-7 text-[10px]"
                                      type="button"
                                      onClick={() => {
                                        setMoveOccId(e.occurrenceId);
                                        setMoveDate(parseISO(e.date));
                                        setMoveOpen(true);
                                      }}
                                    >
                                      <Shuffle className="mr-0.5 h-3 w-3" />
                                      Move
                                    </Button>
                                  </>
                                ) : null}
                              </div>
                            </li>
                          ))}
                        </ul>
                      )}
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {events.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground dark:text-gray-400">
            No scheduled dates yet. When you create listings or accept jobs, key dates will appear here.
          </p>
        ) : null}

        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogContent className="dark:border-gray-800 dark:bg-gray-900">
            <DialogHeader>
              <DialogTitle>Edit cleaning dates</DialogTitle>
              <DialogDescription>
                {editTitle} — lister only. Dates apply while the job is active (not completed or cancelled).
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="cal-move">Move-out or key date (YYYY-MM-DD)</Label>
                <Input
                  id="cal-move"
                  placeholder="2026-04-20"
                  value={editMoveOut}
                  onChange={(e) => setEditMoveOut(e.target.value)}
                  className="dark:bg-gray-950"
                />
              </div>
              {editService === "recurring_house_cleaning" ? (
                <div className="space-y-1">
                  <Label htmlFor="cal-series">Recurring series start (YYYY-MM-DD)</Label>
                  <Input
                    id="cal-series"
                    placeholder="2026-04-20"
                    value={editSeriesStart}
                    onChange={(e) => setEditSeriesStart(e.target.value)}
                    className="dark:bg-gray-950"
                  />
                </div>
              ) : null}
              <div className="space-y-1">
                <Label htmlFor="cal-pref">Extra preferred dates (one per line)</Label>
                <Textarea
                  id="cal-pref"
                  rows={4}
                  placeholder={"2026-04-18\n2026-04-19"}
                  value={editPreferredLines}
                  onChange={(e) => setEditPreferredLines(e.target.value)}
                  className="dark:bg-gray-950"
                />
              </div>
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>
                Cancel
              </Button>
              <Button type="button" onClick={() => void submitEdit()} disabled={editSaving}>
                {editSaving ? "Saving…" : "Save"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={skipOpen} onOpenChange={setSkipOpen}>
          <DialogContent className="dark:border-gray-800 dark:bg-gray-900">
            <DialogHeader>
              <DialogTitle>Skip this visit</DialogTitle>
              <DialogDescription>
                The next occurrence will be scheduled automatically. Lister only.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1">
                <Label>Reason</Label>
                <Select
                  value={skipReason}
                  onValueChange={(v) => setSkipReason(v as RecurringSkipReasonKey)}
                >
                  <SelectTrigger className="dark:bg-gray-950">
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
              <div className="space-y-1">
                <Label htmlFor="skip-det">Details (optional)</Label>
                <Textarea
                  id="skip-det"
                  value={skipDetail}
                  onChange={(e) => setSkipDetail(e.target.value)}
                  className="dark:bg-gray-950"
                  rows={2}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setSkipOpen(false)}>
                Cancel
              </Button>
              <Button type="button" disabled={skipPending} onClick={() => void submitSkip()}>
                {skipPending ? "Skipping…" : "Skip visit"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={moveOpen} onOpenChange={setMoveOpen}>
          <DialogContent className="dark:border-gray-800 dark:bg-gray-900">
            <DialogHeader>
              <DialogTitle>Move visit</DialogTitle>
              <DialogDescription>Choose a new date for this scheduled occurrence. Lister only.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1">
                <Label>New date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start dark:bg-gray-950">
                      {moveDate ? format(moveDate, "d MMM yyyy") : "Pick a date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={moveDate} onSelect={setMoveDate} initialFocus />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-1">
                <Label>Reason</Label>
                <Select
                  value={moveReason}
                  onValueChange={(v) => setMoveReason(v as RecurringSkipReasonKey)}
                >
                  <SelectTrigger className="dark:bg-gray-950">
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
              <div className="space-y-1">
                <Label htmlFor="move-det">Details (optional)</Label>
                <Textarea
                  id="move-det"
                  value={moveDetail}
                  onChange={(e) => setMoveDetail(e.target.value)}
                  className="dark:bg-gray-950"
                  rows={2}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setMoveOpen(false)}>
                Cancel
              </Button>
              <Button
                type="button"
                disabled={movePending || !moveOccId || !moveDate}
                onClick={() => void submitMove()}
              >
                {movePending ? "Saving…" : "Save new date"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}
