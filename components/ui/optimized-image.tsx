"use client";

import React from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { REMOTE_IMAGE_BLUR_DATA_URL } from "@/lib/remote-image-blur";
import { isSupabasePublicImageUrl } from "@/lib/supabase-image-url";

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
};

/**
 * Uses next/image (lazy, WebP/AVIF) for Supabase public URLs; falls back to <img> for others.
 * Reduces CLS by reserving space; use fill + containerClassName for aspect-ratio containers.
 */
export function OptimizedImage({
  src,
  alt,
  fill,
  width,
  height,
  sizes = "(max-width: 768px) 100vw, 50vw",
  priority = false,
  quality = 75,
  blur = true,
  className,
  containerClassName,
}: OptimizedImageProps) {
  if (!src?.trim()) {
    return null;
  }

  const optimizable = isSupabasePublicImageUrl(src);

  if (optimizable && (fill || (width && height))) {
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
        priority={priority}
        placeholder={blur ? "blur" : "empty"}
        blurDataURL={blur ? REMOTE_IMAGE_BLUR_DATA_URL : undefined}
        className={cn("object-cover", className)}
        unoptimized={false}
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

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      className={cn("h-full w-full object-cover", className)}
      width={width}
      height={height}
    />
  );
}
