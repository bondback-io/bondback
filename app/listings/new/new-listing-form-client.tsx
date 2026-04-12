"use client";

import { NewListingForm } from "@/components/features/new-listing-form";
import type { NewListingFormProps } from "@/components/features/new-listing-form";

/**
 * New listing form (client). Loaded synchronously so `next/dynamic` never resolves to
 * `undefined` when `/listings/new` is prefetched from other routes (e.g. layout prefetch),
 * which previously caused "Lazy element type must resolve to a class or function" on /jobs/[id].
 */
export function NewListingFormLazy(props: NewListingFormProps) {
  return <NewListingForm {...props} />;
}
