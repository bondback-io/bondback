"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { House, Briefcase, MessageCircle, User, List, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";
import { useUnreadNewMessageCount } from "@/hooks/use-unread-new-message-count";
import { useUnreadNotificationCount } from "@/hooks/use-unread-notification-count";
import { clearMessagesUnreadForNav } from "@/lib/messages/clear-messages-unread-nav";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { ACTIVE_ROLE_CHANGED_EVENT } from "@/lib/active-role-events";
import { MOBILE_NAV_ROLE_STORAGE_KEY } from "@/lib/auth/mobile-nav-role-storage";

type Role = "lister" | "cleaner" | null;

const BOTTOM_NAV_ROUTES = [
  "/dashboard",
  "/lister/dashboard",
  "/cleaner/dashboard",
  "/jobs",
  "/find-jobs",
  "/messages",
  "/profile",
  "/my-listings",
  "/earnings",
  "/listings",
];

function isBottomNavRoute(pathname: string): boolean {
  if (!pathname) return false;
  const p = pathname.replace(/\/$/, "") || "/";
  /** Marketing home — included so logged-in users get tabs; gated by `userId` in render. */
  if (p === "/") return true;
  return BOTTOM_NAV_ROUTES.some(
    (route) => p === route || p.startsWith(`${route}/`)
  );
}

function isItemActive(pathname: string, href: string): boolean {
  if (href === "/dashboard") {
    return (
      pathname === "/" ||
      pathname === "/dashboard" ||
      pathname === "/lister/dashboard" ||
      pathname === "/cleaner/dashboard"
    );
  }
  return pathname === href || (href !== "/" && pathname.startsWith(href));
}

/**
 * While profile `active_role` is still loading, infer lister vs cleaner from URL so the
 * second tab doesn’t flash the wrong label on /lister/dashboard etc.
 */
function inferSecondaryTabFromPath(pathname: string): {
  href: string;
  label: "Listings" | "Earnings";
} | null {
  const p = pathname.replace(/\/$/, "") || "/";
  if (
    p.startsWith("/my-listings") ||
    p.startsWith("/lister/") ||
    p === "/listings/new" ||
    /\/listings\/[^/]+\/edit$/.test(p)
  ) {
    return { href: "/my-listings", label: "Listings" };
  }
  if (p.startsWith("/cleaner/") || p.startsWith("/earnings")) {
    return { href: "/earnings", label: "Earnings" };
  }
  return null;
}

/** Second tab: lister → Listings (/my-listings); cleaner → Earnings (/earnings). */
function isSecondaryTabActive(pathname: string, activeRole: Role): boolean {
  if (activeRole === "lister") {
    return pathname === "/my-listings" || pathname.startsWith("/my-listings/");
  }
  if (activeRole === "cleaner") {
    return pathname === "/earnings" || pathname.startsWith("/earnings/");
  }
  // Still loading active_role: align highlight with inferred routes
  if (pathname === "/my-listings" || pathname.startsWith("/my-listings/")) {
    return true;
  }
  if (pathname.startsWith("/cleaner/") || pathname.startsWith("/earnings")) {
    return pathname === "/earnings" || pathname.startsWith("/earnings/");
  }
  return pathname === "/earnings" || pathname.startsWith("/earnings/");
}

function MessagesTabLink({
  active,
  userId,
  activeRole,
}: {
  active: boolean;
  userId: string | null;
  activeRole: Role;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const unread = useUnreadNewMessageCount(userId, activeRole);
  const showBadge = unread > 0;

  return (
    <Link
      id="tour-bottom-messages"
      href="/messages"
      prefetch
      onPointerDown={() => router.prefetch("/messages")}
      className={cn(
        "relative flex min-h-[48px] min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-1.5 transition-colors active:scale-[0.98]",
        active
          ? "text-primary"
          : "text-muted-foreground hover:text-foreground dark:hover:text-gray-200"
      )}
      aria-current={active ? "page" : undefined}
      aria-label={
        showBadge
          ? `Messages, ${unread} unread`
          : "Messages"
      }
      onClick={async (e) => {
        if (!userId?.trim()) return;
        e.preventDefault();
        await clearMessagesUnreadForNav(queryClient, userId);
        router.push("/messages");
      }}
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
          <span className="absolute -right-1 -top-0.5 flex h-[1.125rem] min-w-[1.125rem] items-center justify-center rounded-full bg-primary px-0.5 text-[9px] font-bold leading-none text-primary-foreground shadow-sm ring-2 ring-chromeSurface dark:ring-gray-950">
                  {unread > 99 ? "99+" : unread}
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

export type MobileBottomNavProps = {
  /** From server session — avoids “Jobs” flash on /profile before client profile fetch. */
  initialActiveRole?: Role | null;
  /** Logged-in user id for Messages tab unread badge. */
  userId?: string | null;
};

/**
 * Fixed bottom tab bar (mobile &lt;768px): 4 large tabs, unread badge on Messages.
 */
function readStoredMobileNavRole(): Role {
  if (typeof window === "undefined") return null;
  try {
    const v = sessionStorage.getItem(MOBILE_NAV_ROLE_STORAGE_KEY);
    if (v === "lister" || v === "cleaner") return v;
  } catch {
    /* ignore */
  }
  return null;
}

export function MobileBottomNav({
  initialActiveRole = null,
  userId = null,
}: MobileBottomNavProps = {}) {
  const pathname = usePathname();
  const router = useRouter();
  const currentPath = pathname ?? "";
  const pathNorm = currentPath.replace(/\/$/, "") || "/";
  const onMarketingHome = pathNorm === "/";
  const bottomNavEligible = isBottomNavRoute(currentPath);
  /** Logged-in users only on `/`: guests keep full-width marketing home (no tab bar). */
  const showBottomNav =
    bottomNavEligible && (!onMarketingHome || Boolean(userId?.trim()));
  const [activeRole, setActiveRole] = useState<Role>(null);
  const [storedRoleFallback, setStoredRoleFallback] = useState<Role>(null);
  const roleFetchInFlightRef = useRef(false);

  useEffect(() => {
    setStoredRoleFallback(readStoredMobileNavRole());
  }, []);

  const refreshActiveRole = useCallback(async () => {
    if (roleFetchInFlightRef.current) return;
    roleFetchInFlightRef.current = true;
    const supabase = createBrowserSupabaseClient();
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setActiveRole(null);
        try {
          sessionStorage.removeItem(MOBILE_NAV_ROLE_STORAGE_KEY);
        } catch {
          /* ignore */
        }
        setStoredRoleFallback(null);
        return;
      }

      const { data: row } = await supabase
        .from("profiles")
        .select("active_role, roles")
        .eq("id", user.id)
        .maybeSingle();
      const pr = row as { active_role?: string | null; roles?: string[] | null } | null;
      const arRaw = pr?.active_role;
      const ar =
        typeof arRaw === "string"
          ? arRaw.trim().toLowerCase() === "lister"
            ? "lister"
            : arRaw.trim().toLowerCase() === "cleaner"
              ? "cleaner"
              : null
          : null;
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
      if (next !== null) {
        try {
          sessionStorage.setItem(MOBILE_NAV_ROLE_STORAGE_KEY, next);
        } catch {
          /* ignore */
        }
        setStoredRoleFallback(next);
      }
    } catch {
      // Ignore transient auth/network errors; next event/path change will retry.
    } finally {
      roleFetchInFlightRef.current = false;
    }
  }, []);

  useEffect(() => {
    refreshActiveRole();
  }, [pathname, refreshActiveRole]);

  const authRoleDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const supabase = createBrowserSupabaseClient();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") {
        return;
      }
      if (authRoleDebounceRef.current != null) {
        clearTimeout(authRoleDebounceRef.current);
      }
      authRoleDebounceRef.current = setTimeout(() => {
        authRoleDebounceRef.current = null;
        void refreshActiveRole();
      }, 280);
    });
    return () => {
      subscription.unsubscribe();
      if (authRoleDebounceRef.current != null) {
        clearTimeout(authRoleDebounceRef.current);
      }
    };
  }, [refreshActiveRole]);

  useEffect(() => {
    const onRoleEvent = () => refreshActiveRole();
    window.addEventListener(ACTIVE_ROLE_CHANGED_EVENT, onRoleEvent);
    return () => window.removeEventListener(ACTIVE_ROLE_CHANGED_EVENT, onRoleEvent);
  }, [refreshActiveRole]);

  /** Idle prefetch of common tab targets — cheap wins for tap navigation on slow networks. */
  useEffect(() => {
    if (!showBottomNav) return;
    const run = () => {
      router.prefetch("/find-jobs");
      router.prefetch("/messages");
      router.prefetch("/dashboard");
      router.prefetch("/profile");
      router.prefetch("/my-listings");
      router.prefetch("/listings/new");
      router.prefetch("/earnings");
    };
    const w = typeof window !== "undefined" ? window : undefined;
    if (!w) return;
    if (typeof w.requestIdleCallback === "function") {
      const idleId = w.requestIdleCallback(run, { timeout: 2500 });
      return () => w.cancelIdleCallback(idleId);
    }
    const tid = window.setTimeout(run, 2000);
    return () => clearTimeout(tid);
  }, [showBottomNav, router]);

  const effectiveRole =
    activeRole ?? storedRoleFallback ?? initialActiveRole ?? null;
  const { data: notificationUnread = 0 } = useUnreadNotificationCount(
    userId,
    effectiveRole,
    { enabled: showBottomNav }
  );

  if (!showBottomNav) return null;
  const inferred = inferSecondaryTabFromPath(currentPath);
  const secondaryTabHref =
    effectiveRole === "lister"
      ? "/my-listings"
      : effectiveRole === "cleaner"
        ? "/earnings"
        : (inferred?.href ??
            (storedRoleFallback === "lister"
              ? "/my-listings"
              : storedRoleFallback === "cleaner"
                ? "/earnings"
                : "/find-jobs"));
  const secondaryTabLabel =
    effectiveRole === "lister"
      ? "Listings"
      : effectiveRole === "cleaner"
        ? "Earnings"
        : (inferred?.label ??
            (storedRoleFallback === "lister"
              ? "Listings"
              : storedRoleFallback === "cleaner"
                ? "Earnings"
                : "Browse"));
  const SecondaryTabIcon =
    effectiveRole === "lister" || inferred?.label === "Listings"
      ? List
      : effectiveRole === "cleaner" || inferred?.label === "Earnings"
        ? Wallet
        : Briefcase;

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 md:hidden"
      aria-label="Primary navigation"
    >
      <div
        className={cn(
          "border-t border-chromeBorder/90 bg-chromeSurface/95 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 shadow-[0_-8px_30px_-12px_rgba(15,23,42,0.08)] backdrop-blur-xl",
          "dark:border-gray-800 dark:bg-gray-950/95 dark:shadow-[0_-8px_30px_-12px_rgba(0,0,0,0.45)]"
        )}
      >
        <div className="mx-auto flex max-w-lg items-end justify-between gap-0.5 px-1">
          <Link
            href="/dashboard"
            prefetch
            onPointerDown={() => router.prefetch("/dashboard")}
            className={cn(
              "flex min-h-[48px] min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-1.5 transition-colors active:scale-[0.98]",
              isItemActive(currentPath, "/dashboard")
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground dark:hover:text-gray-200"
            )}
            aria-current={isItemActive(currentPath, "/dashboard") ? "page" : undefined}
            aria-label={
              notificationUnread > 0
                ? `Dashboard, ${notificationUnread > 9 ? "9+" : notificationUnread} notifications`
                : "Dashboard"
            }
          >
            <span className="relative inline-flex">
              <House
                className={cn(
                  "h-7 w-7 shrink-0",
                  isItemActive(currentPath, "/dashboard") ? "stroke-[2.5]" : "stroke-[2]"
                )}
                aria-hidden
              />
              {notificationUnread > 0 && (
                <span className="absolute -right-1 -top-0.5 flex h-[1.125rem] min-w-[1.125rem] items-center justify-center rounded-full bg-destructive px-0.5 text-[9px] font-bold leading-none text-destructive-foreground shadow-sm ring-2 ring-chromeSurface dark:ring-gray-950">
                  {notificationUnread > 9 ? "9+" : notificationUnread}
                </span>
              )}
            </span>
            <span className="max-w-full truncate text-[10px] font-semibold leading-tight">
              Dashboard
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
            id={effectiveRole === "lister" ? "tour-bottom-listings" : undefined}
            href={secondaryTabHref}
            prefetch
            onPointerDown={() => router.prefetch(secondaryTabHref)}
            className={cn(
              "flex min-h-[48px] min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-1.5 transition-colors active:scale-[0.98]",
              isSecondaryTabActive(currentPath, effectiveRole)
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground dark:hover:text-gray-200"
            )}
            aria-current={isSecondaryTabActive(currentPath, effectiveRole) ? "page" : undefined}
            aria-label={
              effectiveRole === "cleaner"
                ? "Earnings"
                : effectiveRole === "lister"
                  ? "Listings"
                  : "Second tab"
            }
          >
            <SecondaryTabIcon
              className={cn(
                "h-7 w-7 shrink-0",
                isSecondaryTabActive(currentPath, effectiveRole) ? "stroke-[2.5]" : "stroke-[2]"
              )}
              aria-hidden
            />
            <span className="max-w-full truncate text-[10px] font-semibold leading-tight">
              {secondaryTabLabel}
            </span>
            <span
              className={cn(
                "h-0.5 w-7 rounded-full",
                isSecondaryTabActive(currentPath, effectiveRole) ? "bg-primary" : "bg-transparent"
              )}
              aria-hidden
            />
          </Link>

          <MessagesTabLink
            active={isItemActive(currentPath, "/messages")}
            userId={userId}
            activeRole={effectiveRole}
          />

          <Link
            href="/profile"
            prefetch
            onPointerDown={() => router.prefetch("/profile")}
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
              Account
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
