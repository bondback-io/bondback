"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Menu, PlusCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetClose, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { useCreateListingPicker } from "@/components/listing/create-listing-picker-context";
import { useBodyScrollLock } from "@/lib/use-body-scroll-lock";
import { useSwipeToClose } from "@/lib/use-swipe-to-close";
import { FindJobsSheetLink } from "@/components/layout/find-jobs-nav-link";
import { ThemeToggleSheetRow } from "@/components/layout/theme-toggle";

export type MainNavProps = {
  className?: string;
  isLoggedIn: boolean;
  isLister: boolean;
  /**
   * Guest header: hamburger sits after Log in / Sign up. Omit `md:flex-1` so the cluster
   * doesn’t stretch and push the theme toggle.
   */
  trailingGuestTools?: boolean;
};

const MOBILE_ROW =
  "flex min-h-[44px] w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-medium transition-colors active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

/** Guest-only hamburger sheet — signed-in users use the avatar menu instead. */
function GuestMobileSheetContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const isHomePage = pathname === "/";

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex shrink-0 items-center justify-between rounded-xl border border-chromeBorder/70 bg-menuSectionHeader/80 px-3 py-3 dark:border-gray-800 dark:bg-gray-900/40">
        <SheetClose asChild>
          <Link
            href="/"
            onClick={onNavigate}
            className="rounded-lg font-semibold text-foreground dark:text-gray-100"
            aria-label="Bond Back home"
          >
            <span className="rounded-lg bg-primary px-2.5 py-1.5 text-sm font-semibold text-primary-foreground shadow-sm ring-1 ring-black/5 dark:text-white dark:ring-white/10">
              Bond<span className="font-normal text-primary-foreground/90 dark:text-white/90"> Back</span>
            </span>
          </Link>
        </SheetClose>
      </div>

      <nav className="space-y-0.5 pt-4" aria-label="Main navigation">
        <FindJobsSheetLink onNavigate={onNavigate} />
        <div
          className={cn(
            "flex flex-col gap-2 border-t border-chromeBorder/80 pt-4 dark:border-gray-800",
            isHomePage && "mt-0 border-t-0 pt-0"
          )}
        >
          <SheetClose asChild>
            <Link
              href="/login"
              className={cn(
                MOBILE_ROW,
                "justify-center rounded-full border border-border bg-muted/50 py-3 font-semibold text-foreground hover:bg-muted dark:border-border dark:bg-muted/30"
              )}
              onClick={onNavigate}
            >
              Log in
            </Link>
          </SheetClose>
          <SheetClose asChild>
            <Link
              href="/signup"
              className={cn(MOBILE_ROW, "justify-center rounded-full bg-primary py-3 font-semibold text-primary-foreground")}
              onClick={onNavigate}
            >
              Sign up
            </Link>
          </SheetClose>
          <div className="border-t border-chromeBorder/80 pt-3 dark:border-gray-800">
            <ThemeToggleSheetRow persistToServer={false} />
          </div>
        </div>
      </nav>
    </div>
  );
}

function DesktopNavLinks({
  isLoggedIn,
  isLister,
}: Pick<MainNavProps, "isLoggedIn" | "isLister">) {
  const router = useRouter();
  const { openCreateListingPicker } = useCreateListingPicker();

  return (
    <nav
      className="hidden min-w-0 flex-nowrap items-center gap-1 md:flex md:gap-1.5 lg:gap-2"
      aria-label="Main navigation"
    >
      {isLoggedIn && (
        <>
          {isLister && (
            <Button
              id="tour-create-listing-desktop"
              type="button"
              size="sm"
              className="ml-0 hidden shrink-0 gap-2 rounded-full bg-emerald-600 px-2.5 py-1.5 text-sm font-semibold text-white shadow-md shadow-emerald-900/20 hover:bg-emerald-700 hover:shadow-lg hover:shadow-emerald-900/25 md:px-3 md:py-2 lg:px-4 2xl:inline-flex dark:bg-emerald-600 dark:shadow-none dark:hover:bg-emerald-500 dark:hover:shadow-md dark:hover:shadow-emerald-950/50"
              title="Create listing"
              aria-label="Create listing"
              onClick={() => {
                router.prefetch("/listings/new");
                openCreateListingPicker();
              }}
            >
              <PlusCircle className="h-4 w-4 shrink-0" aria-hidden />
              <span>Create Listing</span>
            </Button>
          )}
        </>
      )}
    </nav>
  );
}

export function MainNav({
  className,
  isLoggedIn,
  isLister,
  trailingGuestTools = false,
}: MainNavProps) {
  const [open, setOpen] = React.useState(false);
  useBodyScrollLock(open);
  const swipeHandlers = useSwipeToClose(() => setOpen(false), "right");

  return (
    <div
      className={cn(
        "flex min-w-0 shrink-0 items-center justify-start gap-1 sm:gap-2 md:min-w-0 md:flex-nowrap",
        !trailingGuestTools && "md:shrink md:flex-1",
        className
      )}
    >
      <DesktopNavLinks isLoggedIn={isLoggedIn} isLister={isLister} />

      {!isLoggedIn && (
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button
              id="tour-mobile-main-menu"
              variant="ghost"
              size="icon"
              className="inline-flex min-h-[44px] min-w-[44px] touch-manipulation transition-transform active:scale-95 md:hidden"
              aria-label="Open menu"
              aria-expanded={open}
            >
              <Menu className="h-5 w-5 shrink-0" aria-hidden />
            </Button>
          </SheetTrigger>
          <SheetContent
            side="right"
            className={cn(
              "flex w-full flex-col border-l border-chromeBorder bg-chromeSurface shadow-xl dark:bg-gray-950 dark:border-gray-800",
              "w-[min(100vw-1.5rem,22rem)] sm:w-[min(100vw-2rem,24rem)]",
              "data-[state=open]:slide-in-from-right data-[state=closed]:slide-out-to-right",
              "duration-200 ease-out"
            )}
          >
            <div
              className="flex shrink-0 touch-none justify-center py-2.5"
              {...swipeHandlers}
              role="presentation"
            >
              <span className="h-1 w-12 rounded-full bg-muted/80 dark:bg-gray-700" aria-hidden />
            </div>
            <div className="flex flex-1 flex-col overflow-y-auto px-4 pb-8 pt-1">
              <GuestMobileSheetContent onNavigate={() => setOpen(false)} />
            </div>
          </SheetContent>
        </Sheet>
      )}

    </div>
  );
}
