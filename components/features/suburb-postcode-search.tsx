"use client";

/**
 * @deprecated Prefer importing `FindJobsSearch` from `@/components/features/find-jobs-search`.
 * Kept for backwards compatibility with existing imports.
 */
import { FindJobsSearch } from "@/components/features/find-jobs-search";
import type { FindJobsSearchProps } from "@/components/features/find-jobs-search";

export type SuburbPostcodeSearchProps = Pick<FindJobsSearchProps, "className">;

export function SuburbPostcodeSearch({ className }: SuburbPostcodeSearchProps) {
  return <FindJobsSearch variant="home" className={className} />;
}
