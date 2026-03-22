"use client";

import { useEffect } from "react";

/** On job page load with hash #dispute, scroll to the dispute section (e.g. from notification click). */
export function ScrollToDispute() {
  useEffect(() => {
    if (typeof window === "undefined" || window.location.hash !== "#dispute") return;
    const el = document.getElementById("dispute");
    if (el) {
      const t = setTimeout(() => {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 100);
      return () => clearTimeout(t);
    }
  }, []);
  return null;
}
