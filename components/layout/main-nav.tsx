"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Menu,
  Home,
  Search,
  PlusCircle,
  User,
  DollarSign,
  HelpCircle,
  LogOut,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetClose, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { NotificationBell } from "@/components/layout/notification-bell";
import { CreateListingConfirmDialog } from "@/components/listing/create-listing-confirm-dialog";
import { useBodyScrollLock } from "@/lib/use-body-scroll-lock";
import { useSwipeToClose } from "@/lib/use-swipe-to-close";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import type { SessionWithProfile } from "@/lib/types";
export type MainNavProps = {
  isLoggedIn: boolean;
  /** User has cleaner on their profile — used for /earnings link (same gate as earnings page). */
  hasCleanerRole?: boolean;
  isCleaner: boolean;
  isLister: boolean;
  /** When provided (logged in), mobile sheet shows full menu including profile section. */
  session?: SessionWithProfile | null;
  /** Optional unread message count for Messages badge. */
  unreadMessageCount?: number;
};

const desktopLinkBase =
  "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1.5 text-sm font-medium transition-all duration-150 md:px-3 md:py-2 lg:px-3.5";

function DesktopNavLinks({
  isLoggedIn,
  isCleaner,
  isLister,
  onRequestCreateListing,
}: Omit<MainNavProps, "session" | "unreadMessageCount"> & {
  onRequestCreateListing?: () => void;
}) {
  const pathname = usePathname();

  const isActive = (href: string) =>
    pathname === href || (href !== "/" && pathname.startsWith(href));

  const linkClass = (href: string) =>
    cn(
      desktopLinkBase,
      "text-muted-foreground hover:text-foreground hover:bg-muted/70 dark:hover:bg-gray-800/80 dark:hover:text-gray-100",
      isActive(href) &&
        "bg-muted text-foreground dark:bg-gray-800 dark:text-gray-100 ring-1 ring-border/50 dark:ring-gray-700"
    );

  return (
    <nav
      className="hidden min-w-0 flex-nowrap items-center gap-1 md:flex md:gap-1.5 lg:gap-2"
      aria-label="Main navigation"
    >
      {!isLoggedIn && (
        <Link href="/" className={linkClass("/")}>
          Home
        </Link>
      )}
      {isLoggedIn && (
        <>
          {isCleaner && (
            <Link
              href="/jobs"
              className={linkClass("/jobs")}
              title="Find jobs"
              aria-label="Find jobs"
            >
              <Search className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
              <span>Find Jobs</span>
            </Link>
          )}
          {isLister &&
            (onRequestCreateListing ? (
              <Button
                type="button"
                size="sm"
                className="ml-0 shrink-0 rounded-full bg-emerald-600 px-2.5 py-1.5 text-sm font-semibold text-white shadow-md shadow-emerald-900/20 hover:bg-emerald-700 hover:shadow-lg hover:shadow-emerald-900/25 md:px-3 md:py-2 lg:px-4 dark:bg-emerald-600 dark:shadow-none dark:hover:bg-emerald-500 dark:hover:shadow-md dark:hover:shadow-emerald-950/50"
                title="Create listing"
                aria-label="Create listing"
                onClick={onRequestCreateListing}
              >
                <PlusCircle className="h-4 w-4 shrink-0" aria-hidden />
                <span className="max-2xl:sr-only">Create Listing</span>
              </Button>
            ) : (
              <Button
                asChild
                size="sm"
                className="ml-0 shrink-0 rounded-full bg-emerald-600 px-2.5 py-1.5 text-sm font-semibold text-white shadow-md shadow-emerald-900/20 hover:bg-emerald-700 hover:shadow-lg hover:shadow-emerald-900/25 md:px-3 md:py-2 lg:px-4 dark:bg-emerald-600 dark:shadow-none dark:hover:bg-emerald-500 dark:hover:shadow-md dark:hover:shadow-emerald-950/50"
              >
                <Link
                  href="/listings/new"
                  className="inline-flex items-center gap-1.5 whitespace-nowrap"
                  title="Create listing"
                  aria-label="Create listing"
                >
                  <PlusCircle className="h-4 w-4 shrink-0" aria-hidden />
                  <span className="max-2xl:sr-only">Create Listing</span>
                </Link>
              </Button>
            ))}
        </>
      )}
    </nav>
  );
}

const MOBILE_ROW =
  "flex min-h-[44px] w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-medium transition-colors active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

function MobileNavContent({
  isLoggedIn,
  hasCleanerRole = false,
  isCleaner,
  isLister,
  session,
  unreadMessageCount = 0,
  onNavigate,
  onRequestCreateListing,
}: MainNavProps & { onNavigate?: () => void; onRequestCreateListing?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const isActive = (href: string) =>
    pathname === href || (href !== "/" && pathname.startsWith(href));

  const linkClass = (href: string) =>
    cn(
      MOBILE_ROW,
      "text-foreground hover:bg-muted dark:hover:bg-gray-800 dark:text-gray-100",
      isActive(href) && "bg-muted dark:bg-gray-800"
    );

  const handleLogout = async () => {
    const supabase = createBrowserSupabaseClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  };

  return (
    <div className="flex flex-1 flex-col">
      {/* Logo at top */}
      <div className="flex shrink-0 items-center justify-between border-b border-border pb-4 dark:border-gray-800">
        <SheetClose asChild>
          <Link
            href="/"
            onClick={onNavigate}
            className="rounded-lg font-semibold text-foreground dark:text-gray-100"
            aria-label="Bond Back home"
          >
            <span className="rounded-lg bg-primary px-2.5 py-1.5 text-sm font-semibold text-primary-foreground shadow-sm ring-1 ring-black/5 dark:ring-white/10">
              Bond<span className="font-normal text-primary-foreground/90"> Back</span>
            </span>
          </Link>
        </SheetClose>
      </div>

      {/* Main links */}
      <nav className="space-y-0.5 pt-4" aria-label="Main navigation">
        {!isLoggedIn && (
          <>
            <SheetClose asChild>
              <Link href="/" className={linkClass("/")} onClick={onNavigate}>
                <Home className="h-5 w-5 shrink-0" aria-hidden />
                <span>Home</span>
              </Link>
            </SheetClose>
            <div className="mt-4 flex flex-col gap-2 border-t border-border pt-4 dark:border-gray-800">
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
            </div>
          </>
        )}
        {isLoggedIn && (
          <>
        {isCleaner && (
          <SheetClose asChild>
            <Link
              href="/jobs"
              className={linkClass("/jobs")}
              onClick={onNavigate}
              title="Find jobs"
              aria-label="Find jobs"
            >
              <Search className="h-5 w-5 shrink-0" aria-hidden />
              <span>Find Jobs</span>
            </Link>
          </SheetClose>
        )}
        {isLister &&
          (onRequestCreateListing ? (
            <button
              type="button"
              className={cn(
                MOBILE_ROW,
                "bg-emerald-600 text-white hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-500"
              )}
              onClick={() => {
                onNavigate?.();
                onRequestCreateListing();
              }}
            >
              <PlusCircle className="h-5 w-5 shrink-0" aria-hidden />
              <span>Create Listing</span>
            </button>
          ) : (
            <SheetClose asChild>
              <Link
                href="/listings/new"
                className={cn(
                  MOBILE_ROW,
                  "bg-emerald-600 text-white hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-500"
                )}
                onClick={onNavigate}
              >
                <PlusCircle className="h-5 w-5 shrink-0" aria-hidden />
                <span>Create Listing</span>
              </Link>
            </SheetClose>
          ))}
        {session && (
          <div className="min-h-12 w-full">
            <NotificationBell
              userId={session.user.id}
              activeRole={session?.activeRole ?? null}
              variant="row"
            />
          </div>
        )}
          </>
        )}
      </nav>

      {/* Profile section */}
      {session && (
        <>
          <div
            role="separator"
            className="my-5 h-px w-full shrink-0 bg-border dark:bg-gray-800"
            aria-hidden
          />
          <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground dark:text-gray-400">
            Account
          </p>
          <nav className="space-y-0.5" aria-label="Account">
            <SheetClose asChild>
              <Link
                href="/profile"
                className={cn(MOBILE_ROW, "text-foreground hover:bg-muted dark:hover:bg-gray-800 dark:text-gray-100")}
                onClick={onNavigate}
              >
                <User className="h-5 w-5 shrink-0" aria-hidden />
                <span>My Account</span>
              </Link>
            </SheetClose>
            {hasCleanerRole && (
              <SheetClose asChild>
                <Link
                  href="/earnings"
                  className={cn(MOBILE_ROW, "text-foreground hover:bg-muted dark:hover:bg-gray-800 dark:text-gray-100")}
                  onClick={onNavigate}
                >
                  <DollarSign className="h-5 w-5 shrink-0" aria-hidden />
                  <span>My Earnings</span>
                </Link>
              </SheetClose>
            )}
            <SheetClose asChild>
              <Link
                href="/help"
                className={cn(MOBILE_ROW, "text-foreground hover:bg-muted dark:hover:bg-gray-800 dark:text-gray-100")}
                onClick={onNavigate}
              >
                <HelpCircle className="h-5 w-5 shrink-0" aria-hidden />
                <span>Help</span>
              </Link>
            </SheetClose>
            <SheetClose asChild>
              <button
                type="button"
                onClick={() => {
                  handleLogout();
                }}
                className={cn(MOBILE_ROW, "w-full text-destructive hover:bg-destructive/10 dark:hover:bg-destructive/20 dark:text-red-400")}
              >
                <LogOut className="h-5 w-5 shrink-0" aria-hidden />
                <span>Log Out</span>
              </button>
            </SheetClose>
          </nav>
        </>
      )}
    </div>
  );
}

export function MainNav({
  isLoggedIn,
  hasCleanerRole = false,
  isCleaner,
  isLister,
  session,
  unreadMessageCount,
}: MainNavProps) {
  const [open, setOpen] = React.useState(false);
  const [createListingOpen, setCreateListingOpen] = React.useState(false);
  const openCreateListingDialog = React.useCallback(() => setCreateListingOpen(true), []);
  useBodyScrollLock(open);
  const swipeHandlers = useSwipeToClose(() => setOpen(false), "right");

  return (
    <div className="flex min-w-0 flex-1 items-center justify-end gap-2 md:min-w-0 md:flex-1 md:flex-nowrap md:justify-start md:gap-2">
      <DesktopNavLinks
        isLoggedIn={isLoggedIn}
        isCleaner={isCleaner}
        isLister={isLister}
        onRequestCreateListing={isLister ? openCreateListingDialog : undefined}
      />

      {/* Mobile: hamburger — 44px touch target, slide-in sheet from right */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button
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
            "flex w-full flex-col border-l border-border bg-background shadow-xl dark:bg-gray-950 dark:border-gray-800",
            "w-[min(100vw-1.5rem,22rem)] sm:w-[min(100vw-2rem,24rem)]",
            "data-[state=open]:slide-in-from-right data-[state=closed]:slide-out-to-right",
            "duration-200 ease-out"
          )}
        >
          {/* Swipe handle */}
          <div
            className="flex shrink-0 touch-none justify-center py-2.5"
            {...swipeHandlers}
            role="presentation"
          >
            <span className="h-1 w-12 rounded-full bg-muted/80 dark:bg-gray-700" aria-hidden />
          </div>
          <div className="flex flex-1 flex-col overflow-y-auto px-4 pb-8 pt-1">
            <MobileNavContent
              isLoggedIn={isLoggedIn}
              hasCleanerRole={hasCleanerRole}
              isCleaner={isCleaner}
              isLister={isLister}
              session={session ?? null}
              unreadMessageCount={unreadMessageCount}
              onNavigate={() => setOpen(false)}
              onRequestCreateListing={isLister ? openCreateListingDialog : undefined}
            />
          </div>
        </SheetContent>
      </Sheet>

      {isLister && (
        <CreateListingConfirmDialog open={createListingOpen} onOpenChange={setCreateListingOpen} />
      )}
    </div>
  );
}
