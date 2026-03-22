"use client";

import { useEffect } from "react";
import { recordJobView } from "@/lib/actions/job-view";

/**
 * Call recordJobView when the job page mounts so we can skip new-message emails
 * when the recipient is viewing the job.
 */
export function RecordJobView({ jobId }: { jobId: string | number }) {
  useEffect(() => {
    recordJobView(jobId);
  }, [jobId]);
  return null;
}
