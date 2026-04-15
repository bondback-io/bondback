"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { adminDeleteSupportTicket } from "@/lib/actions/support-thread";
import { cn } from "@/lib/utils";

type AdminDeleteSupportTicketButtonProps = {
  ticketId: string;
  variant?: "destructive" | "ghost";
  className?: string;
};

export function AdminDeleteSupportTicketButton({
  ticketId,
  variant = "destructive",
  className,
}: AdminDeleteSupportTicketButtonProps) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function onDelete() {
    const msg =
      "Delete this support ticket and all replies? Attachments are removed from storage. This cannot be undone.";
    if (!window.confirm(msg)) return;
    startTransition(async () => {
      try {
        await adminDeleteSupportTicket(ticketId);
        router.push("/admin/support");
        router.refresh();
      } catch (e) {
        const message = e instanceof Error ? e.message : "Delete failed.";
        window.alert(message);
      }
    });
  }

  if (variant === "ghost") {
    return (
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={cn("h-8 w-8 shrink-0 text-destructive hover:text-destructive", className)}
        disabled={pending}
        onClick={(ev) => {
          ev.preventDefault();
          ev.stopPropagation();
          onDelete();
        }}
        aria-label="Delete support ticket"
      >
        <Trash2 className="h-4 w-4" aria-hidden />
      </Button>
    );
  }

  return (
    <Button
      type="button"
      variant="destructive"
      size="sm"
      className={className}
      disabled={pending}
      onClick={onDelete}
    >
      {pending ? "Deleting…" : "Delete ticket"}
    </Button>
  );
}
