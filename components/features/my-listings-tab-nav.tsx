"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export type MyListingsTabNavTab =
  | "active_listings"
  | "completed_jobs"
  | "pending_payments"
  | "cancelled_listings"
  | "disputes";

type Props = {
  tab: MyListingsTabNavTab;
  activeCount: number;
  completedCount: number;
  pendingPaymentsCount: number;
  completedCancelledExpiredTabCount: number;
  disputesCount: number;
};

const tabPill = (isActive: boolean) =>
  cn(
    "touch-manipulation inline-flex min-h-[48px] shrink-0 snap-start items-center justify-center whitespace-nowrap rounded-full px-3.5 py-2.5 text-[13px] font-semibold leading-tight transition-all duration-200 active:scale-[0.98] sm:min-h-0 sm:px-3.5 sm:py-2 sm:text-sm",
    isActive
      ? "bg-background text-foreground shadow-md ring-2 ring-emerald-500/35 dark:bg-gray-800 dark:text-gray-100 dark:ring-emerald-500/25"
      : "border border-transparent bg-muted/80 text-muted-foreground hover:border-emerald-500/30 hover:bg-emerald-50/90 hover:text-foreground dark:bg-gray-800/80 dark:text-gray-400 dark:hover:border-emerald-500/25 dark:hover:bg-gray-800 dark:hover:text-gray-100"
  );

export function MyListingsTabNav({
  tab,
  activeCount,
  completedCount,
  pendingPaymentsCount,
  completedCancelledExpiredTabCount,
  disputesCount,
}: Props) {
  const router = useRouter();

  const selectLabel = (() => {
    switch (tab) {
      case "active_listings":
        return `Active (${activeCount})`;
      case "completed_jobs":
        return `Completed (${completedCount})`;
      case "pending_payments":
        return `Pending pay (${pendingPaymentsCount})`;
      case "cancelled_listings":
        return `History (${completedCancelledExpiredTabCount})`;
      case "disputes":
        return `Disputes (${disputesCount})`;
      default:
        return `Active (${activeCount})`;
    }
  })();

  return (
    <div className="relative px-4 sm:px-0">
      <div className="md:hidden">
        <Select
          value={tab}
          onValueChange={(v) => {
            router.push(`/my-listings?tab=${v}`, { scroll: false });
          }}
        >
          <SelectTrigger
            aria-label="Choose listings view"
            className="h-12 w-full rounded-xl border-emerald-200/80 bg-background text-left font-semibold shadow-sm dark:border-emerald-900/50 dark:bg-gray-950"
          >
            <SelectValue placeholder={selectLabel} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="active_listings">
              Active ({activeCount})
            </SelectItem>
            <SelectItem value="completed_jobs">
              Completed ({completedCount})
            </SelectItem>
            <SelectItem value="pending_payments">
              Pending pay ({pendingPaymentsCount})
            </SelectItem>
            <SelectItem value="cancelled_listings">
              History ({completedCancelledExpiredTabCount})
            </SelectItem>
            <SelectItem value="disputes">Disputes ({disputesCount})</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <nav
        className="-mx-1 hidden gap-2 overflow-x-auto scroll-pl-4 scroll-pr-4 pb-1 pt-0.5 [scrollbar-width:none] snap-x snap-mandatory sm:snap-none sm:scroll-pl-0 sm:scroll-pr-0 md:flex [&::-webkit-scrollbar]:hidden"
        aria-label="Listings and jobs"
      >
        <Link
          href="/my-listings?tab=active_listings"
          className={tabPill(tab === "active_listings")}
          scroll={false}
        >
          Active ({activeCount})
        </Link>
        <Link
          href="/my-listings?tab=completed_jobs"
          className={tabPill(tab === "completed_jobs")}
          scroll={false}
        >
          <span className="sm:hidden">Done ({completedCount})</span>
          <span className="hidden sm:inline">Completed ({completedCount})</span>
        </Link>
        <Link
          href="/my-listings?tab=pending_payments"
          className={tabPill(tab === "pending_payments")}
          scroll={false}
        >
          <span className="sm:hidden">Pay ({pendingPaymentsCount})</span>
          <span className="hidden sm:inline">
            Pending pay ({pendingPaymentsCount})
          </span>
        </Link>
        <Link
          href="/my-listings?tab=cancelled_listings"
          className={tabPill(tab === "cancelled_listings")}
          scroll={false}
        >
          History ({completedCancelledExpiredTabCount})
        </Link>
        <Link
          href="/my-listings?tab=disputes"
          className={tabPill(tab === "disputes")}
          scroll={false}
        >
          Disputes ({disputesCount})
        </Link>
      </nav>
    </div>
  );
}
