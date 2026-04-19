"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { reviewCleanerAdditionalPaymentRequest } from "@/lib/actions/disputes";
import { useToast } from "@/components/ui/use-toast";

export function ReviewAdditionalPaymentButtons({
  requestId,
}: {
  requestId: string;
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const { toast } = useToast();

  function run(decision: "accept" | "deny") {
    startTransition(async () => {
      const fd = new FormData();
      fd.set("requestId", requestId);
      fd.set("decision", decision);
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
        title: decision === "accept" ? "Accepted" : "Denied",
        description: r.success ?? "Done.",
      });
      if (r.checkoutUrl) {
        window.location.href = r.checkoutUrl;
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="mt-2 flex flex-wrap gap-2">
      <Button type="button" size="sm" disabled={pending} onClick={() => run("accept")}>
        {pending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" aria-hidden /> : null}
        Accept
      </Button>
      <Button type="button" size="sm" variant="outline" disabled={pending} onClick={() => run("deny")}>
        Deny
      </Button>
    </div>
  );
}
