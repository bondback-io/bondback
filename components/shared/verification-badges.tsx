"use client";

import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { CheckCircle, ShieldCheck } from "lucide-react";
import {
  type VerificationBadgeType,
  VERIFICATION_BADGE_META,
  normalizeVerificationBadges,
} from "@/lib/verification-badges";

export function VerificationBadges({
  badges,
  showLabel = true,
  size = "sm",
}: {
  badges: string[] | null | undefined;
  showLabel?: boolean;
  size?: "sm" | "lg";
}) {
  const list = normalizeVerificationBadges(badges);
  if (list.length === 0) return null;

  return (
    <TooltipProvider>
      <div className="flex flex-wrap items-center gap-1.5">
        {list.map((badge) => {
          const meta = VERIFICATION_BADGE_META[badge as VerificationBadgeType];
          const Icon = badge === "trusted_cleaner" || badge === "verified_lister"
            ? ShieldCheck
            : CheckCircle;
          return (
            <Tooltip key={badge}>
              <TooltipTrigger asChild>
                <Badge
                  className={`gap-1 font-medium ${meta.toneClassName} ${
                    size === "lg" ? "px-2 py-1 text-xs" : "text-[10px]"
                  }`}
                >
                  <Icon className={size === "lg" ? "h-3.5 w-3.5" : "h-3 w-3"} />
                  {showLabel ? meta.label : null}
                </Badge>
              </TooltipTrigger>
              <TooltipContent>{meta.tooltip}</TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </TooltipProvider>
  );
}

