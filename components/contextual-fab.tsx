"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";

export type ProfileRole = "lister" | "cleaner";

const FAB_ROUTES_LISTER = ["/dashboard", "/lister/dashboard", "/my-listings"];
const FAB_ROUTES_CLEANER = ["/dashboard", "/cleaner/dashboard", "/jobs"];

function isFabRoute(pathname: string, role: ProfileRole | null): boolean {
  if (!pathname || !role) return false;
  const routes = role === "lister" ? FAB_ROUTES_LISTER : FAB_ROUTES_CLEANER;
  return routes.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );
}

function useHideFabContext() {
  const [hide, setHide] = useState(false);

  useEffect(() => {
    const onResize = () => {
      const vv = window.visualViewport;
      const keyboardLikelyOpen = vv && vv.height < window.screen.height * 0.72;
      setHide(!!keyboardLikelyOpen);
    };
    const onDialogToggle = () => {
      const open = document.querySelector("[data-state=open][role=dialog]");
      setHide(!!open);
    };
    window.visualViewport?.addEventListener("resize", onResize);
    const observer = new MutationObserver(onDialogToggle);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["data-state"],
    });
    onResize();
    onDialogToggle();
    return () => {
      window.visualViewport?.removeEventListener("resize", onResize);
      observer.disconnect();
    };
  }, []);

  return hide;
}

/** Pulse when cleaner is on a “home” screen (not already browsing /jobs). */
function useCleanerJobsPulse(pathname: string | null, role: ProfileRole | null) {
  const [pulse, setPulse] = useState(false);
  useEffect(() => {
    if (role !== "cleaner" || !pathname) {
      setPulse(false);
      return;
    }
    const onJobs = pathname === "/jobs" || pathname.startsWith("/jobs/");
    const onMain =
      pathname === "/dashboard" ||
      pathname === "/cleaner/dashboard" ||
      pathname.startsWith("/cleaner/dashboard/");
    setPulse(onMain && !onJobs);
  }, [pathname, role]);
  return pulse;
}

export type ContextualFabProps = {
  activeRole: ProfileRole | null;
  className?: string;
};

/**
 * Airtasker-style round FAB (64×64px), mobile only.
 * Lister: green + Create Listing · Cleaner: blue + Find Nearby Jobs (labels via aria/title).
 */
export function ContextualFab({ activeRole, className }: ContextualFabProps) {
  const pathname = usePathname();
  const hideForContext = useHideFabContext();
  const prefersReducedMotion = useReducedMotion();
  const pulseCleaner = useCleanerJobsPulse(pathname ?? null, activeRole);

  const show =
    activeRole && isFabRoute(pathname ?? "", activeRole) && !hideForContext;

  if (!show) return null;

  const isLister = activeRole === "lister";
  const href = isLister ? "/listings/new" : "/jobs";
  const ariaLabel = isLister ? "+ Create Listing" : "+ Find Nearby Jobs";

  return (
    <motion.div
      className={cn(
        "fixed z-50 md:hidden",
        "bottom-[calc(5.25rem+env(safe-area-inset-bottom,0px))] right-4",
        className
      )}
      initial={false}
      animate={
        !prefersReducedMotion && !isLister && pulseCleaner
          ? {
              scale: [1, 1.06, 1],
              boxShadow: [
                "0 12px 40px -8px rgba(37, 99, 235, 0.45)",
                "0 16px 48px -6px rgba(37, 99, 235, 0.6)",
                "0 12px 40px -8px rgba(37, 99, 235, 0.45)",
              ],
            }
          : {}
      }
      transition={{
        duration: 2.4,
        repeat:
          prefersReducedMotion || isLister || !pulseCleaner ? 0 : Infinity,
        ease: "easeInOut",
      }}
    >
      <Link
        href={href}
        title={ariaLabel}
        className={cn(
          "flex h-16 w-16 min-h-[4rem] min-w-[4rem] items-center justify-center rounded-full text-white shadow-2xl ring-2 transition active:scale-95",
          isLister
            ? "bg-emerald-600 ring-emerald-400/50 hover:bg-emerald-500 dark:bg-emerald-600 dark:hover:bg-emerald-500"
            : "bg-blue-600 ring-blue-400/50 hover:bg-blue-500 dark:bg-blue-600 dark:hover:bg-blue-500"
        )}
        aria-label={ariaLabel}
      >
        <Plus className="h-10 w-10 shrink-0" strokeWidth={2.75} aria-hidden />
      </Link>
    </motion.div>
  );
}
