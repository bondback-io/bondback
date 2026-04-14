"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import {
  MessageSquare,
  ChevronLeft,
  ChevronRight,
  Loader2,
  CornerDownRight,
  ChevronDown,
} from "lucide-react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import {
  banCleanerFromListingQa,
  removeListingComment,
  postListingComment,
  type ListingCommentPublic,
} from "@/lib/actions/listing-comments";
import { markListingQaNotificationsRead } from "@/lib/actions/notifications";
import { MOBILE_BOTTOM_NAV_FAB_OFFSET } from "@/lib/mobile-bottom-nav-layout";
import { useToast } from "@/components/ui/use-toast";
import Link from "next/link";

export type ListingPublicCommentsDockProps = {
  listingId: string;
  listerId: string;
  initialComments: ListingCommentPublic[];
  currentUserId: string | null;
  /**
   * True when the viewer owns this listing and their active role is Lister (not Cleaner).
   * Dual-role users browsing as Cleaner get the normal composer; Lister mode is reply-only for new threads.
   */
  ownerListerSession: boolean;
  /** True when signed-in user does not own this listing and active role is Lister — Q&A posting is disabled. */
  listerActiveViewingOthersListing: boolean;
  /** Unread in-app Q&A notifications for this listing (server count). */
  initialQaUnreadCount?: number;
};

function sortByCreated(a: ListingCommentPublic, b: ListingCommentPublic) {
  return a.created_at.localeCompare(b.created_at);
}

function CommentBlock({
  c,
  root,
  currentUserId,
  ownerListerSession,
  showReplyButton,
  onReply,
  onBan,
  onRemoveComment,
  onRemoveThread,
}: {
  c: ListingCommentPublic;
  root: ListingCommentPublic;
  currentUserId: string | null;
  ownerListerSession: boolean;
  showReplyButton: boolean;
  onReply: (id: string) => void;
  onBan: (userId: string) => void;
  onRemoveComment: (commentId: string) => void;
  onRemoveThread: (rootId: string) => void;
}) {
  const rel = formatDistanceToNow(new Date(c.created_at), { addSuffix: true });
  const commenterIsCurrentUser =
    Boolean(currentUserId) && String(currentUserId) === String(c.user_id);
  const canThreadOwnerReply =
    Boolean(currentUserId) && String(currentUserId) === String(root.user_id);
  const canReplyAsThreadOwner = canThreadOwnerReply;
  const canReply = showReplyButton || canReplyAsThreadOwner;
  const canModerate = ownerListerSession && String(c.user_id) !== String(currentUserId);
  const canBan = canModerate && String(c.author_role_label).toLowerCase() === "cleaner";

  return (
    <div className="rounded-lg border border-border/80 bg-muted/20 px-3 py-2.5 dark:border-gray-800 dark:bg-gray-900/40">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="truncate text-sm font-semibold text-foreground dark:text-gray-100">
            {c.author_display_name}
          </span>
          <Badge
            variant="secondary"
            className="shrink-0 text-[10px] font-semibold uppercase tracking-wide"
          >
            {c.author_role_label}
          </Badge>
          {c.author_banned ? (
            <span className="text-[10px] font-semibold uppercase tracking-wide text-destructive">
              user was banned for misconduct
            </span>
          ) : null}
        </div>
        <time
          className="shrink-0 text-[11px] text-muted-foreground dark:text-gray-500"
          dateTime={c.created_at}
        >
          {rel}
        </time>
      </div>
      <p className="mt-1.5 whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground/95 dark:text-gray-200">
        {c.message_text}
      </p>
      {canReply || canModerate ? (
        <div className="mt-2 flex flex-wrap justify-end gap-1.5">
          {canReply ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 text-xs text-muted-foreground hover:text-foreground"
              onClick={() => onReply(c.id)}
              disabled={c.author_banned && !commenterIsCurrentUser}
            >
              Reply
            </Button>
          ) : null}
          {canBan ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 text-xs text-destructive hover:text-destructive"
              onClick={() => onBan(c.user_id)}
            >
              Ban cleaner
            </Button>
          ) : null}
          {canModerate ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 text-xs text-destructive hover:text-destructive"
              onClick={() => onRemoveComment(c.id)}
            >
              Remove post
            </Button>
          ) : null}
          {canModerate && c.parent_comment_id == null ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 text-xs text-destructive hover:text-destructive"
              onClick={() => onRemoveThread(c.id)}
            >
              Remove thread
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function GroupedCommentThreads({
  comments,
  listerId,
  ownerListerSession,
  currentUserId,
  onReply,
  onBan,
  onRemoveComment,
  onRemoveThread,
}: {
  comments: ListingCommentPublic[];
  listerId: string;
  /** Owner viewing in Lister mode: reply-only; Cleaner mode uses full composer. */
  ownerListerSession: boolean;
  currentUserId: string | null;
  onReply: (id: string) => void;
  onBan: (userId: string) => void;
  onRemoveComment: (commentId: string) => void;
  onRemoveThread: (rootId: string) => void;
}) {
  const byParent = useMemo(() => {
    const m = new Map<string | null, ListingCommentPublic[]>();
    for (const c of comments) {
      const p = c.parent_comment_id;
      if (!m.has(p)) m.set(p, []);
      m.get(p)!.push(c);
    }
    for (const arr of m.values()) arr.sort(sortByCreated);
    return m;
  }, [comments]);

  const roots = byParent.get(null) ?? [];
  if (roots.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground dark:text-gray-500">
        {ownerListerSession
          ? "No questions yet. When cleaners ask something here, open a thread and use Reply to respond."
          : "No comments yet. Be the first to ask a question."}
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {roots.map((root) => {
        const replies = byParent.get(root.id) ?? [];
        const canListerReply = ownerListerSession && String(root.user_id) !== String(listerId);
        const replyLabel =
          replies.length === 0
            ? "No replies yet"
            : replies.length === 1
              ? "1 reply"
              : `${replies.length} replies`;

        return (
          <details
            key={root.id}
            className="group rounded-lg border border-border/80 bg-card/30 dark:border-gray-800 dark:bg-gray-950/40"
          >
            <summary
              className="cursor-pointer list-none px-3 py-2.5 [&::-webkit-details-marker]:hidden"
              aria-label={`Thread from ${root.author_display_name}, ${replyLabel}. Expand to read the question and replies.`}
            >
              <div className="flex items-start gap-2">
                <ChevronDown
                  className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
                  aria-hidden
                />
                <div className="min-w-0 flex-1 space-y-0.5">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="truncate text-sm font-semibold text-foreground dark:text-gray-100">
                      {root.author_display_name}
                    </span>
                    <span className="shrink-0 text-[11px] text-muted-foreground dark:text-gray-500">
                      {formatDistanceToNow(new Date(root.created_at), { addSuffix: true })}
                    </span>
                  </div>
                  <p className="text-[11px] font-medium text-muted-foreground dark:text-gray-500">
                    {replyLabel}
                  </p>
                </div>
              </div>
            </summary>
            <div className="space-y-2 border-t border-border/60 px-3 py-3 dark:border-gray-800">
              <CommentBlock
                c={root}
                root={root}
                currentUserId={currentUserId}
                ownerListerSession={ownerListerSession}
                showReplyButton={canListerReply}
                onReply={onReply}
                onBan={onBan}
                onRemoveComment={onRemoveComment}
                onRemoveThread={onRemoveThread}
              />
              {replies.map((r) => (
                <div
                  key={r.id}
                  className="border-l-2 border-primary/25 pl-3 dark:border-primary/35"
                >
                  <CommentBlock
                    c={r}
                    root={root}
                    currentUserId={currentUserId}
                    ownerListerSession={ownerListerSession}
                    showReplyButton={false}
                    onReply={onReply}
                    onBan={onBan}
                    onRemoveComment={onRemoveComment}
                    onRemoveThread={onRemoveThread}
                  />
                </div>
              ))}
            </div>
          </details>
        );
      })}
    </div>
  );
}

function CommentsPanelInner({
  listingId,
  listerId,
  comments,
  currentUserId,
  ownerListerSession,
  listerActiveViewingOthersListing,
  replyToId,
  setReplyToId,
  draft,
  setDraft,
  posting,
  onPost,
  onBan,
  onRemoveComment,
  onRemoveThread,
}: {
  listingId: string;
  listerId: string;
  comments: ListingCommentPublic[];
  currentUserId: string | null;
  ownerListerSession: boolean;
  listerActiveViewingOthersListing: boolean;
  replyToId: string | null;
  setReplyToId: (id: string | null) => void;
  draft: string;
  setDraft: (s: string) => void;
  posting: boolean;
  onPost: () => void;
  onBan: (userId: string) => void;
  onRemoveComment: (commentId: string) => void;
  onRemoveThread: (rootId: string) => void;
}) {
  const replyHint = replyToId
    ? comments.find((c) => c.id === replyToId)?.author_display_name
    : null;
  const viewerIsBanned =
    Boolean(currentUserId) &&
    comments.some(
      (c) => String(c.user_id) === String(currentUserId) && c.author_banned
    );

  const composerDisabledForListerOwner = ownerListerSession && !replyToId;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 border-b border-border px-1 pb-3 dark:border-gray-800">
        <h2 className="text-base font-semibold tracking-tight text-foreground dark:text-gray-100">
          Public questions &amp; comments
        </h2>
        <p className="mt-1 text-xs leading-snug text-muted-foreground dark:text-gray-500">
          {listerActiveViewingOthersListing ? (
            <>
              You&apos;re browsing as a Lister. Public Q&amp;A is for cleaners and other members on this
              listing — switch to <span className="font-medium text-foreground">Cleaner</span> in the
              header if you want to ask a question.
            </>
          ) : ownerListerSession ? (
            <>
              You can only reply under questions from cleaners and other members — open a thread and use
              Reply. You can&apos;t start a new thread here.
            </>
          ) : (
            <>
              Ask about the clean, timing, or access. No phone numbers or links — use in-app chat after
              you&apos;re hired. Only the lister can reply under each question.
            </>
          )}
        </p>
        {comments.length > 0 ? (
          <p className="mt-2 text-[11px] font-medium text-muted-foreground dark:text-gray-500">
            {comments.length} {comments.length === 1 ? "message" : "messages"}
          </p>
        ) : null}
      </div>
      <ScrollArea className="min-h-0 flex-1 py-3 pr-2">
        <GroupedCommentThreads
          comments={comments}
          listerId={listerId}
          ownerListerSession={ownerListerSession}
          currentUserId={currentUserId}
          onReply={setReplyToId}
          onBan={onBan}
          onRemoveComment={onRemoveComment}
          onRemoveThread={onRemoveThread}
        />
      </ScrollArea>
      <div className="shrink-0 space-y-2 border-t border-border pt-3 dark:border-gray-800">
        {!currentUserId ? (
          <p className="text-center text-sm text-muted-foreground dark:text-gray-400">
            <Link
              href={`/login?next=/listings/${encodeURIComponent(listingId)}`}
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              Sign in
            </Link>{" "}
            to send a message.
          </p>
        ) : viewerIsBanned ? (
          <p className="text-center text-sm leading-relaxed text-muted-foreground dark:text-gray-400">
            You were banned for misconduct and can no longer post or reply in this Q&amp;A.
          </p>
        ) : listerActiveViewingOthersListing ? (
          <p className="text-center text-sm leading-relaxed text-muted-foreground dark:text-gray-400">
            Listers can&apos;t post in Q&amp;A on other people&apos;s listings. Switch to{" "}
            <span className="font-medium text-foreground dark:text-gray-200">Cleaner</span> in the header
            to ask a question here.
          </p>
        ) : composerDisabledForListerOwner ? (
          <p className="text-center text-sm leading-relaxed text-muted-foreground dark:text-gray-400">
            To respond, expand a question above and tap{" "}
            <span className="font-medium text-foreground dark:text-gray-200">Reply</span> — you can&apos;t
            post a new thread as the lister.
          </p>
        ) : (
          <form
            className="contents"
            onSubmit={(e) => {
              e.preventDefault();
              if (posting || !draft.trim()) return;
              if (ownerListerSession && !replyToId) return;
              onPost();
            }}
          >
            {replyToId && (
              <div className="flex items-center gap-2 rounded-md bg-muted/60 px-2 py-1.5 text-xs dark:bg-gray-800/60">
                <CornerDownRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                <span className="min-w-0 flex-1 truncate">
                  Replying to {replyHint ?? "comment"}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 shrink-0 px-2 text-xs"
                  onClick={() => setReplyToId(null)}
                >
                  Clear
                </Button>
              </div>
            )}
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={replyToId ? "Write your reply…" : "Write a message…"}
              className="min-h-[72px] resize-none text-base dark:border-gray-700 dark:bg-gray-900/80 md:min-h-[88px] md:text-sm"
              maxLength={2000}
              disabled={posting}
              name="qa-message"
              autoComplete="off"
            />
            <Button
              type="submit"
              className="w-full touch-manipulation"
              disabled={posting || !draft.trim() || (ownerListerSession && !replyToId)}
            >
              {posting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                  Sending…
                </>
              ) : replyToId ? (
                "Reply message"
              ) : (
                "Send Message"
              )}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}

export function ListingPublicCommentsDock({
  listingId,
  listerId,
  initialComments,
  currentUserId,
  ownerListerSession,
  listerActiveViewingOthersListing,
  initialQaUnreadCount = 0,
}: ListingPublicCommentsDockProps) {
  const { toast } = useToast();
  const [comments, setComments] = useState<ListingCommentPublic[]>(initialComments);
  const [desktopCollapsed, setDesktopCollapsed] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [replyToId, setReplyToId] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);
  const [qaUnread, setQaUnread] = useState(initialQaUnreadCount);
  const [moderating, setModerating] = useState(false);

  const sheetOpenRef = useRef(sheetOpen);
  const desktopCollapsedRef = useRef(desktopCollapsed);
  const prevViewingRef = useRef(false);

  useEffect(() => {
    sheetOpenRef.current = sheetOpen;
  }, [sheetOpen]);
  useEffect(() => {
    desktopCollapsedRef.current = desktopCollapsed;
  }, [desktopCollapsed]);

  useEffect(() => {
    setComments(initialComments);
  }, [initialComments, listingId]);

  useEffect(() => {
    setQaUnread(initialQaUnreadCount);
  }, [initialQaUnreadCount, listingId]);

  useEffect(() => {
    if (!currentUserId) return;
    const viewing = sheetOpen || !desktopCollapsed;
    if (viewing && !prevViewingRef.current) {
      void markListingQaNotificationsRead(listingId).then((res) => {
        if (res.ok) setQaUnread(0);
      });
    }
    prevViewingRef.current = viewing;
  }, [sheetOpen, desktopCollapsed, listingId, currentUserId]);

  useEffect(() => {
    if (!currentUserId) return;
    const supabase = createBrowserSupabaseClient();
    const channel = supabase
      .channel(`qa-unread:${listingId}:${currentUserId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${currentUserId}`,
        },
        (payload) => {
          const row = payload.new as {
            type?: string;
            is_read?: boolean;
            data?: Record<string, unknown> | null;
          };
          if (row.type !== "listing_public_comment" || row.is_read) return;
          if (String(row.data?.listing_uuid ?? "") !== String(listingId)) return;
          const viewing = sheetOpenRef.current || !desktopCollapsedRef.current;
          if (!viewing) setQaUnread((n) => n + 1);
        }
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [listingId, currentUserId]);

  const enrichInsert = useCallback(
    async (row: {
      id: string;
      listing_id: string;
      user_id: string;
      parent_comment_id: string | null;
      message_text: string;
      created_at: string;
    }): Promise<ListingCommentPublic> => {
      const supabase = createBrowserSupabaseClient();
      const { data: p } = await supabase
        .from("profiles")
        .select("full_name, roles, active_role")
        .eq("id", row.user_id)
        .maybeSingle();
      const fullName = (p as { full_name?: string | null } | null)?.full_name;
      const roles = (p as { roles?: string[] | null } | null)?.roles;
      const activeRoleRaw = (p as { active_role?: string | null } | null)?.active_role;
      const rolesArr = Array.isArray(roles) ? roles.map((x) => String(x).toLowerCase()) : [];
      const activeResolved =
        (typeof activeRoleRaw === "string" && activeRoleRaw.trim()
          ? activeRoleRaw.trim().toLowerCase()
          : null) ?? rolesArr[0] ?? null;
      const hasCleaner = rolesArr.includes("cleaner");
      const name =
        (fullName ?? "").trim().length > 0
          ? (fullName as string).length > 48
            ? `${(fullName as string).slice(0, 47)}…`
            : (fullName as string)
          : "Member";
      const sameAsLister = String(row.user_id) === String(listerId);
      const showAsCleanerOnOwnListing =
        sameAsLister && activeResolved === "cleaner" && hasCleaner;
      const roleLabel = showAsCleanerOnOwnListing
        ? ("Cleaner" as const)
        : sameAsLister
          ? ("Lister" as const)
          : hasCleaner
            ? ("Cleaner" as const)
            : ("Member" as const);
      return {
        id: row.id,
        listing_id: row.listing_id,
        user_id: row.user_id,
        parent_comment_id: row.parent_comment_id,
        message_text: row.message_text,
        created_at: row.created_at,
        author_display_name: name,
        author_role_label: roleLabel,
      };
    },
    [listerId]
  );

  useEffect(() => {
    const supabase = createBrowserSupabaseClient();
    const channel = supabase
      .channel(`listing-comments:${listingId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "listing_comments",
          filter: `listing_id=eq.${listingId}`,
        },
        async (payload) => {
          const row = payload.new as {
            id: string;
            listing_id: string;
            user_id: string;
            parent_comment_id: string | null;
            message_text: string;
            created_at: string;
          };
          if (!row?.id) return;
          const enriched = await enrichInsert(row);
          setComments((prev) => {
            if (prev.some((c) => c.id === row.id)) return prev;
            return [...prev, enriched].sort(sortByCreated);
          });
        }
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [listingId, enrichInsert]);

  const handlePost = async (opts?: { closeMobileSheet?: boolean }) => {
    if (!currentUserId || !draft.trim()) return false;
    if (listerActiveViewingOthersListing) return false;
    if (ownerListerSession && replyToId == null) {
      return false;
    }
    setPosting(true);
    try {
      const res = await postListingComment({
        listingId,
        message: draft,
        parentCommentId: replyToId,
      });
      if (!res.ok) {
        toast({ variant: "destructive", title: "Could not send", description: res.error });
        return false;
      }
      setComments((prev) => {
        if (prev.some((c) => c.id === res.comment.id)) return prev;
        return [...prev, res.comment].sort(sortByCreated);
      });
      setDraft("");
      setReplyToId(null);
      toast({ title: "Sent", description: "Your message is visible on this listing." });
      if (opts?.closeMobileSheet) setSheetOpen(false);
      return true;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Something went wrong. Try again.";
      toast({ variant: "destructive", title: "Could not send", description: msg });
      return false;
    } finally {
      setPosting(false);
    }
  };

  const handleBan = async (userId: string) => {
    if (!ownerListerSession || moderating) return;
    const ok = window.confirm("Ban this cleaner from further Q&A comments and replies?");
    if (!ok) return;
    setModerating(true);
    try {
      const res = await banCleanerFromListingQa({
        listingId,
        targetUserId: userId,
        reason: "user was banned for misconduct",
      });
      if (!res.ok) {
        toast({ variant: "destructive", title: "Could not ban", description: res.error });
        return;
      }
      setComments((prev) =>
        prev.map((c) =>
          String(c.user_id) === String(userId)
            ? { ...c, author_banned: true }
            : c
        )
      );
      toast({ title: "Cleaner banned", description: "User can no longer post or reply here." });
    } finally {
      setModerating(false);
    }
  };

  const handleRemove = async (commentId: string, scope: "comment" | "thread") => {
    if (!ownerListerSession || moderating) return;
    const msg =
      scope === "thread"
        ? "Remove this entire thread and all replies?"
        : "Remove this post?";
    const ok = window.confirm(msg);
    if (!ok) return;
    setModerating(true);
    try {
      const res = await removeListingComment({ listingId, commentId, scope });
      if (!res.ok) {
        toast({ variant: "destructive", title: "Could not remove", description: res.error });
        return;
      }
      const removed = new Set(res.removedIds.map((id) => String(id)));
      setComments((prev) => prev.filter((c) => !removed.has(String(c.id))));
      toast({
        title: scope === "thread" ? "Thread removed" : "Post removed",
        description: scope === "thread" ? "The whole thread was removed." : "The post was removed.",
      });
    } finally {
      setModerating(false);
    }
  };

  const commentCountBadge =
    comments.length > 0 ? (
      <Badge variant="secondary" className="tabular-nums">
        {comments.length}
      </Badge>
    ) : null;

  const unreadBadge =
    qaUnread > 0 ? (
      <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground shadow-sm">
        {qaUnread > 99 ? "99+" : qaUnread}
      </span>
    ) : null;

  /** Below sticky site header + small gap; matches listing column start in viewport. */
  const qaStickyTop =
    "top-[calc(3.75rem+env(safe-area-inset-top,0px)+1rem)]";

  return (
    <>
      {/* Desktop: column stretches with grid row so sticky can ride full listing scroll */}
      <aside className="hidden xl:flex xl:h-full xl:min-h-0 xl:w-full xl:max-w-[min(100%,320px)] xl:items-start xl:justify-end xl:justify-self-end">
        <div
          className={cn(
            "xl:sticky xl:z-10 xl:w-full xl:max-w-[min(100%,320px)] xl:self-start",
            qaStickyTop
          )}
        >
        {desktopCollapsed ? (
          <button
            type="button"
            onClick={() => setDesktopCollapsed(false)}
            className="flex w-full max-w-[52px] flex-col items-center gap-2 rounded-2xl border border-border bg-card py-4 shadow-sm transition hover:bg-muted/40 dark:border-gray-800 dark:bg-gray-950 dark:hover:bg-gray-900/80"
            aria-expanded={false}
            aria-label="Expand Q&A Chat"
          >
            <span className="relative inline-flex">
              <MessageSquare className="h-5 w-5 text-muted-foreground" aria-hidden />
              {unreadBadge}
            </span>
            {commentCountBadge}
            <ChevronLeft className="h-4 w-4 text-muted-foreground" aria-hidden />
          </button>
        ) : (
          <Card className="flex max-h-[min(560px,calc(100dvh-5rem-env(safe-area-inset-top,0px)))] flex-col overflow-hidden border-border shadow-sm dark:border-gray-800 dark:bg-gray-950">
            <CardHeader className="flex shrink-0 flex-row items-center justify-between space-y-0 border-b border-border py-3 dark:border-gray-800">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <span className="relative inline-flex">
                  <MessageSquare className="h-4 w-4" aria-hidden />
                  {unreadBadge}
                </span>
                Q&amp;A Chat
                {commentCountBadge}
              </CardTitle>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0"
                onClick={() => setDesktopCollapsed(true)}
                aria-label="Collapse Q&A Chat"
              >
                <ChevronRight className="h-4 w-4" aria-hidden />
              </Button>
            </CardHeader>
            <CardContent className="flex min-h-0 flex-1 flex-col px-3 pb-3 pt-0">
              <CommentsPanelInner
                listingId={listingId}
                listerId={listerId}
                comments={comments}
                currentUserId={currentUserId}
                ownerListerSession={ownerListerSession}
                listerActiveViewingOthersListing={listerActiveViewingOthersListing}
                replyToId={replyToId}
                setReplyToId={setReplyToId}
                draft={draft}
                setDraft={setDraft}
                posting={posting || moderating}
                onPost={() => void handlePost()}
                onBan={(userId) => void handleBan(userId)}
                onRemoveComment={(id) => void handleRemove(id, "comment")}
                onRemoveThread={(id) => void handleRemove(id, "thread")}
              />
            </CardContent>
          </Card>
        )}
        </div>
      </aside>

      {/* Mobile: floating action + sheet */}
      <div className="xl:hidden">
        <div
          className="pointer-events-none fixed right-4 z-[35] xl:hidden"
          style={{ bottom: MOBILE_BOTTOM_NAV_FAB_OFFSET }}
        >
          <div className="pointer-events-auto relative">
            <Button
              type="button"
              size="icon"
              className="h-14 w-14 rounded-full border border-border/80 bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 dark:border-gray-700"
              onClick={() => setSheetOpen(true)}
              aria-label="Open Q&A Chat"
            >
              <MessageSquare className="h-6 w-6" aria-hidden />
            </Button>
            {unreadBadge}
          </div>
        </div>
        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetContent
            side="bottom"
            title="Q&A Chat"
            scrollableBody={false}
            className="flex h-[min(88dvh,560px)] flex-col rounded-t-2xl p-0 dark:border-gray-800"
          >
            <div className="flex h-full min-h-0 flex-1 flex-col px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2">
              <div className="mb-2 shrink-0 text-center">
                <p className="text-sm font-semibold text-foreground dark:text-gray-100">Q&amp;A Chat</p>
                <p className="text-xs text-muted-foreground dark:text-gray-500">Public questions for this listing</p>
              </div>
              <CommentsPanelInner
                listingId={listingId}
                listerId={listerId}
                comments={comments}
                currentUserId={currentUserId}
                ownerListerSession={ownerListerSession}
                listerActiveViewingOthersListing={listerActiveViewingOthersListing}
                replyToId={replyToId}
                setReplyToId={setReplyToId}
                draft={draft}
                setDraft={setDraft}
                posting={posting || moderating}
                onPost={() => void handlePost()}
                onBan={(userId) => void handleBan(userId)}
                onRemoveComment={(id) => void handleRemove(id, "comment")}
                onRemoveThread={(id) => void handleRemove(id, "thread")}
              />
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
}
