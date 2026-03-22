"use client";

import { useRouter } from "next/navigation";
import { PullToRefresh } from "@/components/features/pull-to-refresh";
import { StickyFilterBehavior } from "@/components/features/sticky-filter-behavior";
import { BackToTop } from "@/components/features/back-to-top";
import { useToast } from "@/components/ui/use-toast";

export function JobsPageMobileShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { toast } = useToast();

  const handleRefresh = async () => {
    router.refresh();
    toast({ title: "Updated", description: "Results refreshed." });
  };

  return (
    <>
      <StickyFilterBehavior />
      <PullToRefresh onRefresh={handleRefresh} mobileOnly>
        {children}
      </PullToRefresh>
      <BackToTop />
    </>
  );
}
