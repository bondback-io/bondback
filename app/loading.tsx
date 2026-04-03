import { RootSegmentSkeleton } from "@/components/skeletons/root-segment-skeleton";

/** Fallback for routes without a segment `loading.tsx` — neutral hero + blocks (not job cards). */
export default function RootLoading() {
  return <RootSegmentSkeleton />;
}
