"use client";

import confetti from "canvas-confetti";

/**
 * Full-screen celebratory burst when a launch-promo 0% fee job is completed (escrow release).
 * Safe to call from client handlers only; no-ops if `window` is missing.
 */
export function fireLaunchPromoFreeJobConfetti(): void {
  if (typeof window === "undefined") return;

  const end = Date.now() + 2_000;
  const colors = ["#10b981", "#34d399", "#6ee7b7", "#fbbf24", "#ffffff"];

  const frame = () => {
    confetti({
      particleCount: 3,
      angle: 60,
      spread: 55,
      origin: { x: 0, y: 0.65 },
      colors,
      zIndex: 9999,
    });
    confetti({
      particleCount: 3,
      angle: 120,
      spread: 55,
      origin: { x: 1, y: 0.65 },
      colors,
      zIndex: 9999,
    });
    if (Date.now() < end) {
      requestAnimationFrame(frame);
    }
  };

  frame();

  void confetti({
    particleCount: 120,
    spread: 100,
    origin: { y: 0.55 },
    colors,
    zIndex: 9999,
    scalar: 1.1,
  });
}
