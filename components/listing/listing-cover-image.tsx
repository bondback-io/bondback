"use client";

import { useCallback, useEffect, useState } from "react";
import { List } from "lucide-react";
import { cn } from "@/lib/utils";
import { collectListingPhotoUrls, type ListingWithPhotos } from "@/lib/listings";
import { OptimizedImage } from "@/components/ui/optimized-image";

export type ListingCoverImageProps = {
  listing: ListingWithPhotos;
  alt?: string;
  fill?: boolean;
  sizes?: string;
  className?: string;
  /** Icon shown when there are no URLs or every candidate fails to load */
  emptyClassName?: string;
};

/**
 * Listing hero/thumbnail with orphan-cover handling (see {@link collectListingPhotoUrls}) and
 * automatic fallback to the next gallery URL if the browser fails to load an image (404, etc.).
 */
export function ListingCoverImage({
  listing,
  alt = "",
  fill,
  sizes,
  className,
  emptyClassName,
}: ListingCoverImageProps) {
  const candidates = collectListingPhotoUrls(listing);
  const candidateSig = candidates.join("|");
  const [idx, setIdx] = useState(0);
  const [allFailed, setAllFailed] = useState(false);

  useEffect(() => {
    setIdx(0);
    setAllFailed(false);
  }, [candidateSig]);

  const current = candidates[idx];

  const onError = useCallback(() => {
    setIdx((i) => {
      if (i < candidates.length - 1) return i + 1;
      setAllFailed(true);
      return i;
    });
  }, [candidates.length]);

  if (candidates.length === 0 || allFailed) {
    return (
      <div
        className={cn(
          "flex h-full w-full items-center justify-center bg-muted text-muted-foreground dark:bg-gray-800 dark:text-gray-400",
          emptyClassName
        )}
      >
        <List className="h-10 w-10 sm:h-14 sm:w-14" aria-hidden />
      </div>
    );
  }

  return (
    <OptimizedImage
      key={current}
      src={current}
      alt={alt}
      fill={fill}
      sizes={sizes}
      className={className}
      onError={onError}
    />
  );
}
