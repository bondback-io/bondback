import "server-only";
import { revalidateTag } from "next/cache";
import { CACHE_TAGS } from "@/lib/cache-tags";

/** Call when jobs ↔ listings association changes (accept bid, secure job, browse-affecting listing changes). */
export function revalidateJobsBrowseCaches(): void {
  revalidateTag(CACHE_TAGS.takenListingIds, "max");
  revalidateTag(CACHE_TAGS.jobsBrowse, "max");
}

export function revalidateGlobalSettingsCache(): void {
  revalidateTag(CACHE_TAGS.globalSettings, "max");
}

export function revalidateSuburbsReferenceCache(): void {
  revalidateTag(CACHE_TAGS.suburbs, "max");
}
