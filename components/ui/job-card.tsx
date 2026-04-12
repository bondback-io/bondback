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
      whileTap={{ scale: 0.99 }}
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
} from "@/components/JobCard";
