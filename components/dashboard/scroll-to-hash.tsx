"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * After client navigation to a path with `#anchor`, scroll the target into view.
 * (Next.js App Router sometimes does not scroll to hash on soft navigation.)
 */
export function ScrollToHash({ anchorId }: { anchorId: string }) {
  const pathname = usePathname();

  useEffect(() => {
    if (typeof window === "undefined") return;
    const hash = window.location.hash.replace(/^#/, "");
    if (hash !== anchorId) return;

    const scroll = () => {
      const el = document.getElementById(anchorId);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    };

    scroll();
    const t = window.setTimeout(scroll, 150);
    return () => clearTimeout(t);
  }, [pathname, anchorId]);

  return null;
}
