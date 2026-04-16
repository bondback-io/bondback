"use client";

import { useEffect, useState, useTransition, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight, Pencil, Trash2 } from "lucide-react";

/** Minimal row shape for job checklist UI (matches `job_checklist_items`). */
export type JobChecklistRow = {
  id: number;
  label: string;
  is_completed: boolean;
};

const PAGE_SIZE = 8;

type JobCleaningChecklistPanelProps = {
  items: JobChecklistRow[] | null;
  loading: boolean;
  error: string | null;
  isJobLister: boolean;
  isJobCleaner: boolean;
  checklistParty: boolean;
  /** Larger typography / touch targets (cleaner & lister job views). */
  emphasize: boolean;
  subtitle: ReactNode;
  onToggle: (item: JobChecklistRow, next: boolean) => void | Promise<void>;
  onRemove: (item: JobChecklistRow) => void | Promise<void>;
  onUpdateLabel: (item: JobChecklistRow, label: string) => void | Promise<void>;
  onAdd: (label: string) => Promise<void>;
  onMarkAllComplete: () => void;
  allCompleted: boolean;
  showAfterPhotoHint: boolean;
};

export function JobCleaningChecklistPanel({
  items,
  loading,
  error,
  isJobLister,
  isJobCleaner,
  checklistParty,
  emphasize,
  subtitle,
  onToggle,
  onRemove,
  onUpdateLabel,
  onAdd,
  onMarkAllComplete,
  allCompleted,
  showAfterPhotoHint,
}: JobCleaningChecklistPanelProps) {
  const list = items ?? [];
  const total = list.length;
  const done = list.filter((i) => i.is_completed).length;
  const [page, setPage] = useState(0);
  const pageCount = total > 0 ? Math.max(1, Math.ceil(total / PAGE_SIZE)) : 0;
  const safePage = pageCount > 0 ? Math.min(page, pageCount - 1) : 0;
  const start = safePage * PAGE_SIZE;
  const pageItems = list.slice(start, start + PAGE_SIZE);

  useEffect(() => {
    if (pageCount <= 0) return;
    setPage((p) => Math.min(p, Math.max(0, pageCount - 1)));
  }, [pageCount, total]);

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p
            className={cn(
              "font-semibold dark:text-gray-100",
              emphasize ? "text-lg" : "text-sm font-medium"
            )}
          >
            Cleaning checklist
          </p>
          <p
            className={cn(
              "text-muted-foreground dark:text-gray-400",
              emphasize ? "text-sm leading-snug" : "text-xs leading-snug"
            )}
          >
            {subtitle}
          </p>
        </div>
        {total > 0 && (
          <div className="flex shrink-0 flex-col items-end gap-1 text-right">
            <span
              className={cn(
                "font-medium tabular-nums text-foreground dark:text-gray-100",
                emphasize ? "text-sm" : "text-xs"
              )}
            >
              {done}/{total} done
            </span>
            <Progress
              value={total ? (done / total) * 100 : 0}
              className="h-1.5 w-[7rem] sm:w-28"
              aria-label={`${done} of ${total} tasks completed`}
            />
          </div>
        )}
      </div>

      {loading && (
        <p className="text-xs text-muted-foreground dark:text-gray-400">Loading checklist…</p>
      )}
      {error && <p className="text-xs text-destructive dark:text-red-400">{error}</p>}

      {total > 0 && (
        <>
          <ul
            className="grid grid-cols-1 gap-1.5 min-[420px]:grid-cols-2 min-[420px]:gap-x-2 min-[420px]:gap-y-1.5"
            role="list"
            aria-label="Cleaning tasks"
          >
            {pageItems.map((item) => (
              <ChecklistTaskRow
                key={item.id}
                item={item}
                emphasize={emphasize}
                checklistParty={checklistParty}
                isJobLister={isJobLister}
                onToggle={onToggle}
                onRemove={onRemove}
                onUpdateLabel={onUpdateLabel}
              />
            ))}
          </ul>

          {total > 0 && pageCount > 1 && (
            <div className="flex items-center justify-between gap-2 pt-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-9 gap-1 px-2 text-xs"
                disabled={safePage <= 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                aria-label="Previous page of tasks"
              >
                <ChevronLeft className="h-4 w-4" aria-hidden />
                Prev
              </Button>
              <span className="text-xs tabular-nums text-muted-foreground dark:text-gray-500">
                Page {safePage + 1} of {pageCount}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-9 gap-1 px-2 text-xs"
                disabled={safePage >= pageCount - 1}
                onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
                aria-label="Next page of tasks"
              >
                Next
                <ChevronRight className="h-4 w-4" aria-hidden />
              </Button>
            </div>
          )}
        </>
      )}

      {isJobLister && <JobChecklistAddTask onAdd={onAdd} compact={emphasize} />}

      {isJobCleaner && total > 0 && (
        <div className="pt-1">
          <Button
            type="button"
            variant="outline"
            className={cn(
              isJobCleaner
                ? "min-h-11 w-full rounded-lg px-3 text-sm font-semibold sm:min-h-10 sm:w-auto"
                : "text-[10px]"
            )}
            size={isJobCleaner ? "default" : "xs"}
            onClick={onMarkAllComplete}
          >
            Mark all tasks as complete
          </Button>
        </div>
      )}

      {allCompleted && (
        <p
          className={cn(
            "rounded-md bg-emerald-50 px-2 py-1.5 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
            emphasize ? "text-sm leading-snug" : "text-[11px] leading-snug"
          )}
        >
          All tasks are marked complete on the checklist.
        </p>
      )}

      {showAfterPhotoHint && (
        <p className="pt-0.5 text-[11px] leading-snug text-amber-700 dark:text-amber-300">
          Upload at least 3 after-photos so the owner can review and release payment.
        </p>
      )}
    </>
  );
}

function ChecklistTaskRow({
  item,
  emphasize,
  checklistParty,
  isJobLister,
  onToggle,
  onRemove,
  onUpdateLabel,
}: {
  item: JobChecklistRow;
  emphasize: boolean;
  checklistParty: boolean;
  isJobLister: boolean;
  onToggle: (item: JobChecklistRow, next: boolean) => void | Promise<void>;
  onRemove: (item: JobChecklistRow) => void | Promise<void>;
  onUpdateLabel: (item: JobChecklistRow, label: string) => void | Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(item.label);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!editing) setDraft(item.label);
  }, [item.label, editing]);

  return (
    <li
      className={cn(
        "flex min-h-[40px] items-start gap-2 rounded-lg border border-border/60 bg-muted/15 px-2 py-1.5 dark:border-gray-700/80 dark:bg-gray-900/40",
        checklistParty && "min-h-[44px] sm:min-h-[40px]"
      )}
    >
      <Checkbox
        id={`job-checklist-cb-${item.id}`}
        checked={item.is_completed}
        onCheckedChange={(value) => onToggle(item, value === true)}
        className={cn("mt-0.5 shrink-0", emphasize ? "h-4 w-4 sm:h-[18px] sm:w-[18px]" : "h-3.5 w-3.5")}
        aria-label={`Task: ${item.label}`}
      />
      <div className="min-w-0 flex-1">
        {editing ? (
          <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center">
            <Input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              className="h-9 text-xs sm:h-8 sm:text-sm"
              disabled={pending}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  startTransition(async () => {
                    await onUpdateLabel(item, draft);
                    setEditing(false);
                  });
                }
                if (e.key === "Escape") {
                  setDraft(item.label);
                  setEditing(false);
                }
              }}
              aria-label="Edit task label"
            />
            <div className="flex shrink-0 gap-1">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="h-8 text-xs"
                disabled={pending || !draft.trim()}
                onClick={() =>
                  startTransition(async () => {
                    await onUpdateLabel(item, draft);
                    setEditing(false);
                  })
                }
              >
                Save
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-8 text-xs"
                disabled={pending}
                onClick={() => {
                  setDraft(item.label);
                  setEditing(false);
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <label
            htmlFor={`job-checklist-cb-${item.id}`}
            className="block cursor-pointer"
          >
            <span
              className={cn(
                "leading-snug dark:text-gray-200",
                emphasize ? "text-sm" : "text-xs",
                item.is_completed && "text-muted-foreground line-through dark:text-gray-500"
              )}
            >
              {item.label}
            </span>
          </label>
        )}
      </div>
      {isJobLister && !editing && (
        <div className="flex shrink-0 gap-0.5 self-start pt-0.5">
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-8 w-8 text-muted-foreground hover:text-foreground dark:text-gray-400"
            aria-label="Edit task"
            onClick={() => setEditing(true)}
          >
            <Pencil className="h-3.5 w-3.5" aria-hidden />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-8 w-8 text-muted-foreground hover:text-destructive dark:text-gray-400 dark:hover:text-red-400"
            aria-label="Remove task"
            onClick={async () => {
              if (!window.confirm("Remove this task from the checklist?")) return;
              await onRemove(item);
            }}
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden />
          </Button>
        </div>
      )}
    </li>
  );
}

type JobChecklistAddTaskProps = {
  onAdd: (label: string) => Promise<void> | void;
  compact?: boolean;
};

export function JobChecklistAddTask({ onAdd, compact }: JobChecklistAddTaskProps) {
  const [value, setValue] = useState("");
  const [pending, startTransition] = useTransition();

  const handleSubmit = () => {
    const trimmed = value.trim();
    if (!trimmed) return;
    startTransition(async () => {
      await onAdd(trimmed);
      setValue("");
    });
  };

  return (
    <div
      className={cn(
        "flex flex-col gap-2 pt-1 sm:flex-row sm:flex-wrap sm:items-center",
        compact && "sm:gap-2"
      )}
    >
      <Input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Add a task (e.g. windows, garage)…"
        className={cn(
          "h-10 min-h-[44px] text-sm sm:h-9 sm:min-h-0 sm:flex-1 sm:text-sm",
          !compact && "text-xs"
        )}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            handleSubmit();
          }
        }}
      />
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={pending || !value.trim()}
        onClick={handleSubmit}
        className="h-10 shrink-0 sm:h-9"
      >
        {pending ? "Adding…" : "Add task"}
      </Button>
    </div>
  );
}

type ChecklistHistoryGridProps = {
  items: JobChecklistRow[] | null;
  detailUiBoost?: boolean;
};

/** Read-only compact grid for completed-job checklist history. */
export function ChecklistHistoryGrid({ items, detailUiBoost }: ChecklistHistoryGridProps) {
  const list = items ?? [];
  if (list.length === 0) return null;
  return (
    <ul
      className="grid grid-cols-1 gap-1 min-[420px]:grid-cols-2"
      role="list"
      aria-label="Completed checklist tasks"
    >
      {list.map((item) => (
        <li
          key={item.id}
          className={cn(
            "flex items-start gap-2 rounded-md border border-border/40 bg-muted/10 px-2 py-1 dark:border-gray-700/60 dark:bg-gray-900/30",
            detailUiBoost ? "text-sm" : "text-xs"
          )}
        >
          <Checkbox
            checked={item.is_completed}
            className={cn("mt-0.5 shrink-0", detailUiBoost ? "h-4 w-4" : "h-3.5 w-3.5")}
            disabled
            aria-hidden
          />
          <span className="leading-snug dark:text-gray-200">{item.label}</span>
        </li>
      ))}
    </ul>
  );
}
