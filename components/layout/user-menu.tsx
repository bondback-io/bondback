"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import {
  ChevronDown,
  User,
  Briefcase,
  DollarSign,
  HelpCircle,
  LogOut,
  List,
  ShieldAlert,
  MessageSquare,
  Moon,
  Sun,
  Search,
} from "lucide-react";
import { useThemeToggle } from "@/components/layout/theme-toggle";
import { useBodyScrollLock } from "@/lib/use-body-scroll-lock";
import { useSwipeToClose } from "@/lib/use-swipe-to-close";
import type { SessionWithProfile } from "@/lib/types";

export type UserMenuProps = {
  session: SessionWithProfile;
};

const MOBILE_BREAKPOINT = 768;

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

function UserMenuThemeToggleSheetRow({ persistToServer }: { persistToServer: boolean }) {
  const { mounted, isDark, toggleTheme } = useThemeToggle(persistToServer);
  const label = isDark ? "Light mode" : "Dark mode";
  const ariaLabel = isDark ? "Switch to light mode" : "Switch to dark mode";
  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={[MOBILE_ROW_CLASS, "text-foreground hover:bg-muted dark:hover:bg-gray-800 dark:text-gray-100"].join(" ")}
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

function jobsActivityHref(isLister: boolean, hasCleanerRole: boolean) {
  if (isLister) return "/my-listings";
  if (hasCleanerRole) return CLEANER_JOBS_DASHBOARD_HREF;
  return "/dashboard";
}

export function UserMenu({ session }: UserMenuProps) {
  const router = useRouter();
  const isMobile = useIsMobile();
  const [mobileSheetOpen, setMobileSheetOpen] = React.useState(false);
  useBodyScrollLock(isMobile && mobileSheetOpen);
  const swipeHandlers = useSwipeToClose(() => setMobileSheetOpen(false), "down");

  const displayName =
    session.profile?.full_name?.trim() ||
    session.user.email ||
    "User";

  const avatarUrl = session.profile?.profile_photo_url ?? null;
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

  const { toast } = useToast();
  const [logoutDialogOpen, setLogoutDialogOpen] = React.useState(false);
  const [isLoggingOut, setIsLoggingOut] = React.useState(false);

  const handleLogout = async () => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    const supabase = createBrowserSupabaseClient();
    await supabase.auth.signOut();
    setIsLoggingOut(false);
    setLogoutDialogOpen(false);
    router.push("/login");
    router.refresh();
    toast({
      title: "You have been logged out",
      description: "See you next time.",
    });
  };

  const triggerButton = (
    <Button
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
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatarUrl}
            alt=""
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
        <Sheet open={mobileSheetOpen} onOpenChange={setMobileSheetOpen}>
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
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={avatarUrl}
                      alt=""
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
                {hasCleanerRole && !isLister && (
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
                    href={jobsActivityHref(isLister, hasCleanerRole)}
                    className={[MOBILE_ROW_CLASS, "text-foreground hover:bg-muted dark:hover:bg-gray-800 dark:text-gray-100"].join(" ")}
                    aria-label={isLister ? "My Listings" : "My Jobs"}
                  >
                    {isLister ? (
                      <List className="h-5 w-5 shrink-0" aria-hidden />
                    ) : (
                      <Briefcase className="h-5 w-5 shrink-0" aria-hidden />
                    )}
                    <span>{isLister ? "My Listings" : "My Jobs"}</span>
                  </Link>
                </SheetClose>
                {isCleaner && (
                  <SheetClose asChild>
                    <Link
                      href="/jobs"
                      className={[MOBILE_ROW_CLASS, "text-foreground hover:bg-muted dark:hover:bg-gray-800 dark:text-gray-100"].join(" ")}
                      aria-label="Browse jobs near me"
                    >
                      <Search className="h-5 w-5 shrink-0" aria-hidden />
                      <span>Browse Jobs Near Me</span>
                    </Link>
                  </SheetClose>
                )}
                <SheetClose asChild>
                  <Link
                    href="/messages"
                    className={[MOBILE_ROW_CLASS, "text-foreground hover:bg-muted dark:hover:bg-gray-800 dark:text-gray-100"].join(" ")}
                    aria-label="Messages"
                  >
                    <MessageSquare className="h-5 w-5 shrink-0" aria-hidden />
                    <span>Messages</span>
                  </Link>
                </SheetClose>
                <SheetClose asChild>
                  <Link
                    href="/help"
                    className={[MOBILE_ROW_CLASS, "text-foreground hover:bg-muted dark:hover:bg-gray-800 dark:text-gray-100"].join(" ")}
                    aria-label="Help and Support"
                  >
                    <HelpCircle className="h-5 w-5 shrink-0" aria-hidden />
                    <span>Help &amp; Support</span>
                  </Link>
                </SheetClose>

                <div
                  role="separator"
                  className="my-1 h-px w-full shrink-0 bg-border dark:bg-gray-800"
                  aria-hidden
                />
                <p className="mb-1 px-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground dark:text-gray-400">
                  Appearance
                </p>
                <UserMenuThemeToggleSheetRow persistToServer />

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
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          {triggerButton}
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="w-56 max-w-[calc(100vw-2rem)] rounded-xl border-border/80 py-1.5 shadow-lg dark:border-gray-800 dark:bg-gray-900"
          sideOffset={8}
        >
          <div className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground dark:text-gray-400">
            Account
          </div>
          <DropdownMenuItem asChild>
            <Link href="/profile" className="flex cursor-pointer items-center gap-2.5 rounded-lg py-2.5 focus:bg-muted dark:focus:bg-gray-800">
              <User className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span>My Account</span>
            </Link>
          </DropdownMenuItem>

          <DropdownMenuSeparator className="my-1" />

          <div className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground dark:text-gray-400">
            Jobs &amp; activity
          </div>
          <DropdownMenuItem asChild>
            <Link
              href={jobsActivityHref(isLister, hasCleanerRole)}
              className="flex cursor-pointer items-center gap-2.5 rounded-lg py-2.5 focus:bg-muted dark:focus:bg-gray-800"
            >
              {isLister ? (
                <List className="h-4 w-4 shrink-0 text-muted-foreground" />
              ) : (
                <Briefcase className="h-4 w-4 shrink-0 text-muted-foreground" />
              )}
              <span>{isLister ? "My Listings" : "My Jobs"}</span>
            </Link>
          </DropdownMenuItem>
          {isCleaner && (
            <DropdownMenuItem asChild>
              <Link
                href="/jobs"
                className="flex cursor-pointer items-center gap-2.5 rounded-lg py-2.5 focus:bg-muted dark:focus:bg-gray-800"
                aria-label="Browse jobs near me"
              >
                <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                <span>Browse Jobs Near Me</span>
              </Link>
            </DropdownMenuItem>
          )}
          <DropdownMenuItem asChild>
            <Link href="/messages" className="flex cursor-pointer items-center gap-2.5 rounded-lg py-2.5 focus:bg-muted dark:focus:bg-gray-800">
              <MessageSquare className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span>Messages</span>
            </Link>
          </DropdownMenuItem>
          {hasCleanerRole && !isLister && (
            <DropdownMenuItem asChild>
              <Link href="/earnings" className="flex cursor-pointer items-center gap-2.5 rounded-lg py-2.5 focus:bg-muted dark:focus:bg-gray-800">
                <DollarSign className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span>My Earnings</span>
              </Link>
            </DropdownMenuItem>
          )}

          <DropdownMenuSeparator className="my-1" />

          <div className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground dark:text-gray-400">
            Support
          </div>
          <DropdownMenuItem asChild>
            <Link href="/help" className="flex cursor-pointer items-center gap-2.5 rounded-lg py-2.5 focus:bg-muted dark:focus:bg-gray-800">
              <HelpCircle className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span>Help &amp; Support</span>
            </Link>
          </DropdownMenuItem>

          <DropdownMenuSeparator className="my-1" />
          <div className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground dark:text-gray-400">
            Appearance
          </div>
          <UserMenuThemeToggleDropdownItem persistToServer />

          {isAdmin && (
            <>
              <DropdownMenuSeparator className="my-1" />
              <DropdownMenuItem asChild>
                <Link
                  href="/admin/dashboard"
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
                </Link>
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
