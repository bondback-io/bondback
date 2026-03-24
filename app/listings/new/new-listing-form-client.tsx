"use client";

import { lazy, Suspense } from "react";
import { NewListingFormSkeleton } from "@/components/skeletons/new-listing-form-skeleton";
import type { NewListingFormProps } from "@/components/features/new-listing-form";

const NewListingForm = lazy(() =>
  import("@/components/features/new-listing-form").then((m) => ({
    default: m.NewListingForm,
  }))
);

/**
 * Code-splits the full new-listing form (incl. photo upload) so the initial /listings/new
 * JS payload stays smaller on mobile; shows the same skeleton as route loading.tsx.
 */
export function NewListingFormLazy(props: NewListingFormProps) {
  return (
    <Suspense fallback={<NewListingFormSkeleton />}>
      <NewListingForm {...props} />
    </Suspense>
  );
}
