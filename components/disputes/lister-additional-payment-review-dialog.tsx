"use client";

import { type ReactNode, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { reviewCleanerAdditionalPaymentRequest } from "@/lib/actions/disputes";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";

export type ListerAdditionalPaymentReviewDialogProps = {
  requestId: string;
  amountCents: number;
  reason: string;
  jobId: number;
  /** Default trigger label */
  triggerLabel?: string;
  triggerClassName?: string;
  /** Use custom trigger (e.g. link styled as button) */
  children?: ReactNode;
};

export function ListerAdditionalPaymentReviewDialog({
  requestId,
  amountCents,
  reason,
  jobId,
  triggerLabel = "View request",
  triggerClassName,
  children,
}: ListerAdditionalPaymentReviewDialogProps) {
  const [open, setOpen] = useState(false);
  const [listerNote, setListerNote] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const { toast } = useToast();

  const amountLabel = `$${(Number(amountCents) / 100).toFixed(2)} AUD`;

  function submit(decision: "accept" | "deny") {
    startTransition(async () => {
      const fd = new FormData();
      fd.set("requestId", requestId);
      fd.set("decision", decision);
      if (decision === "deny" && listerNote.trim()) {
        fd.set("listerNote", listerNote.trim());
      }
      const r = await reviewCleanerAdditionalPaymentRequest(fd);
      if (r.error) {
        toast({
          variant: "destructive",
          title: "Couldn’t update request",
          description: r.error,
        });
        return;
      }
      toast({
        title: decision === "accept" ? "Opening checkout" : "Request denied",
        description: r.success ?? "Done.",
      });
      setOpen(false);
      setListerNote("");
      if (r.checkoutUrl) {
        window.location.href = r.checkoutUrl;
        return;
      }
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children ?? (
          <Button type="button" size="sm" className={cn("font-semibold", triggerClassName)}>
            {triggerLabel}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-md overflow-y-auto border-border dark:border-gray-700 dark:bg-gray-950 sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-lg dark:text-gray-100">Additional payment request</DialogTitle>
          <DialogDescription className="text-left text-sm text-muted-foreground dark:text-gray-400">
            Job #{jobId} — review the cleaner&apos;s request, then accept to pay through Stripe or deny.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <div className="rounded-lg border border-border bg-muted/40 px-3 py-2.5 dark:border-gray-700 dark:bg-gray-900/50">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Amount</p>
            <p className="text-base font-semibold text-foreground dark:text-gray-100">{amountLabel}</p>
          </div>
          <div className="rounded-lg border border-border bg-muted/40 px-3 py-2.5 dark:border-gray-700 dark:bg-gray-900/50">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Reason</p>
            <p className="mt-1 whitespace-pre-wrap text-foreground dark:text-gray-200">{reason || "—"}</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`deny-note-${requestId}`} className="text-muted-foreground">
              Optional note if you deny (sent to the cleaner)
            </Label>
            <Textarea
              id={`deny-note-${requestId}`}
              value={listerNote}
              onChange={(e) => setListerNote(e.target.value)}
              rows={3}
              placeholder="Explain why you’re declining, if you’d like…"
              className="resize-none dark:border-gray-700 dark:bg-gray-900"
              disabled={pending}
            />
          </div>
        </div>
        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <Button
            type="button"
            className="w-full"
            disabled={pending}
            onClick={() => submit("accept")}
          >
            {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : null}
            Accept and pay
          </Button>
          <Button
            type="button"
            variant="outline"
            className="w-full dark:border-gray-600"
            disabled={pending}
            onClick={() => submit("deny")}
          >
            Deny request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
