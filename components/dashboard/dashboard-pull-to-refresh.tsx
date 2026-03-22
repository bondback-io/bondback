"use client";

import { useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { useToast } from "@/components/ui/use-toast";
import { PullToRefresh } from "@/components/features/pull-to-refresh";
import { DashboardRefreshSkeleton } from "@/components/dashboard/dashboard-refresh-skeleton";

export type DashboardPullToRefreshProps = {
  children: React.ReactNode;
};

/**
 * Wraps dashboard content with pull-to-refresh. Uses router.refresh() to refetch server data.
 * Shows loading skeleton during refresh; toasts "Content refreshed" on success.
 * Use only on /lister/dashboard and /cleaner/dashboard.
 */
export function DashboardPullToRefresh({ children }: DashboardPullToRefreshProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();
  const resolveRef = useRef<(() => void) | null>(null);
  const wasPendingRef = useRef(false);

  useEffect(() => {
    if (wasPendingRef.current && !isPending) {
      resolveRef.current?.();
      resolveRef.current = null;
      toast({ title: "Content refreshed" });
    }
    wasPendingRef.current = isPending;
  }, [isPending, toast]);

  const handleRefresh = useCallback(() => {
    return new Promise<void>((resolve) => {
      resolveRef.current = resolve;
      startTransition(() => {
        router.refresh();
      });
    });
  }, [router]);

  return (
    <PullToRefresh onRefresh={handleRefresh} disabled={isPending}>
      {isPending ? <DashboardRefreshSkeleton /> : children}
    </PullToRefresh>
  );
}
