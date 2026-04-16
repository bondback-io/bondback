"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Activity,
  ArrowLeft,
  Bell,
  Briefcase,
  CreditCard,
  FileText,
  Globe,
  Search,
  BadgeCheck,
  LayoutDashboard,
  List,
  Mail,
  Menu,
  Scale,
  Shield,
  Star,
  UserCog,
  LifeBuoy,
  Database,
  Bug,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";

type AdminShellProps = {
  /** The href of the nav item that should be highlighted as active, e.g. "/admin/users". */
  activeHref: string;
  children: ReactNode;
};

export type AdminNavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
};

/** Grouped nav — mobile drawer + desktop sidebar. */
export const ADMIN_NAV_GROUPS: {
  label: string;
  items: AdminNavItem[];
}[] = [
  {
    label: "Platform",
    items: [
      { label: "Overview", href: "/admin/dashboard", icon: LayoutDashboard },
      { label: "SEO", href: "/admin/seo", icon: Search },
      { label: "Users", href: "/admin/users", icon: UserCog },
      { label: "ABN checker", href: "/admin/abn-checker", icon: BadgeCheck },
      { label: "Listings", href: "/admin/listings", icon: List },
      { label: "Jobs", href: "/admin/jobs", icon: Briefcase },
    ],
  },
  {
    label: "Trust & money",
    items: [
      { label: "Disputes", href: "/admin/disputes", icon: Scale },
      { label: "Support", href: "/admin/support", icon: LifeBuoy },
      { label: "Reviews", href: "/admin/reviews", icon: Star },
      { label: "Payments", href: "/admin/payments", icon: CreditCard },
    ],
  },
  {
    label: "Comms",
    items: [
      { label: "Notifications & Emails", href: "/admin/notifications", icon: Bell },
      { label: "Email templates", href: "/admin/emails", icon: Mail },
    ],
  },
  {
    label: "System",
    items: [
      { label: "Global settings", href: "/admin/global-settings", icon: Globe },
      { label: "System errors", href: "/admin/system-errors", icon: Bug },
      { label: "Activity log", href: "/admin/activity", icon: Activity },
      { label: "Backups", href: "/admin/settings", icon: Database },
    ],
  },
];

/** Flat list (e.g. for tests or external tools). */
export const ADMIN_NAV_ITEMS: AdminNavItem[] = ADMIN_NAV_GROUPS.flatMap(
  (g) => g.items
);

function NavLinkRow({
  item,
  activeHref,
  onNavigate,
}: {
  item: AdminNavItem;
  activeHref: string;
  onNavigate?: () => void;
}) {
  const isActive = item.href === activeHref;
  const Icon = item.icon;

  return (
    <SheetClose asChild>
      <Link
        href={item.href}
        onClick={() => onNavigate?.()}
        className={cn(
          "flex min-h-[52px] items-center gap-3 rounded-xl px-4 text-base font-medium no-underline transition-colors hover:no-underline active:scale-[0.99] sm:min-h-12 sm:text-sm",
          isActive
            ? "bg-primary text-primary-foreground shadow-sm dark:bg-primary/90 dark:!text-primary-foreground"
            : "text-foreground hover:bg-muted hover:text-foreground dark:!text-gray-100 dark:hover:!bg-gray-800 dark:hover:!text-gray-100"
        )}
        aria-current={isActive ? "page" : undefined}
      >
        <Icon
          className={cn(
            "h-5 w-5 shrink-0",
            isActive ? "opacity-100" : "opacity-80"
          )}
          aria-hidden
        />
        <span className="min-w-0 flex-1 leading-snug">{item.label}</span>
        {isActive && (
          <span className="h-2 w-2 shrink-0 rounded-full bg-primary-foreground/90 dark:bg-primary-foreground" />
        )}
      </Link>
    </SheetClose>
  );
}

function SidebarLink({
  item,
  activeHref,
}: {
  item: AdminNavItem;
  activeHref: string;
}) {
  const isActive = item.href === activeHref;
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      className={cn(
        "flex min-h-11 items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-sm font-medium no-underline transition-colors hover:no-underline",
        isActive
          ? "bg-accent text-accent-foreground shadow-sm dark:!bg-gray-100 dark:!text-gray-900 dark:[&_svg]:!text-gray-900"
          : "text-muted-foreground hover:bg-muted hover:text-foreground dark:!text-gray-300 dark:hover:!bg-gray-800 dark:hover:!text-gray-100"
      )}
      aria-current={isActive ? "page" : undefined}
    >
      <span className="flex min-w-0 items-center gap-2.5">
        <Icon
          className={cn(
            "h-4 w-4 shrink-0",
            isActive ? "opacity-100" : "opacity-90"
          )}
          aria-hidden
        />
        <span className="truncate">{item.label}</span>
      </span>
      {isActive && (
        <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-500" />
      )}
    </Link>
  );
}

/**
 * Admin shell: mobile drawer + sticky sub-header; desktop sidebar.
 * Thumb-friendly targets (min ~48px rows), grouped nav.
 */
export function AdminShell({ activeHref, children }: AdminShellProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <section className="page-inner space-y-4 pb-10 md:space-y-6 md:pb-8">
      {/* Mobile: sticky sub-header + menu drawer */}
      <div
        className={cn(
          "sticky z-20 flex items-center justify-between gap-3 border-b border-border bg-background/95 py-2.5 backdrop-blur-md md:hidden",
          "top-[3.25rem] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]",
          "dark:border-gray-800 dark:bg-gray-950/95"
        )}
      >
        <Link
          href="/dashboard"
          className="inline-flex min-h-12 min-w-0 shrink items-center gap-2 rounded-xl px-2 py-2 text-lg font-semibold text-foreground active:bg-muted dark:text-gray-100 dark:active:bg-gray-800"
        >
          <ArrowLeft className="h-6 w-6 shrink-0" aria-hidden />
          <span className="truncate">App</span>
        </Link>

        <div className="flex min-w-0 flex-1 items-center justify-center gap-2">
          <Shield className="h-5 w-5 shrink-0 text-primary" aria-hidden />
          <span className="truncate text-lg font-bold tracking-tight text-foreground dark:text-gray-100">
            Admin
          </span>
        </div>

        <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
          <SheetTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-12 w-12 shrink-0 rounded-xl border-2 text-foreground dark:border-gray-700 dark:text-gray-100"
              aria-label="Open admin menu"
            >
              <Menu className="h-6 w-6" strokeWidth={2.25} />
            </Button>
          </SheetTrigger>
          <SheetContent
            side="left"
            title="Admin navigation"
            className="w-[min(100vw-1rem,20rem)] border-r-0 p-0 sm:max-w-sm"
          >
            <div className="flex flex-col gap-1 border-b border-border px-5 py-4 dark:border-gray-800">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground dark:text-gray-400">
                Navigation
              </p>
              <p className="text-sm text-muted-foreground dark:text-gray-500">
                Jump to any admin tool
              </p>
            </div>
            <nav
              className="flex flex-col gap-3 px-3 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
              aria-label="Admin sections"
            >
              {ADMIN_NAV_GROUPS.map((group) => (
                <div key={group.label} className="space-y-1.5">
                  <p className="px-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground dark:text-gray-500">
                    {group.label}
                  </p>
                  <div className="flex flex-col gap-1">
                    {group.items.map((item) => (
                      <NavLinkRow
                        key={item.href}
                        item={item}
                        activeHref={activeHref}
                        onNavigate={() => setMenuOpen(false)}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </nav>
          </SheetContent>
        </Sheet>
      </div>

      <div className="grid min-w-0 gap-6 md:grid-cols-[minmax(0,260px),1fr] lg:grid-cols-[minmax(0,280px),1fr] lg:gap-8">
        {/* Desktop sidebar */}
        <aside className="hidden h-full rounded-xl border border-border bg-card/90 p-4 shadow-sm md:block dark:border-gray-800 dark:bg-gray-900/90">
          <div className="mb-4 space-y-1">
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" aria-hidden />
              <p className="text-sm font-bold text-foreground dark:text-gray-100">
                Admin
              </p>
            </div>
            <p className="text-xs text-muted-foreground dark:text-gray-500">
              Platform overview &amp; tools
            </p>
          </div>
          <nav className="space-y-4" aria-label="Admin">
            {ADMIN_NAV_GROUPS.map((group) => (
              <div key={group.label} className="space-y-1.5">
                <p className="px-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground dark:text-gray-500">
                  {group.label}
                </p>
                <div className="space-y-0.5">
                  {group.items.map((item) => (
                    <SidebarLink
                      key={item.href}
                      item={item}
                      activeHref={activeHref}
                    />
                  ))}
                </div>
              </div>
            ))}
          </nav>
        </aside>

        {/* Main content */}
        <div className="min-w-0 space-y-4 md:space-y-6">{children}</div>
      </div>
    </section>
  );
}
