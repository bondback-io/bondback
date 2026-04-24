"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { signOutAndReloadApp } from "@/lib/auth/client-logout";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetClose, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { effectiveProfilePhotoUrl } from "@/lib/profile-display-photo";
import { isGooglePublicAvatarUrl } from "@/lib/google-avatar-url";
import { OptimizedImage } from "@/components/ui/optimized-image";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ChevronDown,
  User,
  Briefcase,
  DollarSign,
  HelpCircle,
  LifeBuoy,
  Scale,
  LogOut,
  List,
  ShieldAlert,
  MessageSquare,
  Moon,
  Sun,
  Search,
  LayoutDashboard,
  Users,
  PlusCircle,
  CalendarDays,
  type LucideIcon,
} from "lucide-react";
import { ThemeToggleSheetRow, useThemeToggle } from "@/components/layout/theme-toggle";
import { useBodyScrollLock } from "@/lib/use-body-scroll-lock";
import { useSwipeToClose } from "@/lib/use-swipe-to-close";
import type { ProfileRole, SessionWithProfile } from "@/lib/types";
import { clearMessagesUnreadForNav } from "@/lib/messages/clear-messages-unread-nav";
import { BROWSE_JOBS_AVATAR_MENU_LABEL } from "@/lib/navigation/browse-jobs-labels";

export type UserMenuProps = {
  session: SessionWithProfile;
};

const MOBILE_BREAKPOINT = 768;

/** Light: soft sky-tint strip; dark: subtle gray bar — see `app/globals.css` chrome tokens */
const MENU_SECTION_HEADER =
  "mx-1.5 mb-1 rounded-md bg-menuSectionHeader px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-menuSectionHeaderFg dark:bg-gray-800/70 dark:text-gray-400";

function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState(false);

  React.useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  return isMobile;
}

const MOBILE_ROW_CLASS =
  "flex min-h-[44px] w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-medium transition-colors active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

const MOBILE_SUB_ROW_CLASS =
  "flex min-h-[40px] w-full items-center gap-3 rounded-lg px-3 py-2.5 pl-3 text-left text-sm font-medium transition-colors active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

const COLLAPSE_TRANSITION = "transition-[grid-template-rows] duration-300 ease-out";

function MobileCollapsibleGroup({
  id,
  label,
  icon: Icon,
  open,
  onToggle,
  headerHref,
  children,
}: {
  id: string;
  label: string;
  icon: LucideIcon;
  open: boolean;
  onToggle: () => void;
  /** When set, the label row navigates here; chevron still expands/collapses. */
  headerHref?: string;
  children: React.ReactNode;
}) {
  const chevron = (
    <ChevronDown
      className={cn(
        "h-5 w-5 shrink-0 text-muted-foreground transition-transform duration-300 ease-out dark:text-gray-400",
        open && "rotate-180"
      )}
      aria-hidden
    />
  );

  return (
    <div className="flex flex-col overflow-hidden rounded-xl">
      {headerHref ? (
        <div className="flex w-full min-w-0 items-stretch overflow-hidden rounded-xl text-foreground hover:bg-muted dark:text-gray-100 dark:hover:bg-gray-800">
          <SheetClose asChild>
            <Link
              href={headerHref}
              prefetch
              className={cn(
                MOBILE_ROW_CLASS,
                "w-auto min-w-0 flex-1 justify-start rounded-r-none rounded-l-xl border-r border-border/60 py-3 dark:border-gray-700"
              )}
              aria-label={label}
            >
              <Icon className="h-5 w-5 shrink-0" aria-hidden />
              <span className="truncate">{label}</span>
            </Link>
          </SheetClose>
          <button
            type="button"
            id={`${id}-trigger`}
            aria-expanded={open}
            aria-controls={`${id}-panel`}
            aria-label={`${open ? "Collapse" : "Expand"} ${label} submenu`}
            onClick={onToggle}
            className={cn(
              MOBILE_ROW_CLASS,
              "w-auto shrink-0 justify-center rounded-l-none rounded-r-xl px-3.5"
            )}
          >
            {chevron}
          </button>
        </div>
      ) : (
        <button
          type="button"
          id={`${id}-trigger`}
          aria-expanded={open}
          aria-controls={`${id}-panel`}
          onClick={onToggle}
          className={cn(
            MOBILE_ROW_CLASS,
            "justify-between text-foreground hover:bg-muted dark:text-gray-100 dark:hover:bg-gray-800"
          )}
        >
          <span className="flex min-w-0 items-center gap-3">
            <Icon className="h-5 w-5 shrink-0" aria-hidden />
            <span className="truncate">{label}</span>
          </span>
          {chevron}
        </button>
      )}
      <div
        id={`${id}-panel`}
        role="region"
        aria-labelledby={`${id}-trigger`}
        className={cn("grid min-h-0", COLLAPSE_TRANSITION, open ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="flex flex-col gap-0.5 border-l-2 border-border/70 py-0.5 pl-3 ml-4 dark:border-gray-700">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

function DesktopCollapsibleGroup({
  id,
  label,
  icon: Icon,
  open,
  onToggle,
  headerHref,
  children,
}: {
  id: string;
  label: string;
  icon: LucideIcon;
  open: boolean;
  onToggle: () => void;
  headerHref?: string;
  children: React.ReactNode;
}) {
  const chevron = (
    <ChevronDown
      className={cn(
        "h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-300 ease-out",
        open && "rotate-180"
      )}
      aria-hidden
    />
  );

  return (
    <div className="flex flex-col">
      {headerHref ? (
        <div className="flex w-full min-w-0 items-stretch overflow-hidden rounded-lg hover:bg-muted/80 dark:hover:bg-gray-800">
          <Link
            href={headerHref}
            prefetch
            className={cn(
              "flex min-w-0 flex-1 cursor-pointer select-none items-center gap-2.5 rounded-l-lg px-2.5 py-2.5 text-sm font-medium outline-none transition-colors duration-200",
              "focus-visible:bg-muted dark:focus-visible:bg-gray-800 dark:text-gray-100"
            )}
            aria-label={label}
          >
            <Icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            <span className="min-w-0 flex-1 truncate text-left">{label}</span>
          </Link>
          <button
            type="button"
            id={`${id}-trigger`}
            aria-expanded={open}
            aria-controls={`${id}-panel`}
            aria-label={`${open ? "Collapse" : "Expand"} ${label} submenu`}
            onPointerDown={(e) => e.preventDefault()}
            onClick={(e) => {
              e.preventDefault();
              onToggle();
            }}
            className={cn(
              "flex shrink-0 cursor-pointer select-none items-center justify-center rounded-r-lg px-2 py-2.5 outline-none transition-colors duration-200",
              "focus-visible:bg-muted dark:focus-visible:bg-gray-800"
            )}
          >
            {chevron}
          </button>
        </div>
      ) : (
        <button
          type="button"
          id={`${id}-trigger`}
          aria-expanded={open}
          aria-controls={`${id}-panel`}
          onPointerDown={(e) => e.preventDefault()}
          onClick={(e) => {
            e.preventDefault();
            onToggle();
          }}
          className={cn(
            "flex w-full cursor-pointer select-none items-center gap-2.5 rounded-lg px-2.5 py-2.5 text-sm font-medium outline-none transition-colors duration-200",
            "hover:bg-muted/80 focus-visible:bg-muted dark:hover:bg-gray-800 dark:focus-visible:bg-gray-800 dark:text-gray-100"
          )}
        >
          <Icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          <span className="min-w-0 flex-1 truncate text-left">{label}</span>
          {chevron}
        </button>
      )}
      <div
        id={`${id}-panel`}
        role="region"
        aria-labelledby={`${id}-trigger`}
        className={cn("grid min-h-0", COLLAPSE_TRANSITION, open ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="space-y-0.5 border-l border-border/80 py-1 pl-2 ml-4 dark:border-gray-700">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

function UserMenuThemeToggleDropdownItem({ persistToServer }: { persistToServer: boolean }) {
  const { mounted, isDark, toggleTheme } = useThemeToggle(persistToServer);
  const label = isDark ? "Light mode" : "Dark mode";
  const ariaLabel = isDark ? "Switch to light mode" : "Switch to dark mode";
  return (
    <DropdownMenuItem
      onSelect={() => {
        toggleTheme();
      }}
      className="flex cursor-pointer items-center gap-2.5 rounded-lg py-2.5 focus:bg-muted dark:focus:bg-gray-800"
      aria-label={ariaLabel}
    >
      {!mounted ? (
        <Moon className="h-4 w-4 shrink-0 text-muted-foreground opacity-50" aria-hidden />
      ) : isDark ? (
        <Sun className="h-4 w-4 shrink-0 text-amber-400" aria-hidden />
      ) : (
        <Moon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
      )}
      <span>{label}</span>
    </DropdownMenuItem>
  );
}

/** Cleaner "My Jobs" — opens dashboard scrolled to Active jobs (matches `#active-jobs` on page). */
const CLEANER_JOBS_DASHBOARD_HREF = "/cleaner/dashboard#active-jobs";

/** Lister home — overview, stats, quick links. */
const LISTER_DASHBOARD_HREF = "/lister/dashboard";

/** Browse verified cleaners directory. */
const BROWSE_CLEANERS_HREF = "/cleaners";

/**
 * "My Jobs" / "My Listings" — follow **active role** (same as `/dashboard` redirect and role switcher),
 * not `isLister` alone, so dual-role users land on the correct dashboard.
 */
function jobsActivityHref(roles: ProfileRole[], activeRole: ProfileRole | null) {
  const hasLister = roles.includes("lister");
  const hasCleaner = roles.includes("cleaner");
  if (activeRole === "lister" && hasLister) return "/my-listings";
  if (activeRole === "cleaner" && hasCleaner) return CLEANER_JOBS_DASHBOARD_HREF;
  if (hasCleaner) return CLEANER_JOBS_DASHBOARD_HREF;
  if (hasLister) return "/my-listings";
  return "/dashboard";
}

export function UserMenu({ session }: UserMenuProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const [mobileSheetOpen, setMobileSheetOpen] = React.useState(false);
  const [mobileDashboardOpen, setMobileDashboardOpen] = React.useState(false);
  const [mobileHelpOpen, setMobileHelpOpen] = React.useState(false);
  const [desktopDashboardOpen, setDesktopDashboardOpen] = React.useState(false);
  const [desktopHelpOpen, setDesktopHelpOpen] = React.useState(false);
  useBodyScrollLock(isMobile && mobileSheetOpen);
  const swipeHandlers = useSwipeToClose(() => setMobileSheetOpen(false), "down");

  const displayName =
    session.profile?.full_name?.trim() ||
    session.user.email ||
    "User";

  const avatarUrl = session.profile
    ? effectiveProfilePhotoUrl({
        profile_photo_url: session.profile.profile_photo_url,
        avatar_url: session.profile.avatar_url,
      })
    : null;
  const initials =
    displayName && displayName.length > 0
      ? displayName
          .split(" ")
          .map((part) => part[0])
          .join("")
          .slice(0, 2)
          .toUpperCase()
      : "BB";

  const hasCleanerRole =
    Array.isArray(session.roles) && session.roles.includes("cleaner");
  const isCleaner =
    hasCleanerRole && session.activeRole === "cleaner";
  const isLister =
    Array.isArray(session.roles) &&
    session.roles.includes("lister") &&
    session.activeRole === "lister";
  /** Only show Admin link for users with profiles.is_admin = true */
  const isAdmin = session.isAdmin === true;

  const [logoutDialogOpen, setLogoutDialogOpen] = React.useState(false);
  const [isLoggingOut, setIsLoggingOut] = React.useState(false);

  const handleLogout = async () => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    setLogoutDialogOpen(false);
    await signOutAndReloadApp({ queryClient, redirectTo: "/login" });
  };

  /** Prefetch likely next navigations when the account menu opens (desktop + mobile). */
  const prefetchAccountRoutes = React.useCallback(() => {
    const activity = jobsActivityHref(session.roles, session.activeRole);
    const routes = [
      "/profile",
      "/messages",
      "/help",
      "/support",
      "/disputes",
      "/my-listings",
      "/find-jobs",
      "/earnings",
      "/calendar",
      "/listings/new",
      LISTER_DASHBOARD_HREF,
      CLEANER_JOBS_DASHBOARD_HREF,
      BROWSE_CLEANERS_HREF,
      activity,
    ];
    for (const href of routes) {
      router.prefetch(href);
    }
  }, [router, session.roles, session.activeRole]);

  const triggerButton = (
    <Button
      id="tour-user-menu"
      variant="ghost"
      className={cn(
        "gap-2 rounded-full pl-1 pr-2 transition-colors active:scale-[0.98]",
        "hover:bg-muted/70 dark:hover:bg-gray-800/80",
        isMobile && "min-h-11 min-w-11"
      )}
      aria-label={isMobile ? "Open account menu" : "Account menu"}
      aria-expanded={isMobile ? mobileSheetOpen : undefined}
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-xs font-semibold text-foreground ring-1 ring-border/50 dark:bg-gray-700 dark:text-gray-100 dark:ring-gray-600">
        {avatarUrl ? (
          <OptimizedImage
            src={avatarUrl}
            alt=""
            width={32}
            height={32}
            sizes="32px"
            quality={75}
            referrerPolicy={isGooglePublicAvatarUrl(avatarUrl) ? "no-referrer" : undefined}
            className="h-8 w-8 rounded-full object-cover"
          />
        ) : (
          initials
        )}
      </span>
      <span className="hidden items-center gap-2 font-medium text-foreground lg:inline dark:text-gray-100">
        <span className="max-w-[100px] truncate text-sm">{displayName}</span>
        {isCleaner && (
          <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200">
            Cleaner
          </span>
        )}
        {isLister && !isCleaner && (
          <span className="shrink-0 rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-semibold text-sky-800 dark:bg-sky-900/50 dark:text-sky-200">
            Lister
          </span>
        )}
      </span>
      <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground dark:text-gray-400" />
    </Button>
  );

  const logoutDialog = (
    <Dialog
      open={logoutDialogOpen}
      onOpenChange={(open) => {
        if (!isLoggingOut) setLogoutDialogOpen(open);
      }}
    >
      <DialogContent className="max-w-sm dark:bg-gray-900 dark:border-gray-800">
        <DialogHeader>
          <DialogTitle className="dark:text-gray-100">Log Out?</DialogTitle>
          <DialogDescription className="text-xs sm:text-sm dark:text-gray-300">
            You will be signed out of Bond Back. Any unsaved changes will be lost.
            <br />
            <span className="mt-1 block text-[11px] text-amber-700 dark:text-amber-300">
              Make sure all jobs are complete and funds released before logging out.
            </span>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="mt-2 flex gap-2 sm:gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => setLogoutDialogOpen(false)}
            disabled={isLoggingOut}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleLogout}
            disabled={isLoggingOut}
          >
            {isLoggingOut ? "Logging out…" : "Log Out"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  // Mobile: bottom sheet
  if (isMobile) {
    return (
      <>
        <Sheet
          open={mobileSheetOpen}
          onOpenChange={(open) => {
            setMobileSheetOpen(open);
            if (!open) {
              setMobileDashboardOpen(false);
              setMobileHelpOpen(false);
            }
            if (open) prefetchAccountRoutes();
          }}
        >
          <SheetTrigger asChild>{triggerButton}</SheetTrigger>
          <SheetContent
            side="bottom"
            className={cn(
              "max-h-[85vh] rounded-t-2xl border-t border-border/80 bg-background shadow-lg dark:bg-gray-900 dark:border-gray-800",
              "data-[state=open]:slide-in-from-bottom data-[state=closed]:slide-out-to-bottom duration-200"
            )}
            aria-describedby={undefined}
          >
            <div
              className="flex shrink-0 touch-none justify-center py-2.5"
              {...swipeHandlers}
              role="presentation"
            >
              <span className="h-1 w-12 rounded-full bg-muted/80 dark:bg-gray-700" aria-hidden />
            </div>
            <div className="flex flex-col gap-3 px-2 pb-8">
              {/* User header */}
              <div className="flex items-center gap-3 px-1 pt-2">
                <Avatar className="h-14 w-14 shrink-0 overflow-hidden rounded-full border-2 border-border dark:border-gray-700">
                  {avatarUrl ? (
                    <OptimizedImage
                      src={avatarUrl}
                      alt=""
                      width={56}
                      height={56}
                      sizes="56px"
                      quality={75}
                      referrerPolicy={isGooglePublicAvatarUrl(avatarUrl) ? "no-referrer" : undefined}
                      className="h-full w-full rounded-full object-cover"
                    />
                  ) : (
                    <AvatarFallback className="rounded-full bg-muted text-base font-semibold dark:bg-gray-700 dark:text-gray-100">
                      {initials}
                    </AvatarFallback>
                  )}
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-base font-semibold text-foreground dark:text-gray-100">
                    {displayName}
                  </p>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {isCleaner && (
                      <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200">
                        Cleaner
                      </Badge>
                    )}
                    {isLister && !isCleaner && (
                      <Badge className="bg-sky-100 text-sky-800 dark:bg-sky-900/50 dark:text-sky-200">
                        Lister
                      </Badge>
                    )}
                  </div>
                </div>
              </div>

              <div
                role="separator"
                className="h-px w-full shrink-0 bg-border dark:bg-gray-800"
                aria-hidden
              />

              {/* Menu list */}
              <nav
                className="flex flex-col gap-0.5"
                aria-label="Account menu"
              >
                <SheetClose asChild>
                  <Link
                    href="/profile"
                    className={[MOBILE_ROW_CLASS, "text-foreground hover:bg-muted dark:hover:bg-gray-800 dark:text-gray-100"].join(" ")}
                    aria-label="My Account"
                  >
                    <User className="h-5 w-5 shrink-0" aria-hidden />
                    <span>My Account</span>
                  </Link>
                </SheetClose>
                {isLister && (
                  <MobileCollapsibleGroup
                    id="mobile-dash"
                    label="Dashboard"
                    icon={LayoutDashboard}
                    open={mobileDashboardOpen}
                    headerHref="/dashboard"
                    onToggle={() => {
                      setMobileDashboardOpen((v) => !v);
                      setMobileHelpOpen(false);
                    }}
                  >
                    <SheetClose asChild>
                      <Link
                        href="/listings/new"
                        prefetch
                        className={[
                          MOBILE_SUB_ROW_CLASS,
                          "text-foreground hover:bg-muted dark:hover:bg-gray-800 dark:text-gray-100",
                        ].join(" ")}
                        aria-label="Create listing"
                      >
                        <PlusCircle className="h-4 w-4 shrink-0" aria-hidden />
                        <span>Create Listing</span>
                      </Link>
                    </SheetClose>
                    <SheetClose asChild>
                      <Link
                        href={jobsActivityHref(session.roles, session.activeRole)}
                        className={[
                          MOBILE_SUB_ROW_CLASS,
                          "text-foreground hover:bg-muted dark:hover:bg-gray-800 dark:text-gray-100",
                        ].join(" ")}
                        aria-label="My Listings"
                      >
                        <List className="h-4 w-4 shrink-0" aria-hidden />
                        <span>My Listings</span>
                      </Link>
                    </SheetClose>
                  </MobileCollapsibleGroup>
                )}
                {!isLister && (
                  <SheetClose asChild>
                    <Link
                      href={jobsActivityHref(session.roles, session.activeRole)}
                      className={[MOBILE_ROW_CLASS, "text-foreground hover:bg-muted dark:hover:bg-gray-800 dark:text-gray-100"].join(" ")}
                      aria-label="My Jobs"
                    >
                      <Briefcase className="h-5 w-5 shrink-0" aria-hidden />
                      <span>My Jobs</span>
                    </Link>
                  </SheetClose>
                )}
                {isLister && (
                  <SheetClose asChild>
                    <Link
                      href={BROWSE_CLEANERS_HREF}
                      className={[MOBILE_ROW_CLASS, "text-foreground hover:bg-muted dark:hover:bg-gray-800 dark:text-gray-100"].join(" ")}
                      aria-label="Browse cleaners"
                    >
                      <Users className="h-5 w-5 shrink-0" aria-hidden />
                      <span>Browse Cleaners</span>
                    </Link>
                  </SheetClose>
                )}
                {isCleaner && (
                  <SheetClose asChild>
                    <Link
                      href="/find-jobs"
                      className={[MOBILE_ROW_CLASS, "text-foreground hover:bg-muted dark:hover:bg-gray-800 dark:text-gray-100"].join(" ")}
                      aria-label={BROWSE_JOBS_AVATAR_MENU_LABEL}
                    >
                      <Search className="h-5 w-5 shrink-0" aria-hidden />
                      <span>{BROWSE_JOBS_AVATAR_MENU_LABEL}</span>
                    </Link>
                  </SheetClose>
                )}
                {isCleaner && (
                  <SheetClose asChild>
                    <Link
                      href="/earnings"
                      className={[MOBILE_ROW_CLASS, "text-foreground hover:bg-muted dark:hover:bg-gray-800 dark:text-gray-100"].join(" ")}
                      aria-label="My Earnings"
                    >
                      <DollarSign className="h-5 w-5 shrink-0" aria-hidden />
                      <span>My Earnings</span>
                    </Link>
                  </SheetClose>
                )}
                <SheetClose asChild>
                  <Link
                    href="/calendar"
                    className={[MOBILE_ROW_CLASS, "text-foreground hover:bg-muted dark:hover:bg-gray-800 dark:text-gray-100"].join(" ")}
                    aria-label="My calendar"
                  >
                    <CalendarDays className="h-5 w-5 shrink-0" aria-hidden />
                    <span>Calendar</span>
                  </Link>
                </SheetClose>
                <SheetClose asChild>
                  <Link
                    href="/messages"
                    className={[MOBILE_ROW_CLASS, "text-foreground hover:bg-muted dark:hover:bg-gray-800 dark:text-gray-100"].join(" ")}
                    aria-label="Messages"
                    onClick={async (e) => {
                      e.preventDefault();
                      await clearMessagesUnreadForNav(queryClient, session.user.id);
                      setMobileSheetOpen(false);
                      router.push("/messages");
                    }}
                  >
                    <MessageSquare className="h-5 w-5 shrink-0" aria-hidden />
                    <span>Messages</span>
                  </Link>
                </SheetClose>
                <MobileCollapsibleGroup
                  id="mobile-help"
                  label="Help & Support"
                  icon={HelpCircle}
                  open={mobileHelpOpen}
                  headerHref="/help"
                  onToggle={() => {
                    setMobileHelpOpen((v) => !v);
                    setMobileDashboardOpen(false);
                  }}
                >
                  <SheetClose asChild>
                    <Link
                      href="/support"
                      className={[
                        MOBILE_SUB_ROW_CLASS,
                        "text-foreground hover:bg-muted dark:hover:bg-gray-800 dark:text-gray-100",
                      ].join(" ")}
                      aria-label="Support Tickets"
                    >
                      <LifeBuoy className="h-4 w-4 shrink-0" aria-hidden />
                      <span>Support Tickets</span>
                    </Link>
                  </SheetClose>
                  <SheetClose asChild>
                    <Link
                      href="/disputes"
                      className={[
                        MOBILE_SUB_ROW_CLASS,
                        "text-foreground hover:bg-muted dark:hover:bg-gray-800 dark:text-gray-100",
                      ].join(" ")}
                      aria-label="Dispute Resolution Center"
                    >
                      <Scale className="h-4 w-4 shrink-0" aria-hidden />
                      <span>Dispute Resolution</span>
                    </Link>
                  </SheetClose>
                </MobileCollapsibleGroup>

                <div
                  role="separator"
                  className="my-1 h-px w-full shrink-0 bg-border dark:bg-gray-800"
                  aria-hidden
                />
                <p className={MENU_SECTION_HEADER}>Appearance</p>
                <ThemeToggleSheetRow persistToServer />

                {isAdmin && (
                  <>
                    <div
                      role="separator"
                      className="my-1 h-px w-full shrink-0 bg-border dark:bg-gray-800"
                      aria-hidden
                    />
                    <SheetClose asChild>
                      <Link
                        href="/admin/dashboard"
                        className={[
                          MOBILE_ROW_CLASS,
                          "text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20",
                        ].join(" ")}
                        aria-label="Admin Dashboard"
                      >
                        <ShieldAlert className="h-5 w-5 shrink-0" aria-hidden />
                        <span className="flex items-center gap-1">
                          Admin
                          <Badge
                            variant="outline"
                            className="text-[9px] font-semibold uppercase tracking-wide"
                          >
                            Admin
                          </Badge>
                        </span>
                      </Link>
                    </SheetClose>
                  </>
                )}

                <div
                  role="separator"
                  className="my-1 h-px w-full shrink-0 bg-border dark:bg-gray-800"
                  aria-hidden
                />

                <button
                  type="button"
                  onClick={() => {
                    setMobileSheetOpen(false);
                    setLogoutDialogOpen(true);
                  }}
                  className={[MOBILE_ROW_CLASS, "w-full text-destructive hover:bg-destructive/10 dark:hover:bg-destructive/20 dark:text-red-400"].join(" ")}
                  aria-label="Log out"
                >
                  <LogOut className="h-5 w-5 shrink-0" aria-hidden />
                  <span>Log Out</span>
                </button>
              </nav>
            </div>
          </SheetContent>
        </Sheet>
        {logoutDialog}
      </>
    );
  }

  // Desktop: floating dropdown
  return (
    <>
      <DropdownMenu
        onOpenChange={(open) => {
          if (open) prefetchAccountRoutes();
          else {
            setDesktopDashboardOpen(false);
            setDesktopHelpOpen(false);
          }
        }}
      >
        <DropdownMenuTrigger asChild>
          {triggerButton}
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="w-56 max-w-[calc(100vw-2rem)] rounded-xl border-chromeBorder/90 py-1.5 shadow-lg dark:border-gray-800 dark:bg-gray-900"
          sideOffset={8}
        >
          <div className={MENU_SECTION_HEADER}>Account</div>
          <DropdownMenuItem
            onSelect={() => {
              router.push("/profile");
            }}
            className="flex cursor-pointer items-center gap-2.5 rounded-lg py-2.5 focus:bg-muted dark:focus:bg-gray-800"
          >
            <User className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span>My Account</span>
          </DropdownMenuItem>

          <DropdownMenuSeparator className="my-1" />

          <div className={MENU_SECTION_HEADER}>Jobs &amp; activity</div>
          {isLister && (
            <DesktopCollapsibleGroup
              id="desk-dash"
              label="Dashboard"
              icon={LayoutDashboard}
              open={desktopDashboardOpen}
              headerHref="/dashboard"
              onToggle={() => {
                setDesktopDashboardOpen((v) => !v);
                setDesktopHelpOpen(false);
              }}
            >
              <DropdownMenuItem
                onSelect={() => {
                  router.push("/listings/new");
                }}
                className="flex cursor-pointer items-center gap-2.5 rounded-lg py-2 pl-6 focus:bg-muted dark:focus:bg-gray-800"
                aria-label="Create listing"
              >
                <PlusCircle className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                <span>Create Listing</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => {
                  router.push(jobsActivityHref(session.roles, session.activeRole));
                }}
                className="flex cursor-pointer items-center gap-2.5 rounded-lg py-2 pl-6 focus:bg-muted dark:focus:bg-gray-800"
                aria-label="My Listings"
              >
                <List className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                <span>My Listings</span>
              </DropdownMenuItem>
            </DesktopCollapsibleGroup>
          )}
          {!isLister && (
            <DropdownMenuItem
              onSelect={() => {
                router.push(jobsActivityHref(session.roles, session.activeRole));
              }}
              className="flex cursor-pointer items-center gap-2.5 rounded-lg py-2.5 focus:bg-muted dark:focus:bg-gray-800"
            >
              <Briefcase className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span>My Jobs</span>
            </DropdownMenuItem>
          )}
          {isLister && (
            <DropdownMenuItem
              onSelect={() => {
                router.push(BROWSE_CLEANERS_HREF);
              }}
              className="flex cursor-pointer items-center gap-2.5 rounded-lg py-2.5 focus:bg-muted dark:focus:bg-gray-800"
              aria-label="Browse cleaners"
            >
              <Users className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              <span>Browse Cleaners</span>
            </DropdownMenuItem>
          )}
          {isCleaner && (
            <DropdownMenuItem
              onSelect={() => {
                router.push("/find-jobs");
              }}
              className="flex cursor-pointer items-center gap-2.5 rounded-lg py-2.5 focus:bg-muted dark:focus:bg-gray-800"
              aria-label={BROWSE_JOBS_AVATAR_MENU_LABEL}
            >
              <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              <span>{BROWSE_JOBS_AVATAR_MENU_LABEL}</span>
            </DropdownMenuItem>
          )}
          {isCleaner && (
            <DropdownMenuItem
              onSelect={() => {
                router.push("/earnings");
              }}
              className="flex cursor-pointer items-center gap-2.5 rounded-lg py-2.5 focus:bg-muted dark:focus:bg-gray-800"
            >
              <DollarSign className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span>My Earnings</span>
            </DropdownMenuItem>
          )}
          <DropdownMenuItem
            onSelect={() => {
              router.push("/calendar");
            }}
            className="flex cursor-pointer items-center gap-2.5 rounded-lg py-2.5 focus:bg-muted dark:focus:bg-gray-800"
            aria-label="My calendar"
          >
            <CalendarDays className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            <span>Calendar</span>
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => {
              void (async () => {
                await clearMessagesUnreadForNav(queryClient, session.user.id);
                router.push("/messages");
              })();
            }}
            className="flex cursor-pointer items-center gap-2.5 rounded-lg py-2.5 focus:bg-muted dark:focus:bg-gray-800"
          >
            <MessageSquare className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span>Messages</span>
          </DropdownMenuItem>

          <DropdownMenuSeparator className="my-1" />

          <div className={MENU_SECTION_HEADER}>Support</div>
          <DesktopCollapsibleGroup
            id="desk-help"
            label="Help & Support"
            icon={HelpCircle}
            open={desktopHelpOpen}
            headerHref="/help"
            onToggle={() => {
              setDesktopHelpOpen((v) => !v);
              setDesktopDashboardOpen(false);
            }}
          >
            <DropdownMenuItem
              onSelect={() => {
                router.push("/support");
              }}
              className="flex cursor-pointer items-center gap-2.5 rounded-lg py-2 pl-6 focus:bg-muted dark:focus:bg-gray-800"
            >
              <LifeBuoy className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span>Support Tickets</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => {
                router.push("/disputes");
              }}
              className="flex cursor-pointer items-center gap-2.5 rounded-lg py-2 pl-6 focus:bg-muted dark:focus:bg-gray-800"
            >
              <Scale className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span>Dispute Resolution</span>
            </DropdownMenuItem>
          </DesktopCollapsibleGroup>

          <DropdownMenuSeparator className="my-1" />
          <div className={MENU_SECTION_HEADER}>Appearance</div>
          <UserMenuThemeToggleDropdownItem persistToServer />

          {isAdmin && (
            <>
              <DropdownMenuSeparator className="my-1" />
              <DropdownMenuItem
                onSelect={() => {
                  router.push("/admin/dashboard");
                }}
                className="flex cursor-pointer items-center gap-2.5 rounded-lg py-2.5 text-red-600 focus:bg-red-50 focus:text-red-700 dark:text-red-400 dark:focus:bg-red-900/20 dark:focus:text-red-300"
              >
                <ShieldAlert className="h-4 w-4 shrink-0" />
                <span className="flex items-center gap-1">
                  Admin
                  <Badge
                    variant="outline"
                    className="text-[9px] font-semibold uppercase tracking-wide"
                  >
                    Admin
                  </Badge>
                </span>
              </DropdownMenuItem>
            </>
          )}
          <DropdownMenuSeparator className="my-1" />
          <DropdownMenuItem
            onSelect={(e) => {
              e.preventDefault();
              setLogoutDialogOpen(true);
            }}
            className="cursor-pointer rounded-lg py-2.5 text-destructive focus:bg-destructive/10 focus:text-destructive dark:focus:bg-destructive/20"
          >
            <LogOut className="h-4 w-4 shrink-0" />
            <span>Log out</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {logoutDialog}
    </>
  );
}
