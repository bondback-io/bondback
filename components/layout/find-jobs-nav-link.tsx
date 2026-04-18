"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { SheetClose } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { BROWSE_JOBS_NAV_LABEL } from "@/lib/navigation/browse-jobs-labels";

/** Compact toolbar pill — outline + soft fill, readable in light and dark. */
const toolbarBase =
  "inline-flex min-w-0 shrink items-center justify-center gap-1 whitespace-nowrap rounded-full text-xs font-semibold tracking-tight transition-[color,background-color,border-color,box-shadow,transform] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/45 focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:focus-visible:ring-emerald-400/40 dark:focus-visible:ring-offset-gray-950 sm:shrink-0";

const toolbarIdle =
  "border border-emerald-600/30 bg-emerald-600/[0.07] text-emerald-900 shadow-sm shadow-emerald-900/[0.06] hover:border-emerald-600/45 hover:bg-emerald-600/[0.12] hover:shadow-md hover:shadow-emerald-900/[0.08] active:scale-[0.98] dark:border-emerald-400/35 dark:bg-emerald-400/[0.09] dark:text-emerald-200 dark:shadow-emerald-950/20 dark:hover:border-emerald-400/50 dark:hover:bg-emerald-400/[0.15]";

const toolbarActive =
  "border-emerald-600/55 bg-emerald-600/[0.16] text-emerald-950 shadow-md ring-1 ring-emerald-600/25 dark:border-emerald-400/55 dark:bg-emerald-400/[0.18] dark:text-white dark:ring-emerald-400/20";

const SHEET_ROW =
  "flex min-h-[44px] w-full items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-left text-sm font-semibold transition-[color,background-color,border-color] duration-150 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 focus-visible:ring-offset-2 dark:focus-visible:ring-emerald-400/35";

const sheetIdle =
  "border border-emerald-600/30 bg-emerald-600/[0.07] text-emerald-900 hover:bg-emerald-600/[0.12] dark:border-emerald-400/35 dark:bg-emerald-400/[0.09] dark:text-emerald-200 dark:hover:bg-emerald-400/[0.14]";

const sheetActive =
  "border-emerald-600/50 bg-emerald-600/[0.14] ring-1 ring-emerald-600/20 dark:border-emerald-400/50 dark:bg-emerald-400/[0.16] dark:ring-emerald-400/15";

export type FindJobsNavLinkProps = {
  className?: string;
  /** For product tour / e2e (cleaner flow). */
  id?: string;
};

/**
 * Top bar CTA to `/find-jobs` — label {@link BROWSE_JOBS_NAV_LABEL} everywhere except the avatar menu.
 */
export function FindJobsNavLink({ className, id }: FindJobsNavLinkProps) {
  const pathname = usePathname();
  const router = useRouter();
  const active = pathname === "/find-jobs" || pathname.startsWith("/find-jobs/");

  return (
    <Link
      id={id}
      href="/find-jobs"
      prefetch
      title="Browse bond cleaning jobs near you"
      aria-label={BROWSE_JOBS_NAV_LABEL}
      onMouseEnter={() => router.prefetch("/find-jobs")}
      className={cn(
        toolbarBase,
        toolbarIdle,
        "h-8 min-w-0 px-2 sm:h-9 sm:px-3 sm:text-[13px]",
        active && toolbarActive,
        className
      )}
    >
      <Search className="h-3.5 w-3.5 shrink-0 opacity-90 sm:h-4 sm:w-4" strokeWidth={2} aria-hidden />
      <span className="min-w-0 truncate">{BROWSE_JOBS_NAV_LABEL}</span>
    </Link>
  );
}

/** Guest mobile drawer row — same label as the toolbar CTA. */
export function FindJobsSheetLink({
  onNavigate,
  className,
}: {
  onNavigate?: () => void;
  className?: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const isActive = pathname === "/find-jobs" || pathname.startsWith("/find-jobs/");

  return (
    <SheetClose asChild>
      <Link
        href="/find-jobs"
        prefetch
        title="Browse bond cleaning jobs near you"
        aria-label={BROWSE_JOBS_NAV_LABEL}
        onPointerDown={() => router.prefetch("/find-jobs")}
        onClick={() => onNavigate?.()}
        className={cn(SHEET_ROW, sheetIdle, isActive && sheetActive, className)}
      >
        <Search className="h-[1.125rem] w-[1.125rem] shrink-0 opacity-90" strokeWidth={2} aria-hidden />
        <span>{BROWSE_JOBS_NAV_LABEL}</span>
      </Link>
    </SheetClose>
  );
}
