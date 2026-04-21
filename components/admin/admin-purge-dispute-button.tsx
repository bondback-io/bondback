"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { adminPurgeJobDisputeRecord } from "@/lib/actions/admin-jobs";

export function AdminPurgeDisputeButton({
  jobId,
  variant = "list",
  afterSuccess: afterSuccessProp,
}: {
  jobId: number;
  /** `list` = compact outline; `detail` = full-width destructive emphasis */
  variant?: "list" | "detail";
  /** After success: refresh current page or navigate back to the disputes queue index. */
  afterSuccess?: "refresh" | "home";
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const afterSuccess = afterSuccessProp ?? (variant === "detail" ? "home" : "refresh");

  const handleConfirm = async () => {
    setPending(true);
    try {
      const fd = new FormData();
      fd.set("jobId", String(jobId));
      await adminPurgeJobDisputeRecord(fd);
      setOpen(false);
      toast({
        title: "Dispute record removed",
        description: "The job was taken out of the disputes queue and thread history was cleared.",
      });
      if (afterSuccess === "home") {
        router.push("/admin/disputes");
      }
      router.refresh();
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Could not remove dispute",
        description: e instanceof Error ? e.message : "Try again or check server logs.",
      });
    } finally {
      setPending(false);
    }
  };

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant={variant === "detail" ? "destructive" : "outline"}
        className={
          variant === "list"
            ? "border-destructive/50 text-destructive hover:bg-destructive/10 dark:border-red-900 dark:text-red-400"
            : undefined
        }
        onClick={() => setOpen(true)}
        disabled={pending}
      >
        Remove dispute
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="dark:bg-gray-900 dark:border-gray-800">
          <DialogHeader>
            <DialogTitle className="dark:text-gray-100">Remove dispute from admin queue?</DialogTitle>
            <DialogDescription className="text-left text-muted-foreground dark:text-gray-400">
              This clears dispute fields on job #{jobId}, deletes the dispute message thread and mediation votes, and
              sets <strong className="text-foreground dark:text-gray-200">disputed_at</strong> to empty so the job no
              longer appears here. It does <strong className="text-foreground dark:text-gray-200">not</strong> reverse
              Stripe payments or refunds. If the job is still in a dispute workflow status, it will return to lister
              review or in progress.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={pending}
              className="dark:border-gray-700 dark:hover:bg-gray-800"
            >
              Cancel
            </Button>
            <Button type="button" variant="destructive" onClick={handleConfirm} disabled={pending}>
              {pending ? "Removing…" : "Yes, remove dispute"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
