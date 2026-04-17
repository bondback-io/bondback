import { redirect } from "next/navigation";

type JobsRedirectSearchParams = Record<string, string | string[] | undefined>;

/**
 * Browse jobs moved to the public `/find-jobs` page (split list + map). Preserve query string for
 * filters and deep links.
 */
export default async function JobsBrowseRedirectPage({
  searchParams,
}: {
  searchParams?: Promise<JobsRedirectSearchParams>;
}) {
  const sp = (await searchParams) ?? {};
  const next = new URLSearchParams();
  for (const [key, value] of Object.entries(sp)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      value.forEach((v) => next.append(key, v));
    } else {
      next.set(key, value);
    }
  }
  const qs = next.toString();
  redirect(qs ? `/find-jobs?${qs}` : "/find-jobs");
}
