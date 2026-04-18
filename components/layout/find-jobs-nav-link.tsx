"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { SheetClose } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

const toolbarBase =
  "inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-full font-semibold tracking-tight transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/90 focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:focus-visible:ring-offset-gray-950";

const toolbarGradient =
  "bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-700 text-white shadow-md shadow-emerald-900/30 ring-1 ring-white/15 hover:from-emerald-500 hover:via-teal-500 hover:to-cyan-600 hover:shadow-lg hover:shadow-emerald-900/35 active:scale-[0.98] dark:from-emerald-500 dark:via-teal-600 dark:to-cyan-700 dark:shadow-emerald-950/40 dark:ring-white/10 dark:hover:from-emerald-400 dark:hover:via-teal-500 dark:hover:to-cyan-600";

const SHEET_ROW =
  "flex min-h-[48px] w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-semibold transition-colors active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

export type FindJobsNavLinkProps = {
  className?: string;
  /** For product tour / e2e (cleaner flow). */
  id?: string;
};

/**
 * Prominent “Find Jobs” CTA for the top bar — next to the logo on mobile and desktop.
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
      aria-label="Find jobs"
      onMouseEnter={() => router.prefetch("/find-jobs")}
      className={cn(
        toolbarBase,
        toolbarGradient,
        "min-h-[40px] px-3 py-2 text-xs sm:min-h-[42px] sm:px-3.5 sm:text-sm",
        active &&
          "ring-2 ring-amber-300/90 ring-offset-2 ring-offset-background dark:ring-amber-400/80 dark:ring-offset-gray-950",
        className
      )}
    >
      <Search className="h-4 w-4 shrink-0 opacity-95 sm:h-[1.05rem] sm:w-[1.05rem]" strokeWidth={2.25} aria-hidden />
      <span>Find Jobs</span>
    </Link>
  );
}

/** Mobile drawer row — same visual language as the toolbar CTA. */
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
        aria-label="Find jobs"
        onPointerDown={() => router.prefetch("/find-jobs")}
        onClick={() => onNavigate?.()}
        className={cn(
          SHEET_ROW,
          toolbarGradient,
          "text-white hover:brightness-105 dark:hover:brightness-110",
          isActive && "ring-2 ring-amber-300/90 dark:ring-amber-400/80",
          className
        )}
      >
        <Search className="h-5 w-5 shrink-0 opacity-95" strokeWidth={2.25} aria-hidden />
        <span>Find Jobs</span>
      </Link>
    </SheetClose>
  );
}
