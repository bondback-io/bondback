"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { formatDistanceToNow } from "date-fns";
import {
  MessageSquare,
  ChevronLeft,
  ChevronRight,
  Loader2,
  CornerDownRight,
  ChevronDown,
  Star,
  BadgeCheck,
  MoreHorizontal,
} from "lucide-react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import {
  banCleanerFromListingQa,
  removeListingComment,
  postListingComment,
  type ListingCommentPublic,
} from "@/lib/actions/listing-comments";
import { markListingQaNotificationsRead } from "@/lib/actions/notifications";
import { qaAuthorDisplayName } from "@/lib/listing-qa-display-name";
import {
  inferLegacyPostedAsRole,
  listingCommentAuthorRoleLabel,
  parsePostedAsRole,
  rootThreadAllowsListerReply,
} from "@/lib/listing-comment-author-role";
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
  /**
   * Desktop (`xl+`): default `sidebar` caps width (~320px) for the listing two-column layout.
   * Use `fullWidth` when the dock is the main content in a wide panel (e.g. Find Jobs detail column).
   */
  desktopLayout?: "sidebar" | "fullWidth";
};

type UiComment = ListingCommentPublic & { optimistic?: boolean };

/** Long Q&A bodies collapse like Airtasker “More”. */
const QA_MESSAGE_PREVIEW_CHARS = 280;

function sortByCreated(a: UiComment, b: UiComment) {
  return a.created_at.localeCompare(b.created_at);
}

function CommentAvatar({
  name,
  photoUrl,
  size = "md",
}: {
  name: string;
  photoUrl?: string | null;
  size?: "md" | "lg";
}) {
  const dim = size === "lg" ? "h-11 w-11 text-[12px]" : "h-9 w-9 text-[11px]";
  const src = String(photoUrl ?? "").trim();
  const initials =
    String(name || "M")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? "")
      .join("") || "M";
  if (src) {
    return (
      <img
        src={src}
        alt={name || "Member"}
        className={cn(
          "shrink-0 rounded-full border border-border/70 object-cover dark:border-gray-700",
          dim
        )}
        loading="lazy"
      />
    );
  }
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full border border-border/70 bg-muted font-semibold text-muted-foreground dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300",
        dim
      )}
    >
      {initials}
    </div>
  );
}

function QaMessageBody({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  const shouldTruncate = text.length > QA_MESSAGE_PREVIEW_CHARS;
  const display =
    expanded || !shouldTruncate
      ? text
      : `${text.slice(0, QA_MESSAGE_PREVIEW_CHARS).trimEnd()}…`;

  return (
    <div className="rounded-lg bg-muted/50 px-3.5 py-3 dark:bg-gray-800/45">
      <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground/95 dark:text-gray-200">
        {display}
      </p>
      {shouldTruncate && !expanded ? (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="mt-2 inline-flex items-center gap-0.5 text-sm font-medium text-primary hover:underline"
        >
          More
          <ChevronDown className="h-4 w-4" aria-hidden />
        </button>
      ) : null}
    </div>
  );
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
  c: UiComment;
  root: UiComment;
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
  const hasActions = canReply || canModerate;

  const isCleaner = c.author_role_label === "Cleaner";
  const verified =
    Array.isArray(c.author_verification_badges) && c.author_verification_badges.length > 0;
  const ratingAvg = c.author_cleaner_avg_rating;
  const ratingN = c.author_cleaner_total_reviews;
  const hasRating =
    typeof ratingAvg === "number" && Number.isFinite(ratingAvg) && ratingAvg > 0;
  const abnTrim = String(c.author_abn ?? "").trim();

  return (
    <div className="flex gap-3">
      <CommentAvatar
        name={c.author_display_name}
        photoUrl={c.author_avatar_url}
        size="lg"
      />
      <div className="min-w-0 flex-1 space-y-2">
        <div className="min-w-0 space-y-1">
          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            <span className="truncate text-sm font-semibold text-foreground dark:text-gray-100">
              {c.author_display_name}
            </span>
            {verified ? (
              <BadgeCheck
                className="h-4 w-4 shrink-0 text-primary"
                aria-label="Verified"
              />
            ) : null}
          </div>
          <Badge
            variant="secondary"
            className={cn(
              "text-[10px] font-semibold uppercase tracking-wide",
              isCleaner &&
                "border border-emerald-500/35 bg-emerald-500/10 text-emerald-900 dark:text-emerald-200"
            )}
          >
            {c.author_role_label}
          </Badge>
          {isCleaner ? (
            <div className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground dark:text-gray-400">
              <Star
                className={cn(
                  "h-3.5 w-3.5 shrink-0",
                  hasRating ? "fill-amber-400 text-amber-500" : "text-muted-foreground/60"
                )}
                aria-hidden
              />
              {hasRating ? (
                <>
                  <span className="font-medium text-foreground/90 dark:text-gray-200">
                    {ratingAvg.toFixed(1)}
                  </span>
                  <span className="text-muted-foreground">
                    ({typeof ratingN === "number" && ratingN > 0 ? ratingN : 0})
                  </span>
                </>
              ) : (
                <span>No reviews yet</span>
              )}
            </div>
          ) : null}
          {isCleaner ? (
            <p className="text-xs text-muted-foreground dark:text-gray-500">
              {abnTrim ? `ABN on file` : `No ABN on profile`}
            </p>
          ) : null}
          {c.author_banned ? (
            <p className="text-[10px] font-semibold uppercase tracking-wide text-destructive">
              Banned from Q&amp;A
            </p>
          ) : null}
        </div>

        <QaMessageBody text={c.message_text} />

        <div className="flex items-center justify-between gap-2">
          <time
            className="text-[11px] text-muted-foreground dark:text-gray-500"
            dateTime={c.created_at}
          >
            {rel}
          </time>
          {hasActions ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground"
                  aria-label="Message actions"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-[10rem] dark:border-gray-800 dark:bg-gray-900">
                {canReply ? (
                  <DropdownMenuItem
                    onClick={() => onReply(c.id)}
                    disabled={c.author_banned && !commenterIsCurrentUser}
                  >
                    Reply
                  </DropdownMenuItem>
                ) : null}
                {canBan ? (
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={() => onBan(c.user_id)}
                  >
                    Ban cleaner
                  </DropdownMenuItem>
                ) : null}
                {canModerate ? (
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={() => onRemoveComment(c.id)}
                  >
                    Remove post
                  </DropdownMenuItem>
                ) : null}
                {canModerate && c.parent_comment_id == null ? (
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={() => onRemoveThread(c.id)}
                  >
                    Remove thread
                  </DropdownMenuItem>
                ) : null}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>
        {c.optimistic ? (
          <p className="text-[11px] font-medium text-muted-foreground dark:text-gray-500">
            Sending...
          </p>
        ) : null}
      </div>
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
  comments: UiComment[];
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
    const m = new Map<string | null, UiComment[]>();
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
    <div className="space-y-4">
      {roots.map((root) => {
        const replies = byParent.get(root.id) ?? [];
        const canListerReply =
          ownerListerSession &&
          rootThreadAllowsListerReply({
            rootUserId: root.user_id,
            listerId,
            posted_as_role: root.posted_as_role,
          });
        const replyLabel =
          replies.length === 0
            ? "No replies yet"
            : replies.length === 1
              ? "1 reply"
              : `${replies.length} replies`;

        return (
          <section
            key={root.id}
            className="rounded-xl border border-border/70 bg-card/50 p-3 shadow-sm dark:border-gray-800 dark:bg-gray-950/35"
            aria-label={`Thread from ${root.author_display_name}, ${replyLabel}.`}
          >
            <p className="mb-3 text-[11px] font-medium text-muted-foreground dark:text-gray-500">
              {replyLabel}
            </p>
            <div className="space-y-4">
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
                  className="border-l-2 border-primary/20 pl-3 dark:border-primary/30"
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
          </section>
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
  comments: UiComment[];
  currentUserId: string | null;
  ownerListerSession: boolean;
  listerActiveViewingOthersListing: boolean;
  replyToId: string | null;
  setReplyToId: (id: string | null) => void;
  draft: string;
  setDraft: (s: string) => void;
  posting: boolean;
  onPost: () => Promise<boolean>;
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
  const cleanerAlreadyStartedThread =
    Boolean(currentUserId) &&
    !ownerListerSession &&
    comments.some(
      (c) =>
        c.parent_comment_id == null &&
        String(c.user_id) === String(currentUserId)
    );

  const composerDisabledForListerOwner = ownerListerSession && !replyToId;
  const composerDisabledForCleanerExistingThread =
    cleanerAlreadyStartedThread && !replyToId;

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
            To respond, choose a question above and tap{" "}
            <span className="font-medium text-foreground dark:text-gray-200">Reply</span> — you can&apos;t
            post a new thread as the lister.
          </p>
        ) : (
          <form
            className="contents"
            onSubmit={async (e) => {
              e.preventDefault();
              if (posting || !draft.trim()) return;
              if (ownerListerSession && !replyToId) return;
              if (cleanerAlreadyStartedThread && !replyToId) return;
              await onPost();
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
              onKeyDown={async (e: ReactKeyboardEvent<HTMLTextAreaElement>) => {
                if (e.key !== "Enter" || e.shiftKey) return;
                e.preventDefault();
                if (posting || !draft.trim()) return;
                if (ownerListerSession && !replyToId) return;
                if (cleanerAlreadyStartedThread && !replyToId) return;
                await onPost();
              }}
              placeholder={replyToId ? "Write your reply…" : "Write a message…"}
              className="min-h-[72px] resize-none text-base dark:border-gray-700 dark:bg-gray-900/80 md:min-h-[88px] md:text-sm"
              maxLength={2000}
              disabled={posting}
              name="qa-message"
              autoComplete="off"
            />
            {composerDisabledForCleanerExistingThread ? (
              <p className="text-xs font-medium text-muted-foreground dark:text-gray-400">
                You&apos;ve started a message already, please use the reply.
              </p>
            ) : null}
            <Button
              type="submit"
              className="w-full touch-manipulation"
              disabled={
                posting ||
                !draft.trim() ||
                (ownerListerSession && !replyToId) ||
                composerDisabledForCleanerExistingThread
              }
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
  desktopLayout = "sidebar",
}: ListingPublicCommentsDockProps) {
  const { toast } = useToast();
  const [comments, setComments] = useState<UiComment[]>(initialComments);
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

  /**
   * Mobile Q&A FAB: replay a short wiggle every 10s so the control reads as “available”.
   * Paused while the sheet is open; skipped when the user prefers reduced motion.
   */
  const [mobileQaFabAttentionGen, setMobileQaFabAttentionGen] = useState(0);
  useEffect(() => {
    if (sheetOpen) return;
    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }
    const id = window.setInterval(() => {
      setMobileQaFabAttentionGen((g) => g + 1);
    }, 10_000);
    return () => window.clearInterval(id);
  }, [sheetOpen]);

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
      posted_as_role?: string | null;
    }): Promise<ListingCommentPublic> => {
      const supabase = createBrowserSupabaseClient();
      const { data: p } = await supabase
        .from("profiles")
        .select(
          "full_name, roles, active_role, cleaner_username, profile_photo_url, abn, cleaner_avg_rating, cleaner_total_reviews, verification_badges"
        )
        .eq("id", row.user_id)
        .maybeSingle();
      const fullName = (p as { full_name?: string | null } | null)?.full_name;
      const cleanerUsername = (p as { cleaner_username?: string | null } | null)?.cleaner_username;
      const roles = (p as { roles?: string[] | null } | null)?.roles;
      const avatarUrl = (p as { profile_photo_url?: string | null } | null)?.profile_photo_url;
      const abn = (p as { abn?: string | null } | null)?.abn ?? null;
      const cleanerAvgRating = (p as { cleaner_avg_rating?: number | null } | null)?.cleaner_avg_rating ?? null;
      const cleanerTotalReviews =
        (p as { cleaner_total_reviews?: number | null } | null)?.cleaner_total_reviews ?? null;
      const verificationBadges = (p as { verification_badges?: string[] | null } | null)?.verification_badges;
      const name = qaAuthorDisplayName({
        userId: String(row.user_id),
        listerId,
        fullName,
        cleanerUsername,
        roles,
        fallback: "Member",
      });
      const posted =
        parsePostedAsRole(row.posted_as_role) ??
        inferLegacyPostedAsRole({
          userId: String(row.user_id),
          listerId,
          parentCommentId: row.parent_comment_id,
        });
      const roleLabel = listingCommentAuthorRoleLabel({
        userId: String(row.user_id),
        listerId,
        roles,
        posted_as_role: posted,
      });
      return {
        id: row.id,
        listing_id: row.listing_id,
        user_id: row.user_id,
        parent_comment_id: row.parent_comment_id,
        message_text: row.message_text,
        created_at: row.created_at,
        author_display_name: name,
        author_avatar_url: avatarUrl ?? null,
        author_role_label: roleLabel,
        posted_as_role: posted,
        author_cleaner_avg_rating: cleanerAvgRating,
        author_cleaner_total_reviews: cleanerTotalReviews,
        author_abn: abn,
        author_verification_badges: verificationBadges?.length ? verificationBadges : null,
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
            posted_as_role?: string | null;
          };
          if (!row?.id) return;
          const enriched = await enrichInsert(row);
          setComments((prev) => {
            const knownAuthor = prev.find(
              (c) =>
                String(c.user_id) === String(row.user_id) &&
                !c.optimistic &&
                (String(c.author_display_name ?? "").trim().toLowerCase() !== "member" ||
                  String(c.author_avatar_url ?? "").trim().length > 0)
            );
            const mergedEnriched: UiComment = knownAuthor
              ? {
                  ...enriched,
                  author_display_name:
                    String(enriched.author_display_name ?? "").trim().toLowerCase() === "member"
                      ? knownAuthor.author_display_name
                      : enriched.author_display_name,
                  author_avatar_url: enriched.author_avatar_url ?? knownAuthor.author_avatar_url ?? null,
                  author_cleaner_avg_rating:
                    enriched.author_cleaner_avg_rating ?? knownAuthor.author_cleaner_avg_rating ?? null,
                  author_cleaner_total_reviews:
                    enriched.author_cleaner_total_reviews ?? knownAuthor.author_cleaner_total_reviews ?? null,
                  author_abn: enriched.author_abn ?? knownAuthor.author_abn ?? null,
                  author_verification_badges:
                    enriched.author_verification_badges ?? knownAuthor.author_verification_badges ?? null,
                }
              : enriched;
            if (prev.some((c) => c.id === row.id)) return prev;
            const optimisticIdx = prev.findIndex(
              (c) =>
                c.optimistic &&
                String(c.user_id) === String(row.user_id) &&
                String(c.parent_comment_id ?? "") === String(row.parent_comment_id ?? "") &&
                c.message_text === row.message_text
            );
            if (optimisticIdx >= 0) {
              const next = [...prev];
              next[optimisticIdx] = mergedEnriched;
              return next.sort(sortByCreated);
            }
            return [...prev, mergedEnriched].sort(sortByCreated);
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
    if (!ownerListerSession && comments.some(
      (c) =>
        c.parent_comment_id == null &&
        String(c.user_id) === String(currentUserId)
    ) && replyToId == null) {
      return false;
    }
    const message = draft.trim();
    const replyingTo = replyToId;
    const previousDraft = draft;
    const previousReplyTo = replyToId;
    const existingSelf = [...comments]
      .reverse()
      .find((c) => String(c.user_id) === String(currentUserId));
    const optimisticRoleLabel =
      existingSelf?.author_role_label ??
      (String(currentUserId) === String(listerId)
        ? ownerListerSession
          ? "Lister"
          : "Cleaner"
        : "Cleaner");
    const optimisticPostedRole =
      optimisticRoleLabel === "Lister"
        ? "lister"
        : optimisticRoleLabel === "Cleaner"
          ? "cleaner"
          : "member";
    const optimisticId = `optimistic-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const optimisticComment: UiComment = {
      id: optimisticId,
      listing_id: listingId,
      user_id: currentUserId,
      parent_comment_id: replyingTo,
      message_text: message,
      created_at: new Date().toISOString(),
      author_display_name: existingSelf?.author_display_name ?? "You",
      author_avatar_url: existingSelf?.author_avatar_url ?? null,
      author_role_label: optimisticRoleLabel,
      posted_as_role: optimisticPostedRole,
      author_banned: false,
      author_cleaner_avg_rating: existingSelf?.author_cleaner_avg_rating ?? null,
      author_cleaner_total_reviews: existingSelf?.author_cleaner_total_reviews ?? null,
      author_abn: existingSelf?.author_abn ?? null,
      author_verification_badges: existingSelf?.author_verification_badges ?? null,
      optimistic: true,
    };
    setComments((prev) => [...prev, optimisticComment].sort(sortByCreated));
    setDraft("");
    setReplyToId(null);
    setPosting(true);
    try {
      const res = await postListingComment({
        listingId,
        message,
        parentCommentId: replyingTo,
      });
      if (!res.ok) {
        setComments((prev) => prev.filter((c) => c.id !== optimisticId));
        setDraft(previousDraft);
        setReplyToId(previousReplyTo);
        toast({ variant: "destructive", title: "Could not send", description: res.error });
        return false;
      }
      setComments((prev) => {
        const withoutOptimistic = prev.filter((c) => c.id !== optimisticId);
        if (withoutOptimistic.some((c) => c.id === res.comment.id)) return withoutOptimistic;
        return [...withoutOptimistic, res.comment].sort(sortByCreated);
      });
      if (opts?.closeMobileSheet) setSheetOpen(false);
      return true;
    } catch (e: unknown) {
      setComments((prev) => prev.filter((c) => c.id !== optimisticId));
      setDraft(previousDraft);
      setReplyToId(previousReplyTo);
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

  const desktopDockNarrow =
    desktopLayout === "sidebar"
      ? "xl:max-w-[min(100%,320px)] xl:justify-end xl:justify-self-end"
      : "xl:max-w-none xl:justify-stretch";

  return (
    <>
      {/* Desktop: column stretches with grid row so sticky can ride full listing scroll */}
      <aside
        className={cn(
          "hidden xl:flex xl:h-full xl:min-h-0 xl:w-full xl:items-start",
          desktopDockNarrow
        )}
      >
        <div
          className={cn(
            "xl:sticky xl:z-10 xl:w-full xl:self-start",
            desktopLayout === "sidebar"
              ? "xl:max-w-[min(100%,320px)]"
              : "xl:max-w-none",
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
          <Card
            className={cn(
              "flex max-h-[min(560px,calc(100dvh-5rem-env(safe-area-inset-top,0px)))] flex-col overflow-hidden border-border shadow-sm dark:border-gray-800 dark:bg-gray-950",
              desktopLayout === "fullWidth" && "w-full"
            )}
          >
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
                onPost={() => handlePost()}
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
              {/* Key + animation on a wrapper (not the SVG): iOS compositor often skips transform keyframes on lucide SVG roots. Reduced motion users skip the interval entirely above. */}
              <span
                key={mobileQaFabAttentionGen}
                className={cn(
                  "inline-flex shrink-0 items-center justify-center",
                  mobileQaFabAttentionGen > 0 && "animate-qa-fab-attention"
                )}
              >
                <MessageSquare className="h-6 w-6" aria-hidden />
              </span>
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
                onPost={() => handlePost()}
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
