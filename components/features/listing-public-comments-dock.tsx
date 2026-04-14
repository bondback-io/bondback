"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { MessageSquare, ChevronLeft, ChevronRight, Loader2, CornerDownRight } from "lucide-react";
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
import { useToast } from "@/components/ui/use-toast";
import Link from "next/link";

export type ListingPublicCommentsDockProps = {
  listingId: string;
  listerId: string;
  initialComments: ListingCommentPublic[];
  currentUserId: string | null;
};

function sortByCreated(a: ListingCommentPublic, b: ListingCommentPublic) {
  return a.created_at.localeCompare(b.created_at);
}

function CommentBlock({
  c,
  onReply,
}: {
  c: ListingCommentPublic;
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
    </div>
  );
}

function CommentsThreadTree({
  comments,
  onReply,
}: {
  comments: ListingCommentPublic[];
  listerId: string;
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

  const renderBranch = (parentId: string | null, depth: number): React.ReactNode => {
    const items = byParent.get(parentId) ?? [];
    return items.map((c) => (
      <div key={c.id} className={cn(depth > 0 && "mt-2 space-y-2 border-l-2 border-primary/30 pl-3")}>
        <CommentBlock c={c} onReply={onReply} />
        {renderBranch(c.id, depth + 1)}
      </div>
    ));
  };

  const roots = byParent.get(null) ?? [];
  if (roots.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground dark:text-gray-500">
        No comments yet. Be the first to ask a question.
      </p>
    );
  }

  return <div className="space-y-2">{renderBranch(null, 0)}</div>;
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
          hired.
        </p>
        {comments.length > 0 ? (
          <p className="mt-2 text-[11px] font-medium text-muted-foreground dark:text-gray-500">
            {comments.length} {comments.length === 1 ? "comment" : "comments"}
          </p>
        ) : null}
      </div>
      <ScrollArea className="min-h-0 flex-1 py-3 pr-2">
        <CommentsThreadTree
          comments={comments}
          listerId={listerId}
          onReply={setReplyToId}
        />
      </ScrollArea>
      <div className="shrink-0 space-y-2 border-t border-border pt-3 dark:border-gray-800">
        {!currentUserId ? (
          <p className="text-center text-sm text-muted-foreground dark:text-gray-400">
            <Link href={`/login?next=/listings/${encodeURIComponent(listingId)}`} className="font-medium text-primary underline-offset-4 hover:underline">
              Sign in
            </Link>{" "}
            to post a comment.
          </p>
        ) : (
          <>
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
              placeholder="Write a comment…"
              className="min-h-[88px] resize-none text-sm dark:border-gray-700 dark:bg-gray-900/80"
              maxLength={2000}
              disabled={posting}
            />
            <Button
              type="button"
              className="w-full"
              disabled={posting || !draft.trim()}
              onClick={onPost}
            >
              {posting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                  Posting…
                </>
              ) : (
                "Post comment"
              )}
            </Button>
          </>
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
}: ListingPublicCommentsDockProps) {
  const { toast } = useToast();
  const [comments, setComments] = useState<ListingCommentPublic[]>(initialComments);
  const [desktopCollapsed, setDesktopCollapsed] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [replyToId, setReplyToId] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);

  useEffect(() => {
    setComments(initialComments);
  }, [initialComments, listingId]);

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
        toast({ variant: "destructive", title: "Could not post", description: res.error });
        return false;
      }
      setComments((prev) => {
        if (prev.some((c) => c.id === res.comment.id)) return prev;
        return [...prev, res.comment].sort(sortByCreated);
      });
      setDraft("");
      setReplyToId(null);
      toast({ title: "Posted", description: "Your comment is visible on this listing." });
      if (opts?.closeMobileSheet) setSheetOpen(false);
      return true;
    } finally {
      setPosting(false);
    }
  };

  const badge =
    comments.length > 0 ? (
      <Badge variant="secondary" className="tabular-nums">
        {comments.length}
      </Badge>
    ) : null;

  return (
    <>
      {/* Desktop: sticky sidebar or collapsed rail */}
      <aside className="hidden xl:block">
        {desktopCollapsed ? (
          <button
            type="button"
            onClick={() => setDesktopCollapsed(false)}
            className="sticky top-24 flex w-full max-w-[52px] flex-col items-center gap-2 rounded-2xl border border-border bg-card py-4 shadow-sm transition hover:bg-muted/40 dark:border-gray-800 dark:bg-gray-950 dark:hover:bg-gray-900/80"
            aria-expanded={false}
            aria-label="Expand public comments"
          >
            <MessageSquare className="h-5 w-5 text-muted-foreground" aria-hidden />
            {badge}
            <ChevronLeft className="h-4 w-4 text-muted-foreground" aria-hidden />
          </button>
        ) : (
          <Card className="sticky top-24 flex max-h-[min(720px,calc(100vh-5.5rem))] flex-col overflow-hidden border-border shadow-sm dark:border-gray-800 dark:bg-gray-950">
            <CardHeader className="flex shrink-0 flex-row items-center justify-between space-y-0 border-b border-border py-3 dark:border-gray-800">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <MessageSquare className="h-4 w-4" aria-hidden />
                Q&amp;A
                {badge}
              </CardTitle>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0"
                onClick={() => setDesktopCollapsed(true)}
                aria-label="Collapse public comments"
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
      </aside>

      {/* Mobile trigger + sheet */}
      <div className="xl:hidden">
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <div className="pointer-events-auto w-full max-w-md">
            <Button
              type="button"
              variant="secondary"
              className="h-12 w-full rounded-2xl border border-border/80 bg-background/95 shadow-lg backdrop-blur dark:border-gray-700 dark:bg-gray-950/95"
              onClick={() => setSheetOpen(true)}
            >
              <MessageSquare className="mr-2 h-4 w-4 shrink-0" aria-hidden />
              <span className="font-medium">Ask a question</span>
              {badge ? <span className="ml-2">{badge}</span> : null}
            </Button>
          </div>
        </div>
        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetContent
            side="bottom"
            title="Public questions and comments"
            className="flex h-[min(88dvh,640px)] flex-col rounded-t-2xl dark:border-gray-800"
          >
            <div className="flex min-h-0 flex-1 flex-col px-1 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
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
