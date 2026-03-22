"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Plus, Search } from "lucide-react";
import { cn } from "@/lib/utils";

export type ProfileRole = "lister" | "cleaner";

/** Routes where the FAB is shown (per role). */
const FAB_ROUTES_LISTER = [
  "/dashboard",
  "/lister/dashboard",
  "/my-listings",
];
const FAB_ROUTES_CLEANER = [
  "/dashboard",
  "/cleaner/dashboard",
  "/jobs",
];

function isFabRoute(pathname: string, role: ProfileRole | null): boolean {
  if (!pathname || !role) return false;
  const routes = role === "lister" ? FAB_ROUTES_LISTER : FAB_ROUTES_CLEANER;
  return routes.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );
}

/** Hide FAB when a full-screen modal or keyboard might be open. */
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

/** Subtle pulse when cleaner may have new work (dashboard / home; not on /jobs). */
function useCleanerJobsPulse(pathname: string | null, role: ProfileRole | null) {
  const [pulse, setPulse] = useState(false);
  useEffect(() => {
    if (role !== "cleaner" || !pathname) {
      setPulse(false);
      return;
    }
    const onJobs =
      pathname === "/jobs" || pathname.startsWith("/jobs/");
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
 * Role-aware FAB: bottom-right, round pill with label.
 * Lister: green primary. Cleaner: blue. Framer Motion pulse on cleaner main screens.
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
  const label = isLister ? "Create Listing" : "Find Nearby Jobs";
  const Icon = isLister ? Plus : Search;

  return (
    <motion.div
      className={cn(
        "fixed z-50 md:hidden",
        "bottom-[calc(5.25rem+env(safe-area-inset-bottom,0px))] right-4 max-w-[min(100vw-2rem,20rem)]",
        className
      )}
      initial={false}
      animate={
        !prefersReducedMotion && !isLister && pulseCleaner
          ? {
              scale: [1, 1.03, 1],
              boxShadow: [
                "0 10px 40px -10px rgba(37, 99, 235, 0.35)",
                "0 14px 44px -8px rgba(37, 99, 235, 0.55)",
                "0 10px 40px -10px rgba(37, 99, 235, 0.35)",
              ],
            }
          : {}
      }
      transition={{
        duration: 2.4,
        repeat: prefersReducedMotion || isLister || !pulseCleaner ? 0 : Infinity,
        ease: "easeInOut",
      }}
    >
      <Link
        href={href}
        className={cn(
          "flex min-h-14 items-center justify-center gap-2 rounded-full px-5 py-3.5 text-sm font-semibold text-white shadow-2xl transition active:scale-[0.98]",
          isLister
            ? "bg-emerald-600 ring-2 ring-emerald-400/35 hover:bg-emerald-500 dark:bg-emerald-600 dark:hover:bg-emerald-500"
            : "bg-blue-600 ring-2 ring-blue-400/35 hover:bg-blue-500 dark:bg-blue-600 dark:hover:bg-blue-500"
        )}
        aria-label={isLister ? "Create listing" : "Find nearby jobs"}
      >
        <Icon className="h-6 w-6 shrink-0" strokeWidth={2.5} aria-hidden />
        <span className="truncate">
          {isLister ? "+ Create Listing" : "Find Nearby Jobs"}
        </span>
      </Link>
    </motion.div>
  );
}
