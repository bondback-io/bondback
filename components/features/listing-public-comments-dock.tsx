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
  /** Unread in-app Q&A notifications for this listing (server count). */
  initialQaUnreadCount?: number;
};

function sortByCreated(a: ListingCommentPublic, b: ListingCommentPublic) {
  return a.created_at.localeCompare(b.created_at);
}

function CommentBlock({
  c,
  showReplyButton,
  onReply,
}: {
  c: ListingCommentPublic;
  showReplyButton: boolean;
  onReply: (id: string) => void;
}) {
  const rel = formatDistanceToNow(new Date(c.created_at), { addSuffix: true });
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
      {showReplyButton ? (
        <div className="mt-2 flex justify-end">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 text-xs text-muted-foreground hover:text-foreground"
            onClick={() => onReply(c.id)}
          >
            Reply
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function GroupedCommentThreads({
  comments,
  listerId,
  currentUserId,
  onReply,
}: {
  comments: ListingCommentPublic[];
  listerId: string;
  currentUserId: string | null;
  onReply: (id: string) => void;
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
        No comments yet. Be the first to ask a question.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {roots.map((root) => {
        const replies = byParent.get(root.id) ?? [];
        const canListerReply =
          Boolean(currentUserId) &&
          String(currentUserId) === String(listerId) &&
          String(root.user_id) !== String(listerId);
        const replyLabel =
          replies.length === 0
            ? "No replies yet"
            : replies.length === 1
              ? "1 lister reply"
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
              <CommentBlock c={root} showReplyButton={canListerReply} onReply={onReply} />
              {replies.map((r) => (
                <div
                  key={r.id}
                  className="border-l-2 border-primary/25 pl-3 dark:border-primary/35"
                >
                  <CommentBlock c={r} showReplyButton={false} onReply={onReply} />
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
  replyToId,
  setReplyToId,
  draft,
  setDraft,
  posting,
  onPost,
}: {
  listingId: string;
  listerId: string;
  comments: ListingCommentPublic[];
  currentUserId: string | null;
  replyToId: string | null;
  setReplyToId: (id: string | null) => void;
  draft: string;
  setDraft: (s: string) => void;
  posting: boolean;
  onPost: () => void;
}) {
  const replyHint = replyToId
    ? comments.find((c) => c.id === replyToId)?.author_display_name
    : null;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 border-b border-border px-1 pb-3 dark:border-gray-800">
        <h2 className="text-base font-semibold tracking-tight text-foreground dark:text-gray-100">
          Public questions &amp; comments
        </h2>
        <p className="mt-1 text-xs leading-snug text-muted-foreground dark:text-gray-500">
          Ask about the clean, timing, or access. No phone numbers or links — use in-app chat after you&apos;re
          hired. Only the lister can reply under each question.
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
          currentUserId={currentUserId}
          onReply={setReplyToId}
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
        ) : (
          <form
            className="contents"
            onSubmit={(e) => {
              e.preventDefault();
              if (posting || !draft.trim()) return;
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
              placeholder="Write a message…"
              className="min-h-[72px] resize-none text-sm dark:border-gray-700 dark:bg-gray-900/80 md:min-h-[88px]"
              maxLength={2000}
              disabled={posting}
              name="qa-message"
              autoComplete="off"
            />
            <Button
              type="submit"
              className="w-full touch-manipulation"
              disabled={posting || !draft.trim()}
            >
              {posting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                  Sending…
                </>
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
        .select("full_name, roles")
        .eq("id", row.user_id)
        .maybeSingle();
      const fullName = (p as { full_name?: string | null } | null)?.full_name;
      const roles = (p as { roles?: string[] | null } | null)?.roles;
      const name =
        (fullName ?? "").trim().length > 0
          ? (fullName as string).length > 48
            ? `${(fullName as string).slice(0, 47)}…`
            : (fullName as string)
          : "Member";
      const roleLabel =
        String(row.user_id) === String(listerId)
          ? ("Lister" as const)
          : Array.isArray(roles) && roles.map((x) => String(x).toLowerCase()).includes("cleaner")
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
                replyToId={replyToId}
                setReplyToId={setReplyToId}
                draft={draft}
                setDraft={setDraft}
                posting={posting}
                onPost={() => void handlePost()}
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
                replyToId={replyToId}
                setReplyToId={setReplyToId}
                draft={draft}
                setDraft={setDraft}
                posting={posting}
                onPost={() => void handlePost({ closeMobileSheet: true })}
              />
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
}
