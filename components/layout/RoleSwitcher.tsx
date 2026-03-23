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
import { notifyActiveRoleChanged } from "@/lib/active-role-events";
import type { ProfileRole, SessionWithProfile } from "@/lib/types";
import { Brush, ChevronDown, Home } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Cleaner icon: lucide-react in this project has no `Broom`; `Brush` is used as the
 * standard “cleaning / broom” metaphor in the UI.
 */

type ToastState = { message: string; visible: boolean };

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
  variant?: "default" | "compact";
  className?: string;
};

export function RoleSwitcher({
  session,
  variant = "default",
  className,
}: RoleSwitcherProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();
  const [toast, setToast] = useState<ToastState>({ message: "", visible: false });

  const roles = session.roles;
  const activeRole = session.activeRole;

  const hasLister = roles.includes("lister");
  const hasCleaner = roles.includes("cleaner");

  const handleSwitch = (role: ProfileRole) => {
    startTransition(async () => {
      const result = await setActiveRole(role);
      if (!result.ok) return;
      notifyActiveRoleChanged();
      const label = role === "cleaner" ? "Cleaner" : "Lister";
      setToast({ message: `Switched to ${label}`, visible: true });
      const target = role === "lister" ? "/lister/dashboard" : "/cleaner/dashboard";
      if (pathname && isPathAllowedForRole(pathname, role)) {
        router.refresh();
      } else {
        router.replace(target);
        router.refresh();
      }
    });
  };

  useEffect(() => {
    if (!toast.visible) return;
    const id = setTimeout(() => setToast((prev) => ({ ...prev, visible: false })), 2000);
    return () => clearTimeout(id);
  }, [toast.visible]);

  if (!hasLister && !hasCleaner) {
    return null;
  }

  const currentLabel = activeRole === "cleaner" ? "Cleaner" : "Lister";
  const isCompact = variant === "compact";

  const settingsRolesHref = "/profile?tab=roles#my-roles";

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="outline"
            disabled={isPending}
            className={cn(
              "inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border-border/80 bg-muted/50 px-3.5 font-semibold shadow-sm ring-1 ring-black/5 transition-colors hover:bg-muted/80 dark:border-gray-700 dark:bg-gray-900/60 dark:ring-white/10 dark:hover:bg-gray-800/80",
              isCompact
                ? "max-w-[11rem] px-3 text-sm"
                : "max-w-[13rem] text-base max-xl:max-w-[5.5rem] max-xl:gap-1 max-xl:px-2.5",
              className
            )}
            aria-label={`Current role: ${currentLabel}. Open role menu`}
            aria-haspopup="menu"
          >
            <span
              className={cn(
                "inline-flex min-w-0 flex-1 items-center gap-1.5 truncate",
                activeRole === "lister"
                  ? "text-sky-700 dark:text-sky-300"
                  : "text-emerald-700 dark:text-emerald-300"
              )}
            >
              {activeRole === "lister" ? (
                <Home className="h-4 w-4 shrink-0" aria-hidden />
              ) : (
                <Brush className="h-4 w-4 shrink-0" aria-hidden />
              )}
              <span
                className={cn(
                  "truncate",
                  !isCompact && "max-xl:sr-only"
                )}
              >
                {currentLabel}
              </span>
            </span>
            <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground opacity-90" aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className={cn(
            "w-[min(100vw-2rem,20rem)] rounded-xl border-border/80 p-1 shadow-lg",
            "bg-popover text-popover-foreground",
            "dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
          )}
        >
          <div className="px-2 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground dark:text-gray-400">
            Your roles
          </div>
          <DropdownMenuSeparator className="my-0 dark:bg-gray-800" />

          {/* Lister row */}
          {hasLister ? (
            <DropdownMenuItem
              onSelect={(e) => {
                e.preventDefault();
                if (activeRole !== "lister") handleSwitch("lister");
              }}
              disabled={activeRole === "lister"}
              className={cn(
                "cursor-pointer gap-3 rounded-lg py-3 pl-3 pr-2 data-[disabled]:opacity-100",
                "text-foreground hover:!scale-100",
                "hover:bg-sky-50 dark:hover:bg-sky-900/45",
                "focus:bg-sky-50 focus:text-foreground dark:focus:bg-sky-900/35 dark:focus:text-gray-100",
                "data-[highlighted]:bg-sky-50 data-[highlighted]:text-foreground",
                "dark:data-[highlighted]:bg-sky-900/40 dark:data-[highlighted]:text-gray-100",
                activeRole === "lister" && "bg-sky-50/90 dark:bg-sky-900/35"
              )}
            >
              <Home className="h-5 w-5 shrink-0 text-sky-600 dark:text-sky-400" aria-hidden />
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="font-semibold text-sky-900 dark:text-sky-50">Lister</span>
                <span className="text-xs text-muted-foreground dark:text-gray-400">
                  Post listings &amp; hire cleaners
                </span>
              </div>
              {activeRole === "lister" ? (
                <Badge className="shrink-0 border-sky-300 bg-sky-100 text-[11px] font-semibold text-sky-900 dark:border-sky-600 dark:bg-sky-900/70 dark:text-sky-50">
                  Current
                </Badge>
              ) : (
                <Badge
                  variant="outline"
                  className="shrink-0 border-sky-300/90 text-[11px] text-sky-800 dark:border-sky-600 dark:bg-sky-950/60 dark:text-sky-200"
                >
                  Tap to switch
                </Badge>
              )}
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem
              asChild
              className={cn(
                "cursor-pointer gap-3 rounded-lg py-3 text-foreground",
                "hover:bg-sky-50 dark:hover:bg-sky-900/45",
                "focus:bg-sky-50 dark:focus:bg-sky-900/35",
                "data-[highlighted]:bg-sky-50 dark:data-[highlighted]:bg-sky-900/40"
              )}
            >
              <Link href={settingsRolesHref} className="flex items-center gap-3">
                <Home className="h-5 w-5 shrink-0 text-sky-600 dark:text-sky-400" aria-hidden />
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="font-semibold text-sky-900 dark:text-sky-50">Add Lister role</span>
                  <span className="text-xs text-muted-foreground dark:text-gray-400">
                    Single login — add in Settings
                  </span>
                </div>
              </Link>
            </DropdownMenuItem>
          )}

          {/* Cleaner row (Brush ≈ broom in UI) */}
          {hasCleaner ? (
            <DropdownMenuItem
              onSelect={(e) => {
                e.preventDefault();
                if (activeRole !== "cleaner") handleSwitch("cleaner");
              }}
              disabled={activeRole === "cleaner"}
              className={cn(
                "cursor-pointer gap-3 rounded-lg py-3 pl-3 pr-2 data-[disabled]:opacity-100",
                "text-foreground hover:!scale-100",
                "hover:bg-emerald-50 dark:hover:bg-emerald-900/45",
                "focus:bg-emerald-50 focus:text-foreground dark:focus:bg-emerald-900/35 dark:focus:text-gray-100",
                "data-[highlighted]:bg-emerald-50 data-[highlighted]:text-foreground",
                "dark:data-[highlighted]:bg-emerald-900/40 dark:data-[highlighted]:text-gray-100",
                activeRole === "cleaner" && "bg-emerald-50/90 dark:bg-emerald-900/35"
              )}
            >
              <Brush className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="font-semibold text-emerald-900 dark:text-emerald-50">Cleaner</span>
                <span className="text-xs text-muted-foreground dark:text-gray-400">
                  Bid on jobs &amp; get paid
                </span>
              </div>
              {activeRole === "cleaner" ? (
                <Badge className="shrink-0 border-emerald-300 bg-emerald-100 text-[11px] font-semibold text-emerald-950 dark:border-emerald-600 dark:bg-emerald-900/70 dark:text-emerald-50">
                  Current
                </Badge>
              ) : (
                <Badge
                  variant="outline"
                  className="shrink-0 border-emerald-300/90 text-[11px] text-emerald-900 dark:border-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-200"
                >
                  Tap to switch
                </Badge>
              )}
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem
              asChild
              className={cn(
                "cursor-pointer gap-3 rounded-lg py-3 text-foreground",
                "hover:bg-emerald-50 dark:hover:bg-emerald-900/45",
                "focus:bg-emerald-50 dark:focus:bg-emerald-900/35",
                "data-[highlighted]:bg-emerald-50 dark:data-[highlighted]:bg-emerald-900/40"
              )}
            >
              <Link href={settingsRolesHref} className="flex items-center gap-3">
                <Brush className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="font-semibold text-emerald-900 dark:text-emerald-50">Add Cleaner role</span>
                  <span className="text-xs text-muted-foreground dark:text-gray-400">
                    ABN required — add in Settings
                  </span>
                </div>
              </Link>
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      {toast.visible && (
        <div className="pointer-events-none fixed bottom-24 left-1/2 z-[60] -translate-x-1/2 rounded-full bg-background/95 px-4 py-2 text-sm font-medium text-foreground shadow-lg ring-1 ring-border md:bottom-8 dark:bg-gray-950 dark:text-gray-100 dark:ring-gray-700">
          {toast.message}
        </div>
      )}
    </>
  );
}
