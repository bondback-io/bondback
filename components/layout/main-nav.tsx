"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Menu,
  Home,
  Briefcase,
  LayoutDashboard,
  PlusCircle,
  User,
  DollarSign,
  Settings,
  HelpCircle,
  LogOut,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetClose, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { NotificationBell } from "@/components/layout/notification-bell";
import { useBodyScrollLock } from "@/lib/use-body-scroll-lock";
import { useSwipeToClose } from "@/lib/use-swipe-to-close";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import type { SessionWithProfile } from "@/lib/types";
import { MobileMenuSearch } from "@/components/features/mobile-menu-search";

export type MainNavProps = {
  isLoggedIn: boolean;
  isCleaner: boolean;
  isLister: boolean;
  /** When provided (logged in), mobile sheet shows full menu including profile section. */
  session?: SessionWithProfile | null;
  /** Optional unread message count for Messages badge. */
  unreadMessageCount?: number;
};

const desktopLinkBase =
  "inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-medium transition-all duration-150";

function DesktopNavLinks({ isLoggedIn, isCleaner, isLister }: Omit<MainNavProps, "session" | "unreadMessageCount">) {
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

  const dashboardHref = "/dashboard";

  return (
    <nav className="hidden items-center gap-1 md:flex md:gap-2" aria-label="Main navigation">
      {!isLoggedIn && (
        <Link href="/" className={linkClass("/")}>
          Home
        </Link>
      )}
      {isLoggedIn && (
        <>
          <Link href="/jobs" className={linkClass("/jobs")}>
            Find Jobs
          </Link>
          <Link
            href={dashboardHref}
            className={cn(
              desktopLinkBase,
              "font-semibold text-foreground dark:text-gray-100",
              "hover:bg-muted/80 hover:text-foreground dark:hover:bg-gray-800 dark:hover:text-gray-100",
              isActive(dashboardHref) &&
                "bg-emerald-500/15 text-emerald-700 ring-1 ring-emerald-500/30 dark:bg-emerald-500/20 dark:text-emerald-300 dark:ring-emerald-400/30"
            )}
          >
            <LayoutDashboard className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
            Dashboard
          </Link>
          {isLister && (
            <Button
              asChild
              size="sm"
              className="ml-0.5 rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-emerald-900/20 hover:bg-emerald-700 hover:shadow-lg hover:shadow-emerald-900/25 dark:bg-emerald-600 dark:shadow-none dark:hover:bg-emerald-500 dark:hover:shadow-md dark:hover:shadow-emerald-950/50"
            >
              <Link href="/listings/new" className="inline-flex items-center gap-1.5">
                <PlusCircle className="h-4 w-4 shrink-0" aria-hidden />
                Create Listing
              </Link>
            </Button>
          )}
        </>
      )}
    </nav>
  );
}

const MOBILE_ROW =
  "flex min-h-[44px] w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-medium transition-colors active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

function MobileNavContent({
  isLoggedIn,
  isCleaner,
  isLister,
  session,
  unreadMessageCount = 0,
  onNavigate,
}: MainNavProps & { onNavigate?: () => void }) {
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

      {/* Mobile search */}
      <div className="border-b border-border py-4 dark:border-gray-800">
        <MobileMenuSearch onNavigate={onNavigate} />
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
                  href="/login?role=lister"
                  className={cn(MOBILE_ROW, "justify-center rounded-full border border-sky-200 bg-sky-50 py-3 text-sky-700 dark:border-sky-800 dark:bg-sky-950/50 dark:text-sky-300")}
                  onClick={onNavigate}
                >
                  Log in as Lister
                </Link>
              </SheetClose>
              <SheetClose asChild>
                <Link
                  href="/login?role=cleaner"
                  className={cn(MOBILE_ROW, "justify-center rounded-full border border-emerald-200 bg-emerald-50 py-3 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300")}
                  onClick={onNavigate}
                >
                  Log in as Cleaner
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
        <SheetClose asChild>
          <Link href="/jobs" className={linkClass("/jobs")} onClick={onNavigate}>
            <Briefcase className="h-5 w-5 shrink-0" aria-hidden />
            <span>Find Jobs</span>
          </Link>
        </SheetClose>
        <SheetClose asChild>
          <Link
            href="/dashboard"
            className={cn(
              MOBILE_ROW,
              "bg-emerald-600 font-semibold text-white shadow-sm",
              "hover:bg-emerald-700 dark:bg-emerald-600 dark:text-white dark:hover:bg-emerald-500",
              isActive("/dashboard") && "ring-2 ring-emerald-400 ring-offset-2 dark:ring-emerald-500 dark:ring-offset-gray-950"
            )}
            onClick={onNavigate}
          >
            <LayoutDashboard className="h-5 w-5 shrink-0" aria-hidden />
            <span>Dashboard</span>
          </Link>
        </SheetClose>
        {isLister && (
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
        )}
        {session && (
          <div className="min-h-12 w-full">
            <NotificationBell userId={session.user.id} variant="row" />
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
                <span>My Profile</span>
              </Link>
            </SheetClose>
            {isCleaner && (
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
                href="/settings"
                className={cn(MOBILE_ROW, "text-foreground hover:bg-muted dark:hover:bg-gray-800 dark:text-gray-100")}
                onClick={onNavigate}
              >
                <Settings className="h-5 w-5 shrink-0" aria-hidden />
                <span>Settings</span>
              </Link>
            </SheetClose>
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

export function MainNav({ isLoggedIn, isCleaner, isLister, session, unreadMessageCount }: MainNavProps) {
  const [open, setOpen] = React.useState(false);
  useBodyScrollLock(open);
  const swipeHandlers = useSwipeToClose(() => setOpen(false), "right");

  return (
    <div className="flex min-w-0 flex-1 items-center justify-end gap-2 md:min-w-0 md:flex-1 md:justify-start md:gap-2">
      <DesktopNavLinks isLoggedIn={isLoggedIn} isCleaner={isCleaner} isLister={isLister} />

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
              isCleaner={isCleaner}
              isLister={isLister}
              session={session ?? null}
              unreadMessageCount={unreadMessageCount}
              onNavigate={() => setOpen(false)}
            />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
