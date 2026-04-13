"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { REMOTE_IMAGE_BLUR_DATA_URL } from "@/lib/remote-image-blur";

const SWIPE_PX = 56;

export type ImageLightboxGalleryProps = {
  open: boolean;
  urls: readonly string[];
  initialIndex?: number;
  onClose: () => void;
  /** Accessible name for the dialog */
  ariaLabel?: string;
};

export function ImageLightboxGallery({
  open,
  urls,
  initialIndex = 0,
  onClose,
  ariaLabel = "Enlarged photos",
}: ImageLightboxGalleryProps) {
  const list = urls.map((u) => String(u ?? "").trim()).filter(Boolean);
  const count = list.length;
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!open || count === 0) return;
    const i = Math.max(0, Math.min(initialIndex, count - 1));
    setIndex(i);
  }, [open, initialIndex, count]);

  const goPrev = useCallback(() => {
    setIndex((i) => (i <= 0 ? count - 1 : i - 1));
  }, [count]);

  const goNext = useCallback(() => {
    setIndex((i) => (i >= count - 1 ? 0 : i + 1));
  }, [count]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
      if (count <= 1) return;
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        goPrev();
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        goNext();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, count, onClose, goPrev, goNext]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const touchStartX = useRef<number | null>(null);

  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.targetTouches[0]?.clientX ?? null;
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    if (count <= 1 || touchStartX.current == null) return;
    const endX = e.changedTouches[0]?.clientX;
    if (endX == null) {
      touchStartX.current = null;
      return;
    }
    const dx = endX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(dx) < SWIPE_PX) return;
    if (dx < 0) goNext();
    else goPrev();
  };

  if (!open || count === 0) return null;

  const url = list[index]!;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/88 px-2 animate-in fade-in-0 duration-200 sm:px-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel}
    >
      <div
        className="relative flex w-full max-w-5xl items-center justify-center"
        onClick={(e) => e.stopPropagation()}
      >
        {count > 1 && (
          <button
            type="button"
            aria-label="Previous photo"
            onClick={goPrev}
            className={cn(
              "absolute left-0 top-1/2 z-20 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full",
              "border border-white/20 bg-black/55 text-white shadow-lg backdrop-blur-sm transition hover:bg-black/75",
              "max-sm:h-11 max-sm:w-11"
            )}
          >
            <ChevronLeft className="h-7 w-7 max-sm:h-6 max-sm:w-6" aria-hidden />
          </button>
        )}

        <div
          className="relative mx-12 flex max-h-[90vh] min-h-0 max-w-[min(100vw-6rem,90rem)] flex-col items-center max-sm:mx-10"
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
        >
          <button
            type="button"
            aria-label="Close gallery"
            onClick={onClose}
            className="absolute right-0 top-0 z-20 flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-black/60 text-white shadow-md transition hover:bg-black/80 sm:h-11 sm:w-11"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>

          <div className="relative mt-10 max-h-[min(85vh,900px)] w-full min-w-0 sm:mt-11">
            <Image
              key={url}
              src={url}
              alt=""
              width={1600}
              height={1200}
              sizes="100vw"
              quality={85}
              placeholder="blur"
              blurDataURL={REMOTE_IMAGE_BLUR_DATA_URL}
              className="mx-auto max-h-[min(85vh,900px)] w-auto max-w-full rounded-lg object-contain shadow-lg"
              priority
              fetchPriority="high"
              draggable={false}
            />
          </div>

          {count > 1 && (
            <p className="mt-3 text-center text-xs font-medium tabular-nums text-white/80">
              {index + 1} / {count}
              <span className="mt-0.5 block font-normal text-white/50 sm:hidden">Swipe or use arrows</span>
            </p>
          )}
        </div>

        {count > 1 && (
          <button
            type="button"
            aria-label="Next photo"
            onClick={goNext}
            className={cn(
              "absolute right-0 top-1/2 z-20 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full",
              "border border-white/20 bg-black/55 text-white shadow-lg backdrop-blur-sm transition hover:bg-black/75",
              "max-sm:h-11 max-sm:w-11"
            )}
          >
            <ChevronRight className="h-7 w-7 max-sm:h-6 max-sm:w-6" aria-hidden />
          </button>
        )}
      </div>
    </div>
  );
}
