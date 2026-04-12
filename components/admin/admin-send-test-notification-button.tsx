"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  sendAdminTestNotification,
  sendAdminTestNotificationByType,
  type NotificationType,
} from "@/lib/actions/notifications";
import { playNotificationChimeFromUserGesture } from "@/lib/notifications/notification-chime";
import { useToast } from "@/components/ui/use-toast";

const TEST_TYPES: { type: NotificationType; label: string }[] = [
  { type: "listing_live", label: "Listing live" },
  { type: "new_bid", label: "New bid" },
  { type: "new_message", label: "New message" },
  { type: "job_created", label: "Job created (lister)" },
  { type: "job_accepted", label: "Bid accepted (cleaner)" },
  { type: "job_approved_to_start", label: "Pay & start (cleaner)" },
  { type: "job_status_update", label: "Job status" },
  { type: "after_photos_uploaded", label: "After photos" },
  { type: "checklist_all_complete", label: "Checklist done" },
  { type: "job_completed", label: "Job complete (review)" },
  { type: "funds_ready", label: "Funds ready" },
  { type: "auto_release_warning", label: "Auto-release 24h" },
  { type: "payment_released", label: "Payment released" },
  { type: "dispute_opened", label: "Dispute opened" },
  { type: "dispute_resolved", label: "Dispute resolved" },
  { type: "new_job_in_area", label: "New job nearby" },
  { type: "job_cancelled_by_lister", label: "Job cancelled" },
  { type: "listing_cancelled_by_lister", label: "Listing ended (had bid)" },
  { type: "referral_reward", label: "Referral reward" },
];

/** Admin QA: in-app notification samples (no email/SMS/push). */
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
            playNotificationChimeFromUserGesture();
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
      {loading ? "Sending…" : "Generic test (new message)"}
    </Button>
  );
}

/** Grid of sample notifications — one button per major type. */
export function AdminSendTestNotificationGrid() {
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const { toast } = useToast();

  const run = async (type: NotificationType) => {
    setLoadingId(type);
    try {
      const r = await sendAdminTestNotificationByType(type);
      if (r.ok) {
        playNotificationChimeFromUserGesture();
        toast({
          title: "Sample sent",
          description: `Type: ${type}. Check the bell or /notifications.`,
        });
      } else {
        toast({
          variant: "destructive",
          title: "Could not send",
          description: r.error ?? "Unknown error",
        });
      }
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {TEST_TYPES.map(({ type, label }) => (
          <Button
            key={type}
            type="button"
            variant="secondary"
            size="sm"
            className="text-xs"
            disabled={loadingId != null}
            onClick={() => run(type)}
          >
            {loadingId === type ? "…" : label}
          </Button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2 border-t border-amber-200/60 pt-3 dark:border-amber-900/40">
        <span className="text-xs text-muted-foreground">Legacy:</span>
        <AdminSendTestNotificationButton />
      </div>
    </div>
  );
}
