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
import { setActiveRole } from "@/lib/actions/profile";
import type { ProfileRole, SessionWithProfile } from "@/lib/types";
import { Building2, Home, Sparkles } from "lucide-react";

type ToastState = { message: string; visible: boolean };

/** True if this path is allowed for the given role; otherwise redirect to dashboard. */
function isPathAllowedForRole(pathname: string, role: ProfileRole): boolean {
  const p = pathname.replace(/\/$/, "") || "/";
  if (role === "lister") {
    if (p.startsWith("/cleaner") || p.startsWith("/earnings")) return false;
    return true;
  }
  if (role === "cleaner") {
    if (p.startsWith("/my-listings") || p.startsWith("/listings/new") || p.startsWith("/listings/") && p.includes("/edit") || p === "/lister" || p.startsWith("/lister/")) return false;
    return true;
  }
  return true;
}

export function RoleSwitcher({ session }: { session: SessionWithProfile }) {
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
        if (pathname && isPathAllowedForRole(pathname, role)) {
          router.refresh();
        } else {
          router.replace("/dashboard");
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

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            size="sm"
            variant="outline"
            className="inline-flex items-center gap-0.5 rounded-full bg-muted/70 px-1 py-0.5 text-[11px] dark:bg-gray-800/70 dark:border-gray-700 dark:hover:bg-gray-700/70"
            disabled={isPending}
          >
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 ${
                activeRole === "lister"
                  ? "bg-sky-600 text-white dark:bg-sky-600 dark:text-white"
                  : "text-sky-700 dark:text-sky-300"
              }`}
            >
              <Home className="h-3 w-3" />
              <span>Lister</span>
            </span>
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 ${
                activeRole === "cleaner"
                  ? "bg-emerald-600 text-white dark:bg-emerald-600 dark:text-white"
                  : "text-emerald-700 dark:text-emerald-300"
              }`}
            >
              <Sparkles className="h-3 w-3" />
              <span>Cleaner</span>
            </span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuSeparator />
          {showLister && (
            <DropdownMenuItem
              onSelect={(e) => {
                e.preventDefault();
                handleSwitch("lister");
              }}
              className="cursor-pointer text-sky-700 data-[highlighted]:bg-sky-50 data-[highlighted]:text-sky-900"
            >
              <Building2 className="mr-2 h-3.5 w-3.5" />
              <span className="text-xs">Switch to Lister</span>
            </DropdownMenuItem>
          )}
          {!hasLister && (
            <DropdownMenuItem asChild>
              <Link
                href="/onboarding?role=lister"
                className="flex cursor-pointer items-center text-sky-700 focus:bg-sky-50 focus:text-sky-900 data-[highlighted]:bg-sky-50 data-[highlighted]:text-sky-900"
              >
                <Building2 className="mr-2 h-3.5 w-3.5 shrink-0" />
                <span className="text-xs">Setup your lister profile</span>
              </Link>
            </DropdownMenuItem>
          )}
          {showCleaner && (
            <DropdownMenuItem
              onSelect={(e) => {
                e.preventDefault();
                handleSwitch("cleaner");
              }}
              className="cursor-pointer text-emerald-700 data-[highlighted]:bg-emerald-50 data-[highlighted]:text-emerald-900"
            >
              <Sparkles className="mr-2 h-3.5 w-3.5" />
              <span className="text-xs">Switch to Cleaner</span>
            </DropdownMenuItem>
          )}
          {!hasCleaner && (
            <DropdownMenuItem asChild>
              <Link
                href="/onboarding?role=cleaner"
                className="flex cursor-pointer items-center text-emerald-700 focus:bg-emerald-50 focus:text-emerald-900 data-[highlighted]:bg-emerald-50 data-[highlighted]:text-emerald-900"
              >
                <Sparkles className="mr-2 h-3.5 w-3.5 shrink-0" />
                <span className="text-xs">Setup your cleaner profile</span>
              </Link>
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      {toast.visible && (
        <div className="pointer-events-none fixed bottom-4 right-4 z-50 rounded-md bg-background/95 px-3 py-2 text-xs shadow-lg ring-1 ring-border">
          {toast.message}
        </div>
      )}
    </>
  );
}

