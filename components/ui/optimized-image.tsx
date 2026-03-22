"use client";

import React from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";

const SUPABASE_STORAGE_HOST = "olidrzdufyewiocquhtb.supabase.co";

function isOptimizable(src: string | null | undefined): boolean {
  if (!src || typeof src !== "string") return false;
  try {
    const u = new URL(src);
    return u.hostname === SUPABASE_STORAGE_HOST;
  } catch {
    return false;
  }
}

export type OptimizedImageProps = {
  src: string | null | undefined;
  alt: string;
  fill?: boolean;
  width?: number;
  height?: number;
  sizes?: string;
  priority?: boolean;
  className?: string;
  /** Aspect ratio container (e.g. aspect-[16/10]) when fill */
  containerClassName?: string;
};

/**
 * Uses next/image (lazy, quality 75, WebP) for Supabase URLs; falls back to <img> for others.
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
  className,
  containerClassName,
}: OptimizedImageProps) {
  if (!src?.trim()) {
    return null;
  }

  const optimizable = isOptimizable(src);

  if (optimizable && (fill || (width && height))) {
    const content = (
      <Image
        src={src}
        alt={alt}
        fill={fill}
        width={!fill ? width : undefined}
        height={!fill ? height : undefined}
        sizes={sizes}
        quality={75}
        loading={priority ? "eager" : "lazy"}
        priority={priority}
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
