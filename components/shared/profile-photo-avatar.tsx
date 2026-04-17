"use client";

import { useState } from "react";
import { OptimizedImage } from "@/components/ui/optimized-image";
import { cn } from "@/lib/utils";
import { isGooglePublicAvatarUrl } from "@/lib/google-avatar-url";

function avatarInitials(displayName: string): string {
  const t = displayName.trim();
  if (!t) return "?";
  return t
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export type ProfilePhotoAvatarProps = {
  photoUrl: string | null | undefined;
  /** Used for initials when there is no image or when loading fails */
  displayName: string;
  width: number;
  height: number;
  sizes: string;
  priority?: boolean;
  className?: string;
  imageClassName?: string;
  /** Larger initials on big avatars (e.g. profile hero) */
  initialsClassName?: string;
};

/**
 * Profile or avatar image with initials fallback when URL is missing or the image errors
 * (e.g. stale storage URL). Avoids relying on a static placeholder file under /public.
 */
export function ProfilePhotoAvatar({
  photoUrl,
  displayName,
  width,
  height,
  sizes,
  priority = false,
  className,
  imageClassName,
  initialsClassName,
}: ProfilePhotoAvatarProps) {
  const [failed, setFailed] = useState(false);
  const url = typeof photoUrl === "string" && photoUrl.trim() ? photoUrl.trim() : null;
  const showImage = Boolean(url) && !failed;
  const initials = avatarInitials(displayName);

  return (
    <div className={cn("relative overflow-hidden bg-muted dark:bg-gray-800", className)}>
      {showImage ? (
        <OptimizedImage
          src={url}
          alt=""
          width={width}
          height={height}
          sizes={sizes}
          quality={75}
          priority={priority}
          referrerPolicy={isGooglePublicAvatarUrl(url) ? "no-referrer" : undefined}
          className={cn("h-full w-full object-cover", imageClassName)}
          onError={() => setFailed(true)}
        />
      ) : (
        <span
          className={cn(
            "flex h-full w-full items-center justify-center text-center text-base font-semibold tracking-tight text-muted-foreground dark:text-gray-300",
            initialsClassName
          )}
          aria-hidden
        >
          {initials}
        </span>
      )}
    </div>
  );
}
