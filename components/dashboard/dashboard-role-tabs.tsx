"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { setActiveRole } from "@/lib/actions/profile";
import { cn } from "@/lib/utils";

export type DashboardRoleTabsProps = {
  currentView: "lister" | "cleaner";
  className?: string;
};

export function DashboardRoleTabs({ currentView, className }: DashboardRoleTabsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleTabChange = (view: "lister" | "cleaner") => {
    if (view === currentView) return;
    startTransition(async () => {
      const result = await setActiveRole(view);
      if (result.ok) {
        router.replace(`/dashboard?view=${view}`);
        router.refresh();
      }
    });
  };

  return (
    <Tabs value={currentView} className={cn("w-full", className)}>
      <TabsList className="grid w-full grid-cols-2 sm:max-w-md">
        <TabsTrigger
          value="lister"
          onClick={() => handleTabChange("lister")}
          disabled={isPending}
        >
          Lister View
        </TabsTrigger>
        <TabsTrigger
          value="cleaner"
          onClick={() => handleTabChange("cleaner")}
          disabled={isPending}
        >
          Cleaner View
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );
}
