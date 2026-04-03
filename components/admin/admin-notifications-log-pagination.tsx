import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 10;

export type AdminNotificationsLogPaginationProps = {
  /** Current page (1-based). */
  currentPage: number;
  /** Total rows in the table. */
  totalCount: number;
  /** Query param key for this log (`emailPage` or `inAppPage`). */
  paramKey: "emailPage" | "inAppPage";
  /** The other page’s current index (1-based), preserved in links. */
  otherPage: number;
  className?: string;
};

function buildNotificationsLogHref(
  paramKey: "emailPage" | "inAppPage",
  page: number,
  otherPage: number
): string {
  const emailPage = paramKey === "emailPage" ? page : otherPage;
  const inAppPage = paramKey === "inAppPage" ? page : otherPage;
  const params = new URLSearchParams();
  if (emailPage > 1) params.set("emailPage", String(emailPage));
  if (inAppPage > 1) params.set("inAppPage", String(inAppPage));
  const q = params.toString();
  return q ? `/admin/notifications?${q}` : "/admin/notifications";
}

/**
 * Prev/next pagination for admin email log / in-app log (10 rows per page).
 */
export function AdminNotificationsLogPagination({
  currentPage,
  totalCount,
  paramKey,
  otherPage,
  className,
}: AdminNotificationsLogPaginationProps) {
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const page = Math.min(Math.max(1, currentPage), totalPages);
  const from = totalCount === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, totalCount);

  return (
    <div
      className={cn(
        "flex flex-col gap-2 border-t border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between dark:border-gray-800",
        className
      )}
    >
      <p className="text-[11px] text-muted-foreground dark:text-gray-400">
        {totalCount === 0 ? (
          <>No rows</>
        ) : (
          <>
            Showing{" "}
            <span className="tabular-nums font-medium text-foreground dark:text-gray-200">
              {from}–{to}
            </span>{" "}
            of <span className="tabular-nums font-medium">{totalCount}</span>
            <span className="hidden sm:inline"> · Page </span>
            <span className="sm:hidden">
              <br />
            </span>
            <span className="tabular-nums font-medium">
              {page} / {totalPages}
            </span>
          </>
        )}
      </p>
      <div className="flex items-center gap-2">
        {page > 1 ? (
          <Button variant="outline" size="sm" className="h-8 gap-1 px-2 text-xs" asChild>
            <Link href={buildNotificationsLogHref(paramKey, page - 1, otherPage)}>
              <ChevronLeft className="h-3.5 w-3.5" />
              Previous
            </Link>
          </Button>
        ) : (
          <Button variant="outline" size="sm" className="h-8 gap-1 px-2 text-xs" disabled>
            <ChevronLeft className="h-3.5 w-3.5" />
            Previous
          </Button>
        )}
        {page < totalPages ? (
          <Button variant="outline" size="sm" className="h-8 gap-1 px-2 text-xs" asChild>
            <Link href={buildNotificationsLogHref(paramKey, page + 1, otherPage)}>
              Next
              <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        ) : (
          <Button variant="outline" size="sm" className="h-8 gap-1 px-2 text-xs" disabled>
            Next
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}
