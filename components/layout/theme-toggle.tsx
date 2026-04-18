"use client";

import * as React from "react";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { applyThemeToDocument } from "@/lib/theme-client";
import { saveThemePreference } from "@/app/settings/actions";
import type { ThemePreference } from "@/lib/types";

export type ThemeToggleProps = {
  /** When true (logged-in), persist header toggles to profiles.theme_preference. */
  persistToServer?: boolean;
};

const THEME_SHEET_ROW =
  "flex min-h-[44px] w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-medium transition-colors active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

export function useThemeToggle(persistToServer = false) {
  const [theme, setTheme] = React.useState<ThemePreference>("system");
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);

    if (typeof window === "undefined") return;

    const raw = window.localStorage.getItem("theme");
    const srvAttr = document.documentElement.getAttribute("data-bb-theme") || "";
    const siteAttr = document.documentElement.getAttribute("data-bb-site-default-theme") || "";
    const siteDef: ThemePreference = siteAttr === "light" ? "light" : "dark";
    const nextTheme: ThemePreference =
      raw === "light" || raw === "dark" || raw === "system"
        ? raw
        : srvAttr === "light" || srvAttr === "dark" || srvAttr === "system"
          ? (srvAttr as ThemePreference)
          : siteDef;
    setTheme(nextTheme);
    applyThemeToDocument(nextTheme);

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const shouldFollowSystem = nextTheme === "system";
    if (media && typeof media.addEventListener === "function" && shouldFollowSystem) {
      const listener = (event: MediaQueryListEvent) => {
        const explicit = window.localStorage.getItem("theme");
        if (explicit === "light" || explicit === "dark") return;
        const root = window.document.documentElement;
        if (event.matches) root.classList.add("dark");
        else root.classList.remove("dark");
      };
      media.addEventListener("change", listener);
      return () => {
        media.removeEventListener("change", listener);
      };
    }
  }, []);

  const toggleTheme = React.useCallback(() => {
    if (typeof window === "undefined") return;

    const systemPrefersDark =
      window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;

    let nextTheme: ThemePreference;
    if (theme === "dark") {
      nextTheme = "light";
    } else if (theme === "light") {
      nextTheme = "dark";
    } else {
      nextTheme = systemPrefersDark ? "light" : "dark";
    }

    setTheme(nextTheme);
    applyThemeToDocument(nextTheme);
    if (persistToServer) {
      void saveThemePreference(nextTheme);
    }
  }, [persistToServer, theme]);

  const isDark =
    theme === "dark" ||
    (theme === "system" &&
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);

  return { theme, mounted, isDark, toggleTheme };
}

/**
 * Full-width sheet row (mobile menu) — matches other nav rows.
 */
export function ThemeToggleSheetRow({ persistToServer = false }: ThemeToggleProps) {
  const { mounted, isDark, toggleTheme } = useThemeToggle(persistToServer);
  const label = isDark ? "Light mode" : "Dark mode";
  const ariaLabel = isDark ? "Switch to light mode" : "Switch to dark mode";
  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={cn(
        THEME_SHEET_ROW,
        "text-foreground hover:bg-muted dark:hover:bg-gray-800 dark:text-gray-100"
      )}
      aria-label={ariaLabel}
    >
      {!mounted ? (
        <Moon className="h-5 w-5 shrink-0 opacity-50" aria-hidden />
      ) : isDark ? (
        <Sun className="h-5 w-5 shrink-0 text-amber-400" aria-hidden />
      ) : (
        <Moon className="h-5 w-5 shrink-0 text-slate-700 dark:text-gray-300" aria-hidden />
      )}
      <span>{label}</span>
    </button>
  );
}

export function ThemeToggle({ persistToServer = false }: ThemeToggleProps) {
  const { mounted, isDark, toggleTheme } = useThemeToggle(persistToServer);

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
        <Moon className="h-4 w-4 text-slate-700 dark:text-gray-300" />
      )}
    </Button>
  );
}
