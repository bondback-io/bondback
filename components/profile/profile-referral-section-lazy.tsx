"use client";

import dynamic from "next/dynamic";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { ProfileReferralSectionProps } from "@/components/features/profile-referral-section";

const DynamicReferral = dynamic(
  () =>
    import("@/components/features/profile-referral-section").then((m) => ({
      default: m.ProfileReferralSection,
    })),
  {
    loading: () => (
      <Card className="border-border dark:border-gray-800">
        <CardContent className="space-y-3 p-5 sm:p-6">
          <Skeleton className="h-6 w-48 max-w-full sm:h-5" aria-hidden />
          <Skeleton className="h-10 w-full rounded-md" aria-hidden />
          <div className="flex flex-wrap gap-2">
            <Skeleton className="h-9 w-24 rounded-md" aria-hidden />
            <Skeleton className="h-9 w-24 rounded-md" aria-hidden />
          </div>
        </CardContent>
      </Card>
    ),
  }
);

export function ProfileReferralSectionLazy(props: ProfileReferralSectionProps) {
  return <DynamicReferral {...props} />;
}
