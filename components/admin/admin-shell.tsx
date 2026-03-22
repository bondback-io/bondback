"use client";

import Link from "next/link";
import type { ReactNode } from "react";

type AdminShellProps = {
  /** The href of the nav item that should be highlighted as active, e.g. "/admin/users". */
  activeHref: string;
  children: ReactNode;
};

export const ADMIN_NAV_ITEMS = [
  { label: "Overview", href: "/admin/dashboard" },
  { label: "Users", href: "/admin/users" },
  { label: "Listings", href: "/admin/listings" },
  { label: "Jobs", href: "/admin/jobs" },
  { label: "Disputes", href: "/admin/disputes" },
  { label: "Support", href: "/admin/support" },
  { label: "Payments", href: "/admin/payments" },
  { label: "Notifications & Emails", href: "/admin/notifications" },
  { label: "Global settings", href: "/admin/global-settings" },
  { label: "Email templates", href: "/admin/emails" },
  { label: "Activity log", href: "/admin/activity" },
  { label: "Settings & Backups", href: "/admin/settings" },
] as const;

/**
 * Shared admin shell with sidebar (desktop) and horizontal nav (mobile).
 * Wrap all /admin/* pages with this to keep navigation consistent.
 */
export function AdminShell({ activeHref, children }: AdminShellProps) {
  return (
    <section className="page-inner space-y-4 md:space-y-6">
      {/* Mobile: horizontal scrollable nav pills */}
      <div className="flex items-center gap-2 md:hidden">
        <div className="flex flex-1 gap-1 overflow-x-auto rounded-md border border-border bg-card/80 p-1 text-xs shadow-sm dark:border-gray-800 dark:bg-gray-900/80">
          {ADMIN_NAV_ITEMS.map((item) => {
            const isActive = item.href === activeHref;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`whitespace-nowrap rounded-md px-2.5 py-1 font-medium transition-colors ${
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-gray-100"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-[220px,1fr] lg:grid-cols-[240px,1fr]">
        {/* Sidebar (desktop) */}
        <aside className="hidden h-full rounded-lg border border-border bg-card/80 p-3 text-sm shadow-sm md:block dark:border-gray-800 dark:bg-gray-900/80">
          <div className="mb-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground dark:text-gray-400">
              Admin
            </p>
            <p className="mt-1 text-xs text-muted-foreground dark:text-gray-500">
              Platform overview &amp; tools
            </p>
          </div>
          <nav className="space-y-1">
            {ADMIN_NAV_ITEMS.map((item) => {
              const isActive = item.href === activeHref;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center justify-between rounded-md px-2 py-1.5 text-xs transition-colors ${
                    isActive
                      ? "bg-accent text-accent-foreground dark:bg-gray-100 dark:text-gray-900"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-gray-100"
                  }`}
                >
                  <span>{item.label}</span>
                  {isActive && (
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  )}
                </Link>
              );
            })}
          </nav>
        </aside>

        {/* Main content */}
        <div className="space-y-4 md:space-y-6">{children}</div>
      </div>
    </section>
  );
}

