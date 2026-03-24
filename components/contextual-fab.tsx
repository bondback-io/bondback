"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { CreateListingConfirmDialog } from "@/components/listing/create-listing-confirm-dialog";

export type ProfileRole = "lister" | "cleaner";

const FAB_ROUTES_LISTER = ["/dashboard", "/lister/dashboard", "/my-listings"];

function isListerFabRoute(pathname: string): boolean {
  if (!pathname) return false;
  return FAB_ROUTES_LISTER.some(
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

export type ContextualFabProps = {
  activeRole: ProfileRole | null;
  className?: string;
};

/**
 * Airtasker-style round FAB (64×64px), mobile only, listers only.
 * Cleaners use main nav + bottom tab bar for Find Jobs — no floating shortcut.
 */
export function ContextualFab({ activeRole, className }: ContextualFabProps) {
  const pathname = usePathname();
  const hideForContext = useHideFabContext();
  const [createListingOpen, setCreateListingOpen] = useState(false);

  /**
   * FAB route = show this widget at all. `hideForContext` hides only the floating
   * button (keyboard / other dialogs) — it must NOT unmount the lister "create
   * listing" dialog, or opening that dialog sets hide=true and the old
   * `if (!show) return null` removed the whole tree including the Dialog → freeze.
   */
  const onFabRoute = activeRole === "lister" && isListerFabRoute(pathname ?? "");
  const showFabButton = onFabRoute && !hideForContext;

  if (activeRole !== "lister") return null;

  if (!onFabRoute) return null;

  const ariaLabel = "Create new listing";

  return (
    <>
      {showFabButton && (
        <div
          className={cn(
            "fixed z-50 md:hidden",
            "bottom-[calc(5.25rem+env(safe-area-inset-bottom,0px))] right-4 max-w-[calc(100vw-2rem)]",
            className
          )}
        >
          <button
            type="button"
            title={ariaLabel}
            aria-label={ariaLabel}
            onClick={() => setCreateListingOpen(true)}
            className={cn(
              "flex h-16 w-16 min-h-[4rem] min-w-[4rem] items-center justify-center rounded-full bg-emerald-600 text-white shadow-2xl ring-2 ring-emerald-400/50 transition hover:bg-emerald-500 active:scale-95 dark:bg-emerald-600 dark:hover:bg-emerald-500"
            )}
          >
            <Plus className="h-10 w-10 shrink-0" strokeWidth={2.75} aria-hidden />
          </button>
        </div>
      )}

      <CreateListingConfirmDialog open={createListingOpen} onOpenChange={setCreateListingOpen} />
    </>
  );
}
