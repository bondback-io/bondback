"use client";

import { memo } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  ListingCard as ListingCardImpl,
  type ListingCardProps,
} from "@/components/features/listing-card";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export type { ListingCardProps };

/** Marketplace / Find Jobs listing card (full feature set, linking via `hrefListingOrJob`). */
export const ListingCard = ListingCardImpl;

function AnimatedListingCardInner(props: ListingCardProps) {
  const reduceMotion = useReducedMotion();
  return (
    <motion.div
      className="h-full will-change-transform"
      initial={false}
      whileHover={reduceMotion ? undefined : { y: -3 }}
      whileTap={reduceMotion ? undefined : { scale: 0.992 }}
      transition={{ type: "spring", stiffness: 420, damping: 28 }}
    >
      <ListingCardImpl {...props} />
    </motion.div>
  );
}

export const AnimatedListingCard = memo(AnimatedListingCardInner);
AnimatedListingCard.displayName = "AnimatedListingCard";

export type ListingCardSkeletonProps = {
  className?: string;
  /** Tighter mobile row (matches compact marketplace cards). */
  compact?: boolean;
};

export function ListingCardSkeleton({
  className,
  compact = false,
}: ListingCardSkeletonProps) {
  return (
    <Card
      className={cn(
        "overflow-hidden border-border bg-card shadow-sm dark:border-gray-800 dark:bg-gray-900/50",
        className
      )}
    >
      {compact ? (
        <Skeleton
          className={cn(
            "w-full rounded-none bg-muted/80 dark:bg-gray-800",
            "h-[140px] min-h-[120px]"
          )}
          aria-hidden
        />
      ) : (
        <div className="grid grid-cols-2 gap-0.5 bg-muted dark:bg-gray-900">
          <Skeleton className="h-[200px] min-h-[180px] rounded-none bg-muted/80 dark:bg-gray-800" aria-hidden />
          <Skeleton className="h-[200px] min-h-[180px] rounded-none bg-muted/60 dark:bg-gray-800/80" aria-hidden />
        </div>
      )}
      <CardContent className={cn("space-y-3 p-4", compact && "p-3")}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-5 w-[85%]" />
            <Skeleton className="h-4 w-[55%]" />
          </div>
          <Skeleton className="h-9 w-20 shrink-0 rounded-md" />
        </div>
        <div className="flex flex-wrap gap-2">
          <Skeleton className="h-6 w-16 rounded-full" />
          <Skeleton className="h-6 w-16 rounded-full" />
          <Skeleton className="h-6 w-24 rounded-full" />
        </div>
        <Skeleton className="h-12 w-full rounded-xl" />
      </CardContent>
    </Card>
  );
}
