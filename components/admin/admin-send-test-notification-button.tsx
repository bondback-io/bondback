"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { sendAdminTestNotification } from "@/lib/actions/notifications";
import { useToast } from "@/components/ui/use-toast";

/** Temporary QA control — sends an in-app row to the logged-in admin only. */
export function AdminSendTestNotificationButton() {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={loading}
      onClick={async () => {
        setLoading(true);
        try {
          const r = await sendAdminTestNotification();
          if (r.ok) {
            toast({
              title: "Test notification sent",
              description: "Check the bell icon or /notifications.",
            });
          } else {
            toast({
              variant: "destructive",
              title: "Could not send",
              description: r.error ?? "Unknown error",
            });
          }
        } finally {
          setLoading(false);
        }
      }}
    >
      {loading ? "Sending…" : "Send test notification"}
    </Button>
  );
}
