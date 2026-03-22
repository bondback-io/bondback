"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { setActiveRole } from "@/lib/actions/profile";
import type { ProfileRole, SessionWithProfile } from "@/lib/types";
import { Building2, Brush, ChevronDown, Home } from "lucide-react";
import { cn } from "@/lib/utils";

type ToastState = { message: string; visible: boolean };

/** True if this path is allowed for the given role; otherwise redirect to role dashboard. */
function isPathAllowedForRole(pathname: string, role: ProfileRole): boolean {
  const p = pathname.replace(/\/$/, "") || "/";
  if (role === "lister") {
    if (p.startsWith("/cleaner") || p.startsWith("/earnings")) return false;
    return true;
  }
  if (role === "cleaner") {
    if (
      p.startsWith("/my-listings") ||
      p.startsWith("/listings/new") ||
      (p.startsWith("/listings/") && p.includes("/edit")) ||
      p === "/lister" ||
      p.startsWith("/lister/")
    ) {
      return false;
    }
    return true;
  }
  return true;
}

export type RoleSwitcherProps = {
  session: SessionWithProfile;
  /** Tighter padding and max width for mobile header row */
  variant?: "default" | "compact";
  className?: string;
};

/**
 * Pill trigger: current role + chevron. Dropdown: Lister / Cleaner with icons and badges.
 * Updates `profiles.active_role` and refreshes or redirects to `/lister/dashboard` | `/cleaner/dashboard`.
 */
export function RoleSwitcher({
  session,
  variant = "default",
  className,
}: RoleSwitcherProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();
  const [toast, setToast] = useState<ToastState>({
    message: "",
    visible: false,
  });

  const roles = session.roles;
  const activeRole = session.activeRole;

  const canSwitchTo = (role: ProfileRole) =>
    roles.includes(role) && activeRole !== role;

  const handleSwitch = (role: ProfileRole) => {
    startTransition(async () => {
      const result = await setActiveRole(role);
      if (result.ok) {
        const label = role === "cleaner" ? "Cleaner" : "Lister";
        setToast({ message: `Switched to ${label} mode`, visible: true });
        const target =
          role === "lister" ? "/lister/dashboard" : "/cleaner/dashboard";
        if (pathname && isPathAllowedForRole(pathname, role)) {
          router.refresh();
        } else {
          router.replace(target);
          router.refresh();
        }
      }
    });
  };

  useEffect(() => {
    if (!toast.visible) return;
    const id = setTimeout(() => {
      setToast((prev) => ({ ...prev, visible: false }));
    }, 2000);
    return () => clearTimeout(id);
  }, [toast.visible]);

  if (!roles.includes("lister") && !roles.includes("cleaner")) {
    return null;
  }

  const showLister = canSwitchTo("lister");
  const showCleaner = canSwitchTo("cleaner");
  const hasLister = roles.includes("lister");
  const hasCleaner = roles.includes("cleaner");

  const currentLabel = activeRole === "cleaner" ? "Cleaner" : "Lister";
  const isCompact = variant === "compact";

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={isPending}
            className={cn(
              "inline-flex h-10 max-w-[11rem] items-center gap-1.5 rounded-full border-border/80 bg-muted/50 px-3 font-semibold shadow-sm ring-1 ring-black/5 transition-colors hover:bg-muted/80 dark:border-gray-700 dark:bg-gray-900/60 dark:ring-white/10 dark:hover:bg-gray-800/80",
              isCompact && "h-9 max-w-[10rem] px-2.5 text-xs",
              className
            )}
            aria-label={`Current role: ${currentLabel}. Open role menu`}
          >
            <span
              className={cn(
                "inline-flex min-w-0 flex-1 items-center gap-1 truncate",
                activeRole === "lister"
                  ? "text-sky-700 dark:text-sky-300"
                  : "text-emerald-700 dark:text-emerald-300"
              )}
            >
              {activeRole === "lister" ? (
                <Home className="h-3.5 w-3.5 shrink-0" aria-hidden />
              ) : (
                <Brush className="h-3.5 w-3.5 shrink-0" aria-hidden />
              )}
              <span className="truncate">{currentLabel}</span>
            </span>
            <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground opacity-80" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="center"
          className="w-64 rounded-xl border-border/80 p-1 shadow-lg dark:border-gray-800 dark:bg-gray-900"
        >
          <div className="px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Switch role
          </div>
          <DropdownMenuSeparator className="my-0" />
          {showLister && (
            <DropdownMenuItem
              onSelect={(e) => {
                e.preventDefault();
                handleSwitch("lister");
              }}
              className="cursor-pointer gap-2 rounded-lg py-2.5 focus:bg-sky-50 data-[highlighted]:bg-sky-50 dark:focus:bg-sky-900/25 dark:data-[highlighted]:bg-sky-900/25"
            >
              <Home className="h-4 w-4 shrink-0 text-sky-600 dark:text-sky-400" />
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="font-medium text-sky-900 dark:text-sky-100">
                  Lister
                </span>
                <span className="text-xs text-muted-foreground">
                  Post jobs &amp; manage listings
                </span>
              </div>
              <Badge className="shrink-0 border-sky-200 bg-sky-100 text-[10px] text-sky-800 dark:border-sky-800 dark:bg-sky-900/50 dark:text-sky-200">
                Lister
              </Badge>
            </DropdownMenuItem>
          )}
          {!hasLister && (
            <DropdownMenuItem asChild>
              <Link
                href="/onboarding?role=lister"
                className="flex cursor-pointer gap-2 rounded-lg py-2.5 focus:bg-sky-50 data-[highlighted]:bg-sky-50 dark:focus:bg-sky-900/25"
              >
                <Building2 className="h-4 w-4 shrink-0 text-sky-600" />
                <span className="text-sm text-sky-800 dark:text-sky-200">
                  Set up Lister profile
                </span>
              </Link>
            </DropdownMenuItem>
          )}
          {showCleaner && (
            <DropdownMenuItem
              onSelect={(e) => {
                e.preventDefault();
                handleSwitch("cleaner");
              }}
              className="cursor-pointer gap-2 rounded-lg py-2.5 focus:bg-emerald-50 data-[highlighted]:bg-emerald-50 dark:focus:bg-emerald-900/25 dark:data-[highlighted]:bg-emerald-900/25"
            >
              <Brush className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="font-medium text-emerald-900 dark:text-emerald-100">
                  Cleaner
                </span>
                <span className="text-xs text-muted-foreground">
                  Find jobs &amp; place bids
                </span>
              </div>
              <Badge className="shrink-0 border-emerald-200 bg-emerald-100 text-[10px] text-emerald-900 dark:border-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200">
                Cleaner
              </Badge>
            </DropdownMenuItem>
          )}
          {!hasCleaner && (
            <DropdownMenuItem asChild>
              <Link
                href="/onboarding?role=cleaner"
                className="flex cursor-pointer gap-2 rounded-lg py-2.5 focus:bg-emerald-50 data-[highlighted]:bg-emerald-50 dark:focus:bg-emerald-900/25"
              >
                <Brush className="h-4 w-4 shrink-0 text-emerald-600" />
                <span className="text-sm text-emerald-800 dark:text-emerald-200">
                  Set up Cleaner profile
                </span>
              </Link>
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      {toast.visible && (
        <div className="pointer-events-none fixed bottom-24 left-1/2 z-[60] -translate-x-1/2 rounded-full bg-background/95 px-4 py-2 text-xs font-medium shadow-lg ring-1 ring-border md:bottom-8 dark:bg-gray-900">
          {toast.message}
        </div>
      )}
    </>
  );
}
