"use client";

import * as React from "react";
import { useToast } from "@/components/ui/use-toast";
import { Heart } from "lucide-react";
import { cn } from "@/lib/utils";

const SWIPE_THRESHOLD = 60;

/**
 * Optional: wrap a job card so that swipe right shows "Saved" toast and haptic.
 * Mobile only; desktop unchanged.
 */
export function SwipeToSaveWrapper({
  children,
  onSave,
  className,
}: {
  children: React.ReactNode;
  onSave?: () => void;
  className?: string;
}) {
  const { toast } = useToast();
  const startX = React.useRef(0);
  const [offset, setOffset] = React.useState(0);
  const [saved, setSaved] = React.useState(false);

  const handleSave = React.useCallback(() => {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      (navigator as Navigator & { vibrate: (ms: number) => void }).vibrate(15);
    }
    setSaved(true);
    onSave?.();
    toast({
      title: "Saved",
      description: "Job saved to favorites.",
    });
    setTimeout(() => setSaved(false), 600);
  }, [onSave, toast]);

  const onTouchStart = (e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX;
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (saved) return;
    const x = e.touches[0].clientX;
    const delta = x - startX.current;
    if (delta > 0) setOffset(Math.min(delta, 80));
    else setOffset(0);
  };

  const onTouchEnd = () => {
    if (offset >= SWIPE_THRESHOLD) handleSave();
    setOffset(0);
  };

  return (
    <div
      className={cn("relative overflow-hidden md:overflow-visible", className)}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {/* Swipe-right "Save" hint — mobile only, revealed as card slides */}
      <div
        className="absolute left-0 top-0 z-0 flex h-full w-14 items-center justify-center bg-primary/90 text-primary-foreground transition-opacity duration-150 md:hidden"
        style={{ opacity: offset > 15 ? 1 : 0 }}
        aria-hidden
      >
        <Heart className="h-5 w-5" fill="currentColor" />
      </div>
      <div
        className="relative z-10 transition-transform duration-150 md:translate-x-0"
        style={{ transform: `translateX(${offset}px)` }}
      >
        {children}
      </div>
    </div>
  );
}
