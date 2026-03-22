"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { House, Briefcase, MessageCircle, User, List } from "lucide-react";
import { cn } from "@/lib/utils";
import { useChatPanel } from "@/components/chat/chat-panel-context";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

type Role = "lister" | "cleaner" | null;

const BOTTOM_NAV_ROUTES = [
  "/dashboard",
  "/lister/dashboard",
  "/cleaner/dashboard",
  "/jobs",
  "/messages",
  "/profile",
  "/my-listings",
  "/earnings",
  "/listings",
];

function isBottomNavRoute(pathname: string): boolean {
  if (!pathname) return false;
  return BOTTOM_NAV_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );
}

function isItemActive(pathname: string, href: string): boolean {
  if (href === "/dashboard") {
    return (
      pathname === "/dashboard" ||
      pathname === "/lister/dashboard" ||
      pathname === "/cleaner/dashboard"
    );
  }
  return pathname === href || (href !== "/" && pathname.startsWith(href));
}

/** Second tab: lister → Listings (/my-listings); cleaner → Jobs (/jobs). */
function isJobsTabActive(pathname: string, activeRole: Role): boolean {
  if (activeRole === "lister") {
    return pathname === "/my-listings" || pathname.startsWith("/my-listings/");
  }
  if (activeRole === "cleaner") {
    return pathname === "/jobs" || pathname.startsWith("/jobs/");
  }
  return pathname === "/jobs" || pathname.startsWith("/jobs/");
}

function MessagesTabLink({ active }: { active: boolean }) {
  const { unreadTotal } = useChatPanel();
  const showBadge = unreadTotal > 0;

  return (
    <Link
      href="/messages"
      className={cn(
        "relative flex min-h-[48px] min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-1.5 transition-colors active:scale-[0.98]",
        active
          ? "text-primary"
          : "text-muted-foreground hover:text-foreground dark:hover:text-gray-200"
      )}
      aria-current={active ? "page" : undefined}
    >
      <span className="relative inline-flex">
        <MessageCircle
          className={cn(
            "h-7 w-7 shrink-0",
            active ? "stroke-[2.5]" : "stroke-[2]"
          )}
          aria-hidden
        />
        {showBadge && (
          <span className="absolute -right-1.5 -top-1 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold leading-none text-destructive-foreground ring-2 ring-background dark:ring-gray-950">
            {unreadTotal > 9 ? "9+" : unreadTotal}
          </span>
        )}
      </span>
      <span className="max-w-full truncate text-[10px] font-semibold leading-tight">
        Messages
      </span>
      <span
        className={cn(
          "h-0.5 w-7 rounded-full",
          active ? "bg-primary" : "bg-transparent"
        )}
        aria-hidden
      />
    </Link>
  );
}

/**
 * Fixed bottom tab bar (mobile &lt;768px): 4 large tabs, unread badge on Messages.
 */
export function MobileBottomNav() {
  const pathname = usePathname();
  const currentPath = pathname ?? "";
  const [activeRole, setActiveRole] = useState<Role>(null);

  const refreshActiveRole = useCallback(async () => {
    const supabase = createBrowserSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setActiveRole(null);
      return;
    }
    const { data: row } = await supabase
      .from("profiles")
      .select("active_role, roles")
      .eq("id", user.id)
      .maybeSingle();
    const pr = row as { active_role?: string | null; roles?: string[] | null } | null;
    const ar = pr?.active_role;
    const raw = Array.isArray(pr?.roles) ? pr.roles : [];
    const roles: Role[] = [];
    for (const x of raw) {
      if (x === "lister" || x === "cleaner") roles.push(x);
    }
    let next: Role = null;
    if (roles.length === 0) {
      next = null;
    } else if (ar === "lister" || ar === "cleaner") {
      next = ar;
    } else {
      next = roles[0]!;
    }
    setActiveRole(next);
  }, []);

  useEffect(() => {
    refreshActiveRole();
  }, [pathname, refreshActiveRole]);

  useEffect(() => {
    const supabase = createBrowserSupabaseClient();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      refreshActiveRole();
    });
    return () => subscription.unsubscribe();
  }, [refreshActiveRole]);

  if (!isBottomNavRoute(currentPath)) return null;

  const jobsTabHref =
    activeRole === "lister"
      ? "/my-listings"
      : activeRole === "cleaner"
        ? "/jobs"
        : "/jobs";
  const jobsTabLabel =
    activeRole === "lister"
      ? "Listings"
      : activeRole === "cleaner"
        ? "Jobs"
        : "Jobs";
  const JobsIcon = activeRole === "lister" ? List : Briefcase;

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 md:hidden"
      aria-label="Primary navigation"
    >
      <div
        className={cn(
          "border-t border-border/80 bg-background/95 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 shadow-[0_-8px_30px_-12px_rgba(0,0,0,0.12)] backdrop-blur-xl",
          "dark:border-gray-800 dark:bg-gray-950/95 dark:shadow-[0_-8px_30px_-12px_rgba(0,0,0,0.45)]"
        )}
      >
        <div className="mx-auto flex max-w-lg items-end justify-between gap-0.5 px-1">
          <Link
            href="/dashboard"
            className={cn(
              "flex min-h-[48px] min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-1.5 transition-colors active:scale-[0.98]",
              isItemActive(currentPath, "/dashboard")
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground dark:hover:text-gray-200"
            )}
            aria-current={isItemActive(currentPath, "/dashboard") ? "page" : undefined}
          >
            <House
              className={cn(
                "h-7 w-7 shrink-0",
                isItemActive(currentPath, "/dashboard") ? "stroke-[2.5]" : "stroke-[2]"
              )}
              aria-hidden
            />
            <span className="max-w-full truncate text-[10px] font-semibold leading-tight">
              Home
            </span>
            <span
              className={cn(
                "h-0.5 w-7 rounded-full",
                isItemActive(currentPath, "/dashboard") ? "bg-primary" : "bg-transparent"
              )}
              aria-hidden
            />
          </Link>

          <Link
            href={jobsTabHref}
            className={cn(
              "flex min-h-[48px] min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-1.5 transition-colors active:scale-[0.98]",
              isJobsTabActive(currentPath, activeRole)
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground dark:hover:text-gray-200"
            )}
            aria-current={isJobsTabActive(currentPath, activeRole) ? "page" : undefined}
            aria-label={
              activeRole === "cleaner"
                ? "Jobs — browse and manage jobs"
                : activeRole === "lister"
                  ? "Listings"
                  : "Jobs"
            }
          >
            <JobsIcon
              className={cn(
                "h-7 w-7 shrink-0",
                isJobsTabActive(currentPath, activeRole) ? "stroke-[2.5]" : "stroke-[2]"
              )}
              aria-hidden
            />
            <span className="max-w-full truncate text-[10px] font-semibold leading-tight">
              {jobsTabLabel}
            </span>
            <span
              className={cn(
                "h-0.5 w-7 rounded-full",
                isJobsTabActive(currentPath, activeRole) ? "bg-primary" : "bg-transparent"
              )}
              aria-hidden
            />
          </Link>

          <MessagesTabLink
            active={isItemActive(currentPath, "/messages")}
          />

          <Link
            href="/profile"
            className={cn(
              "flex min-h-[48px] min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-1.5 transition-colors active:scale-[0.98]",
              isItemActive(currentPath, "/profile")
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground dark:hover:text-gray-200"
            )}
            aria-current={isItemActive(currentPath, "/profile") ? "page" : undefined}
          >
            <User
              className={cn(
                "h-7 w-7 shrink-0",
                isItemActive(currentPath, "/profile") ? "stroke-[2.5]" : "stroke-[2]"
              )}
              aria-hidden
            />
            <span className="max-w-full truncate text-[10px] font-semibold leading-tight">
              Profile
            </span>
            <span
              className={cn(
                "h-0.5 w-7 rounded-full",
                isItemActive(currentPath, "/profile") ? "bg-primary" : "bg-transparent"
              )}
              aria-hidden
            />
          </Link>
        </div>
      </div>
    </nav>
  );
}
