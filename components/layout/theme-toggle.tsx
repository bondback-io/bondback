"use client";

import * as React from "react";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

type Theme = "light" | "dark";

export function ThemeToggle() {
  const [theme, setTheme] = React.useState<Theme | "system">("system");
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);

    if (typeof window === "undefined") return;

    const stored = window.localStorage.getItem("theme") as Theme | "system" | null;
    const media = window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)");
    const systemPrefersDark = media && media.matches;

    const nextTheme: Theme | "system" = stored ?? "system";
    setTheme(nextTheme);

    const effectiveTheme: Theme =
      nextTheme === "system" ? (systemPrefersDark ? "dark" : "light") : nextTheme;

    const root = window.document.documentElement;
    if (effectiveTheme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }

    const shouldFollowSystem = !stored || stored === "system";
    if (media && typeof media.addEventListener === "function" && shouldFollowSystem) {
      const listener = (event: MediaQueryListEvent) => {
        const explicit = window.localStorage.getItem("theme");
        if (explicit === "light" || explicit === "dark") return;
        const isDark = event.matches;
        if (isDark) {
          root.classList.add("dark");
        } else {
          root.classList.remove("dark");
        }
      };
      media.addEventListener("change", listener);
      return () => {
        media.removeEventListener("change", listener);
      };
    }
  }, []);

  const toggleTheme = () => {
    if (typeof window === "undefined") return;

    const root = window.document.documentElement;
    const systemPrefersDark =
      window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches;

    let nextTheme: Theme | "system";
    if (theme === "dark") {
      nextTheme = "light";
    } else if (theme === "light") {
      nextTheme = "dark";
    } else {
      // system -> flip based on system and persist explicit choice
      nextTheme = systemPrefersDark ? "light" : "dark";
    }

    setTheme(nextTheme);
    window.localStorage.setItem("theme", nextTheme);

    const effectiveTheme: Theme = nextTheme;
    if (effectiveTheme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  };

  if (!mounted) {
    return (
      <Button
        variant="ghost"
        size="icon"
        className="h-9 w-9 min-h-[44px] min-w-[44px] touch-manipulation rounded-full transition-transform active:scale-95 md:h-8 md:w-8 md:min-h-0 md:min-w-0"
        aria-label="Toggle theme"
      >
        <Moon className="h-4 w-4" />
      </Button>
    );
  }

  const isDark =
    theme === "dark" ||
    (theme === "system" &&
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);

  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-9 w-9 min-h-[44px] min-w-[44px] touch-manipulation rounded-full transition-transform active:scale-95 md:min-h-0 md:min-w-0 md:h-8 md:w-8"
      onClick={toggleTheme}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
    >
      {isDark ? (
        <Sun className="h-4 w-4 text-amber-400" />
      ) : (
        <Moon className="h-4 w-4 text-slate-700" />
      )}
    </Button>
  );
}

