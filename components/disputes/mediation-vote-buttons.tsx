"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { respondToMediationProposal } from "@/lib/actions/disputes";
import { useToast } from "@/components/ui/use-toast";

export function MediationVoteButtons({ jobId }: { jobId: number }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const { toast } = useToast();

  function run(vote: "accept" | "reject") {
    startTransition(async () => {
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
      toast({
        title: vote === "accept" ? "Accepted" : "Rejected",
        description: r.success ?? "Done.",
      });
      router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button type="button" size="sm" disabled={pending} onClick={() => run("accept")}>
        {pending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" aria-hidden /> : null}
        Accept
      </Button>
      <Button type="button" size="sm" variant="outline" disabled={pending} onClick={() => run("reject")}>
        Reject
      </Button>
    </div>
  );
}
