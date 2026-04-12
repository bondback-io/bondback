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
      className="h-full"
      layout={false}
      initial={reduceMotion ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: [0.25, 0.1, 0.25, 1] }}
      whileHover={
        reduceMotion
          ? undefined
          : { y: -2, transition: { duration: 0.18 } }
      }
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
      <Skeleton
        className={cn(
          "w-full rounded-none",
          compact ? "h-[140px] min-h-[120px]" : "h-[200px] min-h-[180px] max-h-[240px]"
        )}
        aria-hidden
      />
      <CardContent className={cn("space-y-3 p-4", compact && "p-3")}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-5 w-[85%]" />
            <Skeleton className="h-4 w-[55%]" />
          </div>
          <Skeleton className="h-9 w-20 shrink-0 rounded-md" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-6 w-16 rounded-full" />
          <Skeleton className="h-6 w-16 rounded-full" />
          <Skeleton className="h-6 w-24 rounded-full" />
        </div>
      </CardContent>
    </Card>
  );
}
