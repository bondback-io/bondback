"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/use-toast";

export type OfflineJobsPrimerProps = {
  /** When set, prime job list cache (fetch /api/jobs with these search params). */
  jobsListQuery?: string;
  /** When set, prime job detail cache for this id. */
  jobId?: string | null;
  children: React.ReactNode;
};

/**
 * Primes IndexedDB job cache when online (fetches /api/jobs or /api/jobs/[id]; service worker caches response).
 * Site-wide offline banner lives in the root layout. On reconnect, refreshes and shows a toast.
 */
export function OfflineJobsPrimer({
  jobsListQuery = "",
  jobId = null,
  children,
}: OfflineJobsPrimerProps) {
  const router = useRouter();
  const { toast } = useToast();
  const hadOffline = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!navigator.onLine) {
      hadOffline.current = true;
      return;
    }
    const url = jobId
      ? `/api/jobs/${jobId}`
      : `/api/jobs${jobsListQuery ? `?${jobsListQuery}` : ""}`;
    fetch(url, { credentials: "include" }).catch(() => {});
  }, [jobId, jobsListQuery]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onOffline = () => {
      hadOffline.current = true;
    };
    const onOnline = () => {
      if (hadOffline.current) {
        hadOffline.current = false;
        toast({
          title: "Back online",
          description: "Data refreshed.",
        });
        router.refresh();
      }
    };
    window.addEventListener("offline", onOffline);
    window.addEventListener("online", onOnline);
    return () => {
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("online", onOnline);
    };
  }, [router, toast]);

  return <>{children}</>;
}
