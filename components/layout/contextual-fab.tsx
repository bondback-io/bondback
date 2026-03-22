"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
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
    (route) => pathname === route || pathname.startsWith(route + "/")
  );
}

/** Hide FAB when a full-screen modal or keyboard might be open. */
function useHideFabContext() {
  const [hide, setHide] = useState(false);

  useEffect(() => {
    const onResize = () => {
      // Optional: hide when visual viewport is small (e.g. keyboard open on mobile)
      const vv = window.visualViewport;
      const keyboardLikelyOpen = vv && vv.height < window.screen.height * 0.75;
      setHide(!!keyboardLikelyOpen);
    };
    const onDialogToggle = () => {
      const open = document.querySelector("[data-state=open][role=dialog]");
      setHide(!!open);
    };
    window.visualViewport?.addEventListener("resize", onResize);
    const observer = new MutationObserver(onDialogToggle);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["data-state"] });
    onResize();
    onDialogToggle();
    return () => {
      window.visualViewport?.removeEventListener("resize", onResize);
      observer.disconnect();
    };
  }, []);

  return hide;
}

export type ContextualFabProps = {
  /** Current user active role from server (session). */
  activeRole: ProfileRole | null;
  className?: string;
};

/**
 * Role-aware floating action button. Shown only on mobile (< 768px) and on relevant screens.
 * Lister: "+ Create Listing" (primary). Cleaner: "Browse Jobs" (Search icon, emerald).
 */
export function ContextualFab({ activeRole, className }: ContextualFabProps) {
  const pathname = usePathname();
  const hideForContext = useHideFabContext();

  const show = activeRole && isFabRoute(pathname ?? "", activeRole) && !hideForContext;

  if (!show) return null;

  const isLister = activeRole === "lister";
  const href = isLister ? "/listings/new" : "/jobs";
  const label = isLister ? "Create Listing" : "Browse Jobs";
  const Icon = isLister ? Plus : Search;

  return (
    <Link
      href={href}
      className={cn(
        "fixed z-50 flex h-14 w-14 items-center justify-center rounded-full text-white shadow-lg transition active:scale-95 md:hidden",
        "bottom-[calc(5rem+env(safe-area-inset-bottom,0px))] right-4",
        isLister
          ? "bg-primary hover:bg-primary/90 dark:bg-primary dark:hover:bg-primary/90"
          : "bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-500",
        className
      )}
      aria-label={label}
    >
      <Icon className="h-6 w-6 shrink-0" strokeWidth={2.5} aria-hidden />
    </Link>
  );
}
