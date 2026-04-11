"use client";

import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import {
  Bell,
  DollarSign,
  Gavel,
  MessageCircle,
  CheckCircle2,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type ActivityItem = {
  id: string;
  type: string;
  message_text: string | null;
  job_id: number | null;
  created_at: string;
  /** Precomputed path (e.g. from `getNotificationHref`) so listing-only rows link to `/listings/…`. */
  href?: string | null;
};

export type CollapsibleActivityFeedProps = {
  items: ActivityItem[];
  viewAllHref?: string;
  emptyMessage?: string;
  className?: string;
  defaultOpen?: boolean;
};

export function CollapsibleActivityFeed({
  items,
  viewAllHref = "/notifications",
  emptyMessage = "No recent activity yet.",
  className,
  defaultOpen = false,
}: CollapsibleActivityFeedProps) {
  return (
    <details
      className={cn(
        "group rounded-xl border border-border bg-card dark:border-gray-800 dark:bg-gray-900/50",
        className
      )}
      open={defaultOpen}
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 text-sm font-semibold text-foreground dark:text-gray-100 [&::-webkit-details-marker]:hidden">
        <span>Recent Activity</span>
        <div className="flex items-center gap-2">
          {items.length > 0 && (
            <Link
              href={viewAllHref}
              className="text-xs font-medium text-primary underline-offset-4 hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              View all
            </Link>
          )}
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
        </div>
      </summary>
      <div className="max-h-[280px] overflow-y-auto border-t border-border p-3 dark:border-gray-800">
        {items.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground dark:text-gray-400">
            {emptyMessage}
          </p>
        ) : (
          <ul className="space-y-0 divide-y divide-border dark:divide-gray-800">
            {items.map((item) => {
              let icon = <Bell className="h-3.5 w-3.5 shrink-0" />;
              if (item.type === "new_bid") icon = <Gavel className="h-3.5 w-3.5 shrink-0" />;
              else if (item.type === "payment_released") icon = <DollarSign className="h-3.5 w-3.5 shrink-0" />;
              else if (item.type === "job_accepted" || item.type === "job_created") icon = <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />;
              else if (item.type === "new_message") icon = <MessageCircle className="h-3.5 w-3.5 shrink-0" />;

              const label = item.message_text || "Update";
              const timeAgo = formatDistanceToNow(new Date(item.created_at), { addSuffix: true });
              const linkHref = item.href ?? (item.job_id != null ? `/jobs/${item.job_id}` : null);
              const rowClassName = cn(
                "flex items-start gap-3 py-3 transition-colors",
                linkHref &&
                  "hover:bg-muted/50 dark:hover:bg-gray-800/50 rounded-md -mx-1 px-2"
              );
              const body = (
                <>
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground dark:bg-gray-800 dark:text-gray-200">
                    {icon}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-foreground dark:text-gray-100 line-clamp-2">
                      {label}
                    </p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {timeAgo}
                    </p>
                  </div>
                  {linkHref != null && (
                    <span className="shrink-0 text-xs font-medium text-primary">
                      View
                    </span>
                  )}
                </>
              );

              return (
                <li key={item.id}>
                  {linkHref != null ? (
                    <Link href={linkHref} className={cn("block", rowClassName)}>
                      {body}
                    </Link>
                  ) : (
                    <div className={rowClassName}>{body}</div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </details>
  );
}
