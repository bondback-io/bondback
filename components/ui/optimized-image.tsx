"use client";

import React from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { REMOTE_IMAGE_BLUR_DATA_URL } from "@/lib/remote-image-blur";
import { isSupabasePublicImageUrl } from "@/lib/supabase-image-url";

/** Default `sizes` — override per layout (grids, avatars) via `lib/next-image-sizes.ts`. */
const DEFAULT_SIZES = "(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw";

export type OptimizedImageProps = {
  src: string | null | undefined;
  alt: string;
  fill?: boolean;
  width?: number;
  height?: number;
  sizes?: string;
  priority?: boolean;
  /** Thumbnails: 65–75; lightbox/hero can pass higher. Default 75. */
  quality?: number;
  /** Blur-up for Supabase URLs (default true). */
  blur?: boolean;
  className?: string;
  /** Aspect ratio container (e.g. aspect-[16/10]) when fill */
  containerClassName?: string;
  /** e.g. try next URL when storage object missing */
  onError?: React.ReactEventHandler<HTMLImageElement>;
  /** Needed for some third-party avatar hosts. */
  referrerPolicy?: React.HTMLAttributeReferrerPolicy;
};

/**
 * Unified image rendering via next/image for consistency and performance.
 * Uses `unoptimized` for non-Supabase hosts while still keeping a single image path.
 */
export function OptimizedImage({
  src,
  alt,
  fill,
  width,
  height,
  sizes = DEFAULT_SIZES,
  priority = false,
  quality = 75,
  blur = true,
  className,
  containerClassName,
  onError,
  referrerPolicy,
}: OptimizedImageProps) {
  if (!src?.trim()) {
    return null;
  }

  const optimizable = isSupabasePublicImageUrl(src);
  const canFill = Boolean(fill);
  const hasFixedDimensions = Boolean(width && height);
  if (!canFill && !hasFixedDimensions) {
    return null;
  }

  const content = (
    <Image
      src={src}
      alt={alt}
      fill={fill}
      width={!fill ? width : undefined}
      height={!fill ? height : undefined}
      sizes={sizes}
      quality={quality}
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : "auto"}
      priority={priority}
      placeholder={optimizable && blur ? "blur" : "empty"}
      blurDataURL={optimizable && blur ? REMOTE_IMAGE_BLUR_DATA_URL : undefined}
      className={cn("object-cover", className)}
      unoptimized={!optimizable}
      onError={onError}
      referrerPolicy={referrerPolicy}
    />
  );

  if (containerClassName) {
    return (
      <div className={cn("relative overflow-hidden", containerClassName)}>
        {content}
      </div>
    );
  }
  return content;
}
