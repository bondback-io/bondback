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
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  Check,
  GripVertical,
  Pencil,
  SkipForward,
  Shuffle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";
import type { UserCalendarEvent, UserCalendarPayload } from "@/lib/calendar/user-calendar-types";
import { CALENDAR_EVENT_LEGEND_LABEL, CALENDAR_EVENT_DOT_CLASS } from "@/lib/calendar/service-type-calendar";
import type { ServiceTypeKey } from "@/lib/service-types";
import {
  relocateListingCalendarDate,
  updateListingCleaningDates,
} from "@/lib/actions/user-calendar";
import {
  CalendarServiceIcon,
  calendarChipBorderClass,
} from "@/components/calendar/calendar-service-icon";
import {
  skipRecurringOccurrence,
  moveRecurringOccurrence,
  type RecurringRescheduleMode,
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

function eventCanDrag(e: UserCalendarEvent, userHasListerRole: boolean): boolean {
  if (!userHasListerRole) return false;
  if (e.canRescheduleOccurrence && e.occurrenceId) return true;
  if (
    e.canEditListingDates &&
    (e.kind === "preferred" || e.kind === "move_out" || e.kind === "recurring_series_start")
  ) {
    return true;
  }
  return false;
}

function listingRelocateKind(
  e: UserCalendarEvent
): "preferred" | "move_out" | "recurring_series_start" | null {
  if (!e.canEditListingDates) return null;
  if (e.kind === "preferred") return "preferred";
  if (e.kind === "move_out") return "move_out";
  if (e.kind === "recurring_series_start") return "recurring_series_start";
  return null;
}

function CalendarEventChip({
  event,
  isLister,
  disabled,
  dateKey,
  onOpenDay,
}: {
  event: UserCalendarEvent;
  isLister: boolean;
  disabled?: boolean;
  dateKey: string;
  onOpenDay: (key: string) => void;
}) {
  const canDrag = eventCanDrag(event, isLister) && !disabled;
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `cal-ev-${event.id}`,
    disabled: !canDrag,
    data: { event },
  });
  const style = transform
    ? { transform: `translate3d(${transform.x}px,${transform.y}px,0)` }
    : undefined;
  const isCompleted = Boolean(event.isCompleted);
  const shortTitle =
    event.title.length > 22 ? `${event.title.slice(0, 20)}…` : event.title;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex min-w-0 items-center gap-0.5 rounded-md border bg-card/95 py-0.5 pl-0.5 pr-0 shadow-sm dark:bg-gray-950/90",
        calendarChipBorderClass(event.serviceType),
        isDragging && "opacity-40"
      )}
    >
      {canDrag ? (
        <button
          type="button"
          className="touch-none shrink-0 cursor-grab rounded p-0.5 text-muted-foreground hover:bg-muted active:cursor-grabbing dark:text-gray-500"
          {...listeners}
          {...attributes}
          aria-label="Drag to move date"
        >
          <GripVertical className="h-3.5 w-3.5 sm:h-3 sm:w-3" />
        </button>
      ) : null}
      <button
        type="button"
        onClick={() => onOpenDay(dateKey)}
        className={cn(
          "flex min-w-0 flex-1 items-center gap-0.5 rounded-sm px-0.5 text-left outline-none transition-colors",
          "hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring",
          isCompleted && "opacity-95"
        )}
        title={
          isCompleted
            ? `${event.title} — completed (${CALENDAR_EVENT_LEGEND_LABEL[event.serviceType]})`
            : `${event.title} — open details`
        }
        aria-label={
          isCompleted
            ? `${shortTitle}, completed, ${CALENDAR_EVENT_LEGEND_LABEL[event.serviceType]}. Open day details.`
            : `${shortTitle}. Open day details.`
        }
      >
        <CalendarServiceIcon
          serviceType={event.serviceType}
          className="h-3 w-3 shrink-0 sm:h-3.5 sm:w-3.5"
        />
        {isCompleted ? (
          <Check
            className="h-2.5 w-2.5 shrink-0 text-emerald-500 dark:text-emerald-400"
            strokeWidth={3}
            aria-hidden
          />
        ) : null}
        <span className="min-w-0 truncate text-[9px] font-medium leading-tight sm:text-[10px]">
          {shortTitle}
        </span>
      </button>
    </div>
  );
}

function CalendarDayCell({
  day,
  month,
  byDate,
  userHasListerRole,
  relocationPending,
  onDayOpen,
}: {
  day: Date;
  month: Date;
  byDate: Map<string, UserCalendarEvent[]>;
  userHasListerRole: boolean;
  relocationPending: boolean;
  onDayOpen: (key: string) => void;
}) {
  const key = format(day, "yyyy-MM-dd");
  const dayEvents = byDate.get(key) ?? [];
  const outside = !isSameMonth(day, month);
  const { setNodeRef, isOver } = useDroppable({ id: `day-${key}` });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex min-h-[4.75rem] flex-col overflow-hidden rounded-xl border p-1 text-left transition-colors sm:min-h-[6rem] sm:p-1.5",
        outside
          ? "border-transparent bg-muted/10 opacity-50"
          : "border-border/60 bg-muted/25 dark:border-gray-800 dark:bg-gray-900/50",
        !outside &&
          dayEvents.length > 0 &&
          "border-primary/25 shadow-sm ring-1 ring-primary/10 dark:ring-primary/20",
        isOver &&
          "z-10 border-primary/50 bg-primary/10 ring-2 ring-primary ring-offset-1 ring-offset-background dark:ring-offset-gray-950"
      )}
    >
      <button
        type="button"
        className={cn(
          "w-full rounded-md px-0.5 py-0.5 text-left text-[11px] font-semibold outline-none hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring sm:text-xs",
          outside ? "text-muted-foreground" : "text-foreground dark:text-gray-100"
        )}
        onClick={() => onDayOpen(key)}
      >
        {format(day, "d")}
      </button>
      <div className="mt-0.5 flex min-h-0 flex-1 flex-col gap-0.5 overflow-hidden">
        {dayEvents.slice(0, 3).map((e) => (
          <CalendarEventChip
            key={e.id}
            event={e}
            isLister={userHasListerRole}
            disabled={relocationPending}
            dateKey={key}
            onOpenDay={onDayOpen}
          />
        ))}
        {dayEvents.length > 3 ? (
          <span className="px-0.5 text-[9px] font-medium text-muted-foreground sm:text-[10px]">
            +{dayEvents.length - 3} more
          </span>
        ) : null}
      </div>
    </div>
  );
}

/** Full-width list layout for narrow screens — readable titles and 44px+ tap targets. */
function CalendarMobileAgenda({
  month,
  gridDays,
  byDate,
  onDayOpen,
}: {
  month: Date;
  gridDays: Date[];
  byDate: Map<string, UserCalendarEvent[]>;
  onDayOpen: (key: string) => void;
}) {
  const sections = React.useMemo(() => {
    const out: { day: Date; key: string; events: UserCalendarEvent[] }[] = [];
    for (const day of gridDays) {
      if (!isSameMonth(day, month)) continue;
      const key = format(day, "yyyy-MM-dd");
      const events = byDate.get(key) ?? [];
      if (events.length === 0) continue;
      out.push({ day, key, events });
    }
    return out;
  }, [month, gridDays, byDate]);

  if (sections.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border/70 bg-muted/15 px-4 py-10 text-center dark:border-gray-700 dark:bg-gray-950/40">
        <p className="text-sm font-medium text-foreground dark:text-gray-100">No jobs this month</p>
        <p className="mt-1 text-xs text-muted-foreground dark:text-gray-400">
          Scheduled visits appear here after a cleaner is assigned and dates are set.
        </p>
      </div>
    );
  }

  return (
    <ul className="space-y-3">
      {sections.map(({ day, key, events }) => (
        <li
          key={key}
          className="overflow-hidden rounded-2xl border border-border/70 bg-muted/20 shadow-sm dark:border-gray-800 dark:bg-gray-950/50"
        >
          <button
            type="button"
            className="flex w-full min-h-[48px] items-center justify-between gap-3 border-b border-border/50 bg-muted/30 px-4 py-3 text-left transition-colors hover:bg-muted/50 active:bg-muted/60 dark:border-gray-800 dark:bg-gray-900/60"
            onClick={() => onDayOpen(key)}
          >
            <span className="text-base font-semibold leading-snug text-foreground dark:text-gray-100">
              {format(day, "EEEE, d MMMM")}
            </span>
            <span className="shrink-0 rounded-full bg-background/80 px-2.5 py-0.5 text-xs font-medium tabular-nums text-muted-foreground ring-1 ring-border/60 dark:bg-gray-950 dark:text-gray-400 dark:ring-gray-700">
              {events.length} {events.length === 1 ? "job" : "jobs"}
            </span>
          </button>
          <ul className="divide-y divide-border/50 dark:divide-gray-800">
            {events.map((e) => (
              <li key={e.id}>
                <button
                  type="button"
                  className="flex w-full min-h-[52px] items-start gap-3 px-4 py-3.5 text-left transition-colors hover:bg-muted/40 active:bg-muted/55"
                  onClick={() => onDayOpen(key)}
                >
                  <div className="mt-0.5 flex shrink-0 items-center gap-1.5">
                    <CalendarServiceIcon
                      serviceType={e.serviceType}
                      className="h-5 w-5 sm:h-5 sm:w-5"
                    />
                    {e.isCompleted ? (
                      <Check
                        className="h-4 w-4 shrink-0 text-emerald-500 dark:text-emerald-400"
                        strokeWidth={2.5}
                        aria-hidden
                      />
                    ) : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[15px] font-semibold leading-snug text-foreground dark:text-gray-100">
                      {e.title}
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground dark:text-gray-400">
                      {kindLabel(e.kind)} · {CALENDAR_EVENT_LEGEND_LABEL[e.serviceType]}
                    </p>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ul>
  );
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
  const [moveRescheduleMode, setMoveRescheduleMode] =
    React.useState<RecurringRescheduleMode>("update_series");

  const [activeDragEvent, setActiveDragEvent] = React.useState<UserCalendarEvent | null>(null);
  const [selectedDayKey, setSelectedDayKey] = React.useState<string | null>(null);
  const [relocationPending, setRelocationPending] = React.useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 420, tolerance: 8 } })
  );

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
        mode: moveRescheduleMode,
      });
      if (!r.ok) {
        toast({ variant: "destructive", title: "Move failed", description: r.error });
        return;
      }
      toast({
        title: "Visit moved",
        description:
          moveRescheduleMode === "update_series"
            ? "Future visits will follow the new day."
            : "This visit was moved. Later visits keep the original pattern.",
      });
      setMoveOpen(false);
      setMoveOccId(null);
      router.refresh();
    } finally {
      setMovePending(false);
    }
  };

  const handleDragStart = React.useCallback((event: DragStartEvent) => {
    const ev = event.active.data.current?.event as UserCalendarEvent | undefined;
    setActiveDragEvent(ev ?? null);
  }, []);

  const handleDragEnd = React.useCallback(
    async (event: DragEndEvent) => {
      const ev = event.active.data.current?.event as UserCalendarEvent | undefined;
      setActiveDragEvent(null);
      if (!ev || !event.over) return;
      const overId = String(event.over.id);
      if (!overId.startsWith("day-")) return;
      const toDate = overId.slice(4);
      if (toDate === ev.date) return;

      setRelocationPending(true);
      try {
        if (ev.canRescheduleOccurrence && ev.occurrenceId) {
          const r = await moveRecurringOccurrence(ev.occurrenceId, toDate, {
            reasonKey: "scheduling_conflict",
            reasonDetail: "Moved on calendar",
            mode: "update_series",
          });
          if (!r.ok) {
            toast({ variant: "destructive", title: "Could not move visit", description: r.error });
            return;
          }
          toast({ title: "Visit rescheduled", description: `New date: ${toDate}` });
        } else {
          const kind = listingRelocateKind(ev);
          if (!kind) {
            toast({
              variant: "destructive",
              title: "Cannot move",
              description: "This entry cannot be dragged to a new day.",
            });
            return;
          }
          const r = await relocateListingCalendarDate(ev.listingId, {
            fromDate: ev.date,
            toDate,
            kind,
          });
          if (!r.ok) {
            toast({ variant: "destructive", title: "Could not update date", description: r.error });
            return;
          }
          toast({ title: "Date updated", description: `Now on ${toDate}` });
        }
        router.refresh();
      } finally {
        setRelocationPending(false);
      }
    },
    [router, toast]
  );

  const handleDragCancel = React.useCallback(() => {
    setActiveDragEvent(null);
  }, []);

  const selectedDayEvents = selectedDayKey ? (byDate.get(selectedDayKey) ?? []) : [];

  return (
    <>
      <div className="mx-auto w-full max-w-5xl space-y-5 px-3 py-5 sm:space-y-6 sm:px-4 sm:py-6 md:py-10">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground dark:text-gray-100">
              My calendar
            </h1>
            <p className="text-sm text-muted-foreground dark:text-gray-400 lg:hidden">
              Tap a day or job for full details. Icons show the service type; a check means completed.
            </p>
            <p className="hidden text-sm text-muted-foreground dark:text-gray-400 lg:block">
              Funded jobs with an assigned cleaner. Icons match the service type; a green check marks a
              completed visit. Tap a job row or the day number to open details — or drag the grip to
              move a date (lister, hold briefly on iPhone).
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
            <CardDescription>
              Icon and colour match the service type on each job row.
            </CardDescription>
          </CardHeader>
          <CardContent className="-mx-1 flex gap-2 overflow-x-auto pb-1 pt-0.5 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:gap-x-4 sm:gap-y-2 sm:overflow-visible sm:pb-0 [&::-webkit-scrollbar]:hidden">
            {(Object.keys(CALENDAR_EVENT_DOT_CLASS) as ServiceTypeKey[]).map((k) => (
              <div
                key={k}
                className="flex shrink-0 items-center gap-2 rounded-lg border border-border/50 bg-muted/20 px-2.5 py-1.5 text-xs dark:border-gray-800 dark:bg-gray-950/40 sm:shrink"
              >
                <CalendarServiceIcon serviceType={k} className="h-4 w-4" />
                <span className={cn("h-2 w-2 rounded-full", CALENDAR_EVENT_DOT_CLASS[k])} aria-hidden />
                <span className="text-muted-foreground dark:text-gray-400">{CALENDAR_EVENT_LEGEND_LABEL[k]}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <DndContext
          sensors={sensors}
          onDragStart={handleDragStart}
          onDragEnd={(e) => void handleDragEnd(e)}
          onDragCancel={handleDragCancel}
        >
          <Card className="border-border dark:border-gray-800 dark:bg-gray-900/40">
            <CardContent className="p-3 sm:p-4">
              {relocationPending ? (
                <p className="mb-2 text-center text-xs text-muted-foreground">Updating schedule…</p>
              ) : null}

              <div className="lg:hidden">
                <CalendarMobileAgenda
                  month={month}
                  gridDays={gridDays}
                  byDate={byDate}
                  onDayOpen={setSelectedDayKey}
                />
                {initial.userHasListerRole ? (
                  <p className="mt-3 text-center text-[11px] leading-snug text-muted-foreground dark:text-gray-500">
                    To drag a visit to another day, use the month grid on a larger screen.
                  </p>
                ) : null}
              </div>

              <div className="hidden lg:block">
                <div className="mb-1.5 grid grid-cols-7 gap-1 text-center text-[11px] font-semibold uppercase tracking-wide text-muted-foreground sm:mb-2 sm:text-xs">
                  {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
                    <div key={d} className="py-1">
                      {d}
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {gridDays.map((day) => (
                    <CalendarDayCell
                      key={format(day, "yyyy-MM-dd")}
                      day={day}
                      month={month}
                      byDate={byDate}
                      userHasListerRole={initial.userHasListerRole}
                      relocationPending={relocationPending}
                      onDayOpen={setSelectedDayKey}
                    />
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
          <DragOverlay dropAnimation={null}>
            {activeDragEvent ? (
              <div
                className={cn(
                  "flex max-w-[200px] items-center gap-1 rounded-lg border bg-card px-2 py-1.5 text-xs shadow-lg dark:bg-gray-900",
                  calendarChipBorderClass(activeDragEvent.serviceType)
                )}
              >
                <CalendarServiceIcon serviceType={activeDragEvent.serviceType} className="h-4 w-4" />
                <span className="truncate font-medium">{activeDragEvent.title}</span>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>

        <Dialog open={selectedDayKey != null} onOpenChange={(o) => !o && setSelectedDayKey(null)}>
          <DialogContent className="max-h-[85vh] overflow-y-auto dark:border-gray-800 dark:bg-gray-900 sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="dark:text-gray-100">
                {selectedDayKey
                  ? format(parseISO(selectedDayKey), "EEEE d MMMM yyyy")
                  : "Day"}
              </DialogTitle>
              <DialogDescription>
                {selectedDayEvents.length === 0
                  ? "No cleans on this day."
                  : `${selectedDayEvents.length} scheduled ${selectedDayEvents.length === 1 ? "item" : "items"}`}
              </DialogDescription>
            </DialogHeader>
            {selectedDayEvents.length > 0 ? (
              <ul className="space-y-3">
                {selectedDayEvents.map((e) => (
                  <li
                    key={e.id}
                    className="rounded-lg border border-border/60 bg-muted/20 p-3 dark:border-gray-800 dark:bg-gray-950/50"
                  >
                    <div className="flex items-start gap-2">
                      <div className="mt-0.5 flex shrink-0 items-center gap-1.5">
                        <CalendarServiceIcon serviceType={e.serviceType} className="h-5 w-5" />
                        {Boolean(e.isCompleted) ? (
                          <span
                            className="inline-flex items-center gap-0.5 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-300"
                            title="This visit or job is completed"
                          >
                            <Check className="h-3 w-3" strokeWidth={2.5} aria-hidden />
                            Done
                          </span>
                        ) : null}
                      </div>
                      <div className="min-w-0 flex-1 space-y-1">
                        <p className="font-semibold text-foreground dark:text-gray-100">{e.title}</p>
                        <p className="text-xs text-muted-foreground dark:text-gray-400">
                          {kindLabel(e.kind)} · {CALENDAR_EVENT_LEGEND_LABEL[e.serviceType]}
                        </p>
                        <p className="text-xs text-muted-foreground dark:text-gray-400">
                          {[e.suburb, e.postcode].filter(Boolean).join(" ")}
                          {e.propertyAddress ? ` · ${e.propertyAddress}` : ""}
                        </p>
                        <p className="text-xs text-muted-foreground dark:text-gray-400">
                          Lister: {e.listerName}
                          {e.cleanerName ? ` · Cleaner: ${e.cleanerName}` : ""}
                        </p>
                        {e.jobPriceAud != null && e.jobPriceAud > 0 ? (
                          <p className="text-sm font-medium text-foreground dark:text-gray-200">
                            Job price: ${e.jobPriceAud} AUD
                          </p>
                        ) : null}
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {e.jobId != null ? (
                        <Button variant="outline" size="sm" className="h-8 text-xs" asChild>
                          <Link href={`/jobs/${e.jobId}`}>Open job</Link>
                        </Button>
                      ) : (
                        <Button variant="outline" size="sm" className="h-8 text-xs" asChild>
                          <Link href={`/listings/${e.listingId}`}>Listing</Link>
                        </Button>
                      )}
                      {e.canEditListingDates ? (
                        <Button
                          variant="secondary"
                          size="sm"
                          className="h-8 text-xs"
                          type="button"
                          onClick={() => {
                            setSelectedDayKey(null);
                            openEditFromEvent(e);
                          }}
                        >
                          Edit dates
                        </Button>
                      ) : null}
                      {e.canRescheduleOccurrence && e.occurrenceId ? (
                        <>
                          <Button
                            variant="secondary"
                            size="sm"
                            className="h-8 text-xs"
                            type="button"
                            onClick={() => {
                              setSelectedDayKey(null);
                              setSkipOccId(e.occurrenceId);
                              setSkipOpen(true);
                            }}
                          >
                            <SkipForward className="mr-1 h-3.5 w-3.5" />
                            Skip
                          </Button>
                          <Button
                            variant="secondary"
                            size="sm"
                            className="h-8 text-xs"
                            type="button"
                            onClick={() => {
                              setSelectedDayKey(null);
                              setMoveOccId(e.occurrenceId);
                              setMoveDate(parseISO(e.date));
                              setMoveRescheduleMode("update_series");
                              setMoveOpen(true);
                            }}
                          >
                            <Shuffle className="mr-1 h-3.5 w-3.5" />
                            Move
                          </Button>
                        </>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            ) : null}
          </DialogContent>
        </Dialog>

        {events.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground dark:text-gray-400">
            No scheduled dates yet. After escrow is paid and a cleaner is assigned, visits and key dates
            appear on the grid for listers and cleaners. Past and completed visits stay visible with a check.
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
              <DialogDescription>
                Choose a new date. You can change only this visit or make this the new regular day
                (e.g. every Wednesday → every Thursday). Lister only.
              </DialogDescription>
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
              <div className="space-y-2">
                <Label>Apply to</Label>
                <RadioGroup
                  className="grid gap-2"
                  value={moveRescheduleMode}
                  onValueChange={(v) => setMoveRescheduleMode(v as RecurringRescheduleMode)}
                >
                  <label
                    className="flex cursor-pointer items-start gap-2 rounded-md border border-border/60 p-2.5 text-sm dark:border-gray-800"
                    htmlFor="move-mode-series"
                  >
                    <RadioGroupItem id="move-mode-series" value="update_series" className="mt-0.5" />
                    <span>
                      <span className="font-medium text-foreground">New recurring day</span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        Future visits repeat on the same weekday as the date you pick.
                      </span>
                    </span>
                  </label>
                  <label
                    className="flex cursor-pointer items-start gap-2 rounded-md border border-border/60 p-2.5 text-sm dark:border-gray-800"
                    htmlFor="move-mode-once"
                  >
                    <RadioGroupItem id="move-mode-once" value="this_visit_only" className="mt-0.5" />
                    <span>
                      <span className="font-medium text-foreground">This visit only</span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        After this job, the schedule returns to the original day pattern.
                      </span>
                    </span>
                  </label>
                </RadioGroup>
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
    </>
  );
}
