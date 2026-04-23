"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  respondToMediationProposal,
  type DisputeActionState,
} from "@/lib/actions/disputes";
import { useToast } from "@/components/ui/use-toast";

function outcomeAlert(
  vote: "accept" | "reject",
  r: DisputeActionState
): { variant: "success" | "info" | "warning"; title: string; body: string } | null {
  if (r.error || !r.ok) return null;

  const o = r.mediationVoteOutcome;

  if (vote === "reject" || o === "declined") {
    return {
      variant: "warning",
      title: "Proposal declined",
      body:
        r.success ??
        "An admin will review the case and apply a final settlement. You’ll be notified when the dispute is closed.",
    };
  }

  switch (o) {
    case "already_finalized":
      return {
        variant: "info",
        title: "Already settled",
        body: r.success ?? "This mediation was already finalized.",
      };
    case "lister_checkout_redirect":
      return {
        variant: "info",
        title: "Opening secure checkout",
        body:
          "Both parties accepted. You’re being sent to Stripe to pay the mediation top-up. If the page doesn’t open, use Pay / top-up on the job page.",
      };
    case "cleaner_waiting_lister_topup":
      return {
        variant: "info",
        title: "Waiting on lister payment",
        body:
          r.success ??
          "Both parties accepted. The lister must complete the additional payment on the job page before everything can close.",
      };
    case "completed":
      return {
        variant: "success",
        title: "Dispute closed",
        body:
          "Both parties accepted the admin proposal. Refunds (if any) and the cleaner payout are processed; the job is completed.",
      };
    case "pending_other_party":
      return {
        variant: "success",
        title: "Acceptance saved",
        body:
          "You accepted the proposal. Once the other party accepts too, the settlement runs automatically (or you’ll be sent to pay any required top-up). They’ve been notified by email and in-app.",
      };
    default:
      return r.success
        ? { variant: "info", title: "Update", body: r.success }
        : null;
  }
}

export function MediationVoteButtons({ jobId }: { jobId: number }) {
  const router = useRouter();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingAction, setPendingAction] = useState<"accept" | "reject" | null>(null);
  const [resultAlert, setResultAlert] = useState<{
    variant: "success" | "info" | "warning";
    title: string;
    body: string;
  } | null>(null);

  async function run(vote: "accept" | "reject") {
    if (isSubmitting) return;
    setResultAlert(null);
    setPendingAction(vote);
    setIsSubmitting(true);
    try {
      const fd = new FormData();
      fd.set("jobId", String(jobId));
      fd.set("vote", vote);
      const r = await respondToMediationProposal(fd);
      if (r.error) {
        toast({
          variant: "destructive",
          title: "Couldn’t record vote",
          description: r.error,
        });
        return;
      }

      const alert = outcomeAlert(vote, r);
      if (alert) setResultAlert(alert);

      toast({
        title: alert?.title ?? (vote === "accept" ? "Accepted" : "Rejected"),
        description: alert?.body ?? r.success ?? "Done.",
      });

      if (r.checkoutUrl) {
        window.location.href = r.checkoutUrl;
        return;
      }
      router.refresh();
    } finally {
      setIsSubmitting(false);
      setPendingAction(null);
    }
  }

  const busy = isSubmitting;
  const acceptLoading = busy && pendingAction === "accept";
  const rejectLoading = busy && pendingAction === "reject";

  return (
    <div className="space-y-3">
      {resultAlert ? (
        <Alert variant={resultAlert.variant}>
          <AlertDescription className="space-y-1.5">
            <span className="block font-semibold">{resultAlert.title}</span>
            <span className="block text-sm leading-relaxed opacity-95">{resultAlert.body}</span>
          </AlertDescription>
        </Alert>
      ) : null}

      {busy ? (
        <p
          className="flex items-center gap-2 text-sm text-muted-foreground dark:text-gray-400"
          role="status"
          aria-live="polite"
        >
          <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
          {pendingAction === "accept"
            ? "Recording your acceptance and updating the dispute…"
            : "Recording your response…"}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          disabled={busy}
          className="min-w-[7rem]"
          onClick={() => run("accept")}
        >
          {acceptLoading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
          ) : null}
          Accept
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={busy}
          className="min-w-[7rem]"
          onClick={() => run("reject")}
        >
          {rejectLoading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
          ) : null}
          Reject
        </Button>
      </div>
    </div>
  );
}
