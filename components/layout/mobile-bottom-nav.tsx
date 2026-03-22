"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Briefcase, MessageSquare, User } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Home", icon: Home },
  { href: "/jobs", label: "Jobs", icon: Briefcase },
  { href: "/messages", label: "Messages", icon: MessageSquare },
  { href: "/profile", label: "Profile", icon: User },
] as const;

/** Routes where the bottom nav is shown (< 768px only). */
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
    (route) => pathname === route || pathname.startsWith(route + "/")
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

/**
 * Mobile-first bottom tab bar. Shown only below 768px (md:hidden).
 * Active tab: primary color + bottom border (underline). Labels always shown for clarity.
 */
export function MobileBottomNav() {
  const pathname = usePathname();
  const currentPath = pathname ?? "";

  if (!isBottomNavRoute(currentPath)) return null;

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 flex items-center justify-around border-t border-border bg-background/95 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur supports-[backdrop-filter]:bg-background/80 dark:border-gray-800 dark:bg-gray-950/95 md:hidden"
      aria-label="Bottom navigation"
    >
      {NAV_ITEMS.map((item) => {
        const active = isItemActive(currentPath, item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "relative flex min-w-[64px] flex-col items-center gap-0.5 rounded-lg px-3 py-2 text-[11px] font-medium transition active:scale-95",
              active
                ? "text-primary dark:text-primary"
                : "text-muted-foreground hover:text-foreground dark:hover:text-gray-200"
            )}
            aria-current={active ? "page" : undefined}
          >
            <Icon
              className="h-5 w-5 shrink-0"
              strokeWidth={active ? 2.5 : 2}
              aria-hidden
            />
            <span className="truncate max-w-[72px]">{item.label}</span>
            {/* Primary underline for active tab */}
            {active && (
              <span
                className="absolute bottom-0 left-1/2 h-0.5 w-6 -translate-x-1/2 rounded-full bg-primary dark:bg-primary"
                aria-hidden
              />
            )}
          </Link>
        );
      })}
    </nav>
  );
}
