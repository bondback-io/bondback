"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { House, Briefcase, MessageCircle, User } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Home", icon: House },
  { href: "/jobs", label: "Jobs", icon: Briefcase },
  { href: "/messages", label: "Messages", icon: MessageCircle },
  { href: "/profile", label: "Profile", icon: User },
] as const;

/** Routes where the bottom nav is shown (mobile &lt; 768px only). */
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

/**
 * Thumb-friendly bottom tab bar: icons only (24–28px), primary underline for active tab.
 * Fixed bottom, top shadow. Visible only below `md` (max-width 767px).
 */
export function MobileBottomNav() {
  const pathname = usePathname();
  const currentPath = pathname ?? "";

  if (!isBottomNavRoute(currentPath)) return null;

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
        <div className="mx-auto flex max-w-lg items-end justify-between px-2">
          {NAV_ITEMS.map((item) => {
            const active = isItemActive(currentPath, item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "relative flex min-h-12 min-w-[3rem] flex-1 flex-col items-center justify-end gap-1 pb-1 pt-2 transition-colors active:scale-[0.97]",
                  active
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground dark:hover:text-gray-200"
                )}
                aria-current={active ? "page" : undefined}
              >
                <span className="sr-only">{item.label}</span>
                <Icon
                  className={cn(
                    "h-7 w-7 shrink-0",
                    active ? "stroke-[2.5]" : "stroke-[2]"
                  )}
                  aria-hidden
                />
                {/* Primary underline */}
                <span
                  className={cn(
                    "h-0.5 w-8 rounded-full transition-colors",
                    active ? "bg-primary" : "bg-transparent"
                  )}
                  aria-hidden
                />
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
