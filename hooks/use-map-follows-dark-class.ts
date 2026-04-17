"use client";

import * as React from "react";

/** True when `document.documentElement` has class `dark` (Tailwind / theme). */
export function useMapFollowsDarkClass(): boolean {
  const [dark, setDark] = React.useState(false);

  React.useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    const apply = () => setDark(root.classList.contains("dark"));
    apply();
    const obs = new MutationObserver(apply);
    obs.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);

  return dark;
}
