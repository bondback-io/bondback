"use client";

import { memo } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  DashboardJobCard,
  type DashboardJobCardProps,
} from "@/components/dashboard/dashboard-job-card";

export type JobCardProps = DashboardJobCardProps;

function JobCardInner(props: DashboardJobCardProps) {
  const reduceMotion = useReducedMotion();
  return (
    <motion.div
      className="h-full will-change-transform"
      initial={false}
      whileHover={reduceMotion ? undefined : { y: -3 }}
      whileTap={reduceMotion ? undefined : { scale: 0.992 }}
      transition={{ type: "spring", stiffness: 420, damping: 28 }}
    >
      <DashboardJobCard {...props} />
    </motion.div>
  );
}

/**
 * Assigned / in-progress job row for dashboards — links to `/jobs/[numericId]` via
 * {@link detailUrlForCardItem} inside {@link DashboardJobCard}.
 */
export const JobCard = memo(JobCardInner);
JobCard.displayName = "JobCard";

export { DashboardJobCard } from "@/components/dashboard/dashboard-job-card";
export type { DashboardJobCardProps } from "@/components/dashboard/dashboard-job-card";

export {
  JobCardMarketplaceMobile,
  type JobCardMarketplaceMobileProps,
  formatAuctionTimeLeftShort,
} from "@/components/ui/marketplace-job-card-mobile";
