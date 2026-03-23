"use client";

import type { ThemePreference } from "@/lib/types";

/** Apply theme class on <html> and persist choice to localStorage (used by settings + header). */
export function applyThemeToDocument(theme: ThemePreference): void {
  if (typeof window === "undefined") return;
  const root = document.documentElement;
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  const effective: "light" | "dark" =
    theme === "system" ? (media.matches ? "dark" : "light") : theme;
  if (effective === "dark") root.classList.add("dark");
  else root.classList.remove("dark");
  localStorage.setItem("theme", theme);
}
