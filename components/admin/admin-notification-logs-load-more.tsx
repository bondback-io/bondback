"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { format, formatDistanceToNow } from "date-fns";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/components/ui/use-toast";
import { getEmailTypeLabel } from "@/lib/admin-email-templates-utils";
import {
  ADMIN_NOTIFICATION_LOG_PAGE_SIZE,
  loadMoreEmailLogsForAdmin,
  loadMoreInAppNotificationsForAdmin,
  type AdminEmailLogRow,
  type AdminInAppNotificationRow,
  type ProfileNameMap,
} from "@/lib/actions/admin-notification-logs";
import { cn } from "@/lib/utils";

function mergeProfiles(a: ProfileNameMap, b: ProfileNameMap): ProfileNameMap {
  return { ...a, ...b };
}

type LoadMoreBarProps = {
  loaded: number;
  totalCount: number;
  loading: boolean;
  onLoadMore: () => void;
};

function LoadMoreBar({ loaded, totalCount, loading, onLoadMore }: LoadMoreBarProps) {
  const hasMore = loaded < totalCount;
  const from = totalCount === 0 ? 0 : 1;
  const to = Math.min(loaded, totalCount);

  return (
    <div className="flex flex-col gap-3 border-t border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between dark:border-gray-800">
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
          </>
        )}
      </p>
      {hasMore ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-9 gap-2 text-xs"
          disabled={loading}
          onClick={onLoadMore}
        >
          {loading ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              Loading…
            </>
          ) : (
            <>Load more ({ADMIN_NOTIFICATION_LOG_PAGE_SIZE})</>
          )}
        </Button>
      ) : totalCount > ADMIN_NOTIFICATION_LOG_PAGE_SIZE ? (
        <p className="text-[11px] text-muted-foreground">All entries loaded</p>
      ) : null}
    </div>
  );
}

export type AdminEmailDeliveryLogTableProps = {
  totalCount: number;
  initialRows: AdminEmailLogRow[];
  initialProfiles: ProfileNameMap;
  className?: string;
};

export function AdminEmailDeliveryLogTable({
  totalCount,
  initialRows,
  initialProfiles,
  className,
}: AdminEmailDeliveryLogTableProps) {
  const { toast } = useToast();
  const [rows, setRows] = useState<AdminEmailLogRow[]>(initialRows);
  const [profiles, setProfiles] = useState<ProfileNameMap>(initialProfiles);
  const [loading, setLoading] = useState(false);

  const loadMore = useCallback(async () => {
    setLoading(true);
    try {
      const result = await loadMoreEmailLogsForAdmin(rows.length);
      if (!result.ok) {
        toast({
          variant: "destructive",
          title: "Could not load more",
          description: result.error,
        });
        return;
      }
      setRows((prev) => [...prev, ...result.rows]);
      setProfiles((prev) => mergeProfiles(prev, result.profiles));
    } finally {
      setLoading(false);
    }
  }, [rows.length, toast]);

  return (
    <div className={cn("overflow-x-auto p-0", className)}>
      {rows.length === 0 ? (
        <div className="px-4 py-8 text-center text-sm text-muted-foreground dark:text-gray-400">
          No emails logged yet. Emails are recorded when sent via the notification system.
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow className="dark:border-gray-800">
              <TableHead>Recipient</TableHead>
              <TableHead className="w-36">Type</TableHead>
              <TableHead className="hidden max-w-[240px] md:table-cell">Subject</TableHead>
              <TableHead className="w-36 text-right">Sent</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((e) => {
              const user = profiles[e.user_id] ?? null;
              const sentAt = new Date(e.sent_at);
              return (
                <TableRow key={e.id} className="dark:border-gray-800">
                  <TableCell className="text-xs sm:text-sm">
                    <Link
                      href={`/admin/users/${e.user_id}`}
                      className="font-medium text-primary hover:underline"
                    >
                      {user?.full_name ?? "User"}
                    </Link>
                    <span className="block max-w-[120px] truncate text-[11px] text-muted-foreground">
                      {e.user_id}
                    </span>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{getEmailTypeLabel(e.type)}</TableCell>
                  <TableCell className="hidden max-w-[240px] truncate text-xs text-muted-foreground md:table-cell">
                    {e.subject ?? "—"}
                  </TableCell>
                  <TableCell className="w-36 text-right text-[11px] text-muted-foreground">
                    {formatDistanceToNow(sentAt, { addSuffix: true })}
                    <span className="block text-[10px] opacity-80">{format(sentAt, "MMM d, HH:mm")}</span>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
      <LoadMoreBar loaded={rows.length} totalCount={totalCount} loading={loading} onLoadMore={loadMore} />
    </div>
  );
}

export type AdminInAppDeliveryLogTableProps = {
  totalCount: number;
  initialRows: AdminInAppNotificationRow[];
  initialProfiles: ProfileNameMap;
  className?: string;
};

export function AdminInAppDeliveryLogTable({
  totalCount,
  initialRows,
  initialProfiles,
  className,
}: AdminInAppDeliveryLogTableProps) {
  const { toast } = useToast();
  const [rows, setRows] = useState<AdminInAppNotificationRow[]>(initialRows);
  const [profiles, setProfiles] = useState<ProfileNameMap>(initialProfiles);
  const [loading, setLoading] = useState(false);

  const loadMore = useCallback(async () => {
    setLoading(true);
    try {
      const result = await loadMoreInAppNotificationsForAdmin(rows.length);
      if (!result.ok) {
        toast({
          variant: "destructive",
          title: "Could not load more",
          description: result.error,
        });
        return;
      }
      setRows((prev) => [...prev, ...result.rows]);
      setProfiles((prev) => mergeProfiles(prev, result.profiles));
    } finally {
      setLoading(false);
    }
  }, [rows.length, toast]);

  return (
    <div className={cn("overflow-x-auto p-0", className)}>
      {rows.length === 0 ? (
        <div className="px-4 py-8 text-center text-sm text-muted-foreground dark:text-gray-400">
          No in-app notifications yet.
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow className="dark:border-gray-800">
              <TableHead>User</TableHead>
              <TableHead className="w-40">Type</TableHead>
              <TableHead className="hidden md:table-cell">Message</TableHead>
              <TableHead className="hidden w-20 sm:table-cell">Job</TableHead>
              <TableHead className="w-20">Status</TableHead>
              <TableHead className="w-36 text-right">Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((n) => {
              const user = profiles[n.user_id] ?? null;
              const created = new Date(n.created_at);
              const timeAgo = formatDistanceToNow(created, { addSuffix: true });
              return (
                <TableRow key={n.id} className="dark:border-gray-800">
                  <TableCell className="text-xs sm:text-sm">
                    <Link
                      href={`/admin/users/${n.user_id}`}
                      className="font-medium text-primary hover:underline"
                    >
                      {user?.full_name ?? "User"}
                    </Link>
                    <span className="block max-w-[120px] truncate text-[11px] text-muted-foreground">
                      {n.user_id}
                    </span>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{getEmailTypeLabel(n.type)}</TableCell>
                  <TableCell className="hidden max-w-xs truncate text-xs text-muted-foreground md:table-cell">
                    {n.message_text ?? "—"}
                  </TableCell>
                  <TableCell className="hidden text-xs sm:table-cell">
                    {n.job_id ? (
                      <Link href={`/jobs/${n.job_id}`} className="text-primary hover:underline">
                        #{n.job_id}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={n.is_read ? "default" : "outline"} className="text-[10px]">
                      {n.is_read ? "Read" : "Unread"}
                    </Badge>
                  </TableCell>
                  <TableCell className="w-36 text-right text-[11px] text-muted-foreground">
                    {timeAgo}
                    <span className="block text-[10px] opacity-80">{format(created, "MMM d, HH:mm")}</span>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
      <LoadMoreBar loaded={rows.length} totalCount={totalCount} loading={loading} onLoadMore={loadMore} />
    </div>
  );
}
