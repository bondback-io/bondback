"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { MoreHorizontal } from "lucide-react";
import { overrideTimer, type OverrideTimerActionType } from "@/lib/actions/admin-jobs";

export type PendingReviewJobRow = {
  id: number;
  listerName: string | null;
  cleanerName: string | null;
  completedAt: string | null;
  autoReleaseAt: string;
};

function formatHoursMinutes(msLeft: number) {
  const totalMinutes = Math.max(0, Math.floor(msLeft / (60 * 1000)));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${minutes}m`;
}

function timeBadgeClass(hoursLeft: number) {
  if (hoursLeft > 24) return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200";
  if (hoursLeft >= 6) return "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200";
  return "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200";
}

export function AdminJobsPendingReviewTable({
  jobs,
}: {
  jobs: PendingReviewJobRow[];
}) {
  const router = useRouter();
  const { toast } = useToast();

  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const [activeJob, setActiveJob] = useState<PendingReviewJobRow | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [actionType, setActionType] = useState<OverrideTimerActionType>("force_release_now");
  const [hoursInput, setHoursInput] = useState<string>("");
  const [reason, setReason] = useState<string>("");
  const [confirmOverride, setConfirmOverride] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  const pendingJobsSorted = useMemo(() => {
    return [...jobs].sort(
      (a, b) =>
        new Date(a.autoReleaseAt).getTime() - new Date(b.autoReleaseAt).getTime()
    );
  }, [jobs]);

  const openDialogForJob = (job: PendingReviewJobRow) => {
    setActiveJob(job);
    setDialogOpen(true);
    setActionType("force_release_now");
    setHoursInput("");
    setReason("");
    setConfirmOverride("");
  };

  const canConfirm = useMemo(() => {
    if (!reason.trim()) return false;
    if (confirmOverride.trim().toUpperCase() !== "OVERRIDE") return false;
    if (actionType === "shorten_timer" || actionType === "extend_timer") {
      const n = Number(hoursInput);
      return Number.isFinite(n) && n >= 0;
    }
    return true;
  }, [actionType, confirmOverride, hoursInput, reason]);

  const handleConfirmOverride = async () => {
    if (!activeJob) return;
    if (!canConfirm) return;

    setSubmitting(true);
    try {
      const hours =
        actionType === "shorten_timer" || actionType === "extend_timer"
          ? Number(hoursInput)
          : null;

      const res = await overrideTimer(
        activeJob.id,
        actionType,
        hours,
        reason
      );

      if (!res.ok) {
        toast({ variant: "destructive", title: "Override failed", description: res.error });
        return;
      }

      setDialogOpen(false);
      setActiveJob(null);
      router.refresh();
      toast({ title: "Override applied", description: "Admin timer override updated." });
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Error",
        description: e instanceof Error ? e.message : "Could not override timer.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const renderTimeBadge = (autoReleaseAtIso: string) => {
    const releaseMs = new Date(autoReleaseAtIso).getTime();
    const msLeft = releaseMs - nowMs;
    const hoursLeft = msLeft / (60 * 60 * 1000);
    return (
      <Badge className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${timeBadgeClass(hoursLeft)}`}>
        {formatHoursMinutes(msLeft)}
      </Badge>
    );
  };

  return (
    <div className="space-y-3">
      {pendingJobsSorted.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-muted/30 py-8 text-center text-sm text-muted-foreground dark:border-gray-600 dark:bg-gray-800/30 dark:text-gray-300">
          No jobs currently pending review with an auto-release timer.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-20">Job</TableHead>
                <TableHead className="hidden md:table-cell">Lister</TableHead>
                <TableHead className="hidden md:table-cell">Cleaner</TableHead>
                <TableHead className="hidden sm:table-cell">Completed At</TableHead>
                <TableHead>Time Remaining</TableHead>
                <TableHead className="w-24 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pendingJobsSorted.map((job) => (
                <TableRow key={job.id}>
                  <TableCell>
                    <Link href={`/jobs/${job.id}`} className="text-primary hover:underline">
                      #{job.id}
                    </Link>
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-[11px] text-muted-foreground dark:text-gray-300">
                    {job.listerName ?? "—"}
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-[11px] text-muted-foreground dark:text-gray-300">
                    {job.cleanerName ?? "—"}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell text-[11px] text-muted-foreground dark:text-gray-300">
                    {job.completedAt ? format(new Date(job.completedAt), "dd MMM yyyy") : "—"}
                  </TableCell>
                  <TableCell>{renderTimeBadge(job.autoReleaseAt)}</TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="xs" className="text-[11px]">
                          Actions <MoreHorizontal className="ml-1 h-3 w-3" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onSelect={() => openDialogForJob(job)}
                        >
                          Override Timer
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[560px] dark:border-gray-700 dark:bg-gray-900">
          <DialogHeader>
            <DialogTitle>Override 48h Review Timer</DialogTitle>
            <DialogDescription className="dark:text-gray-400">
              Select an override option and type{" "}
              <code className="rounded-md border border-border bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100">
                OVERRIDE
              </code>{" "}
              to confirm.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant={actionType === "force_release_now" ? "default" : "outline"}
                onClick={() => {
                  setActionType("force_release_now");
                  setHoursInput("");
                }}
              >
                Force Release Now
              </Button>
              <Button
                type="button"
                size="sm"
                variant={actionType === "shorten_timer" ? "default" : "outline"}
                onClick={() => setActionType("shorten_timer")}
              >
                Shorten Timer
              </Button>
              <Button
                type="button"
                size="sm"
                variant={actionType === "extend_timer" ? "default" : "outline"}
                onClick={() => setActionType("extend_timer")}
              >
                Extend Timer
              </Button>
              <Button
                type="button"
                size="sm"
                variant={actionType === "cancel_override" ? "default" : "outline"}
                onClick={() => {
                  setActionType("cancel_override");
                  setHoursInput("");
                }}
              >
                Cancel Override
              </Button>
            </div>

            {(actionType === "shorten_timer" || actionType === "extend_timer") && (
              <div className="space-y-1">
                <label className="text-sm font-medium text-foreground dark:text-gray-100">
                  {actionType === "shorten_timer"
                    ? "Hours left (min 0)"
                    : "Additional hours (min 0)"}
                </label>
                <Input
                  inputMode="numeric"
                  placeholder={actionType === "shorten_timer" ? "e.g. 12" : "e.g. 6"}
                  value={hoursInput}
                  onChange={(e) => setHoursInput(e.target.value)}
                />
              </div>
            )}

            <div className="space-y-1">
              <label className="text-sm font-medium text-foreground dark:text-gray-100">
                Why are you overriding?
              </label>
              <Textarea
                placeholder="Provide a short reason for this admin override…"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={4}
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium text-foreground dark:text-gray-100">
                Double confirmation
              </label>
              <Input
                placeholder='Type "OVERRIDE"'
                value={confirmOverride}
                onChange={(e) => setConfirmOverride(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={submitting}
              onClick={() => setDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={!canConfirm || submitting}
              onClick={handleConfirmOverride}
            >
              {submitting ? "Applying…" : "Confirm override"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

