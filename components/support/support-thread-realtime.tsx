"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

export function SupportThreadRealtime({ ticketId }: { ticketId: string }) {
  const router = useRouter();
  useEffect(() => {
    const supabase = createBrowserSupabaseClient();
    const channel = supabase
      .channel(`support-thread-${ticketId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "support_ticket_messages", filter: `ticket_id=eq.${ticketId}` },
        () => router.refresh()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "support_tickets", filter: `id=eq.${ticketId}` },
        () => router.refresh()
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [router, ticketId]);
  return null;
}
