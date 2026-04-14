"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { moderateListingCommentText } from "@/lib/listing-comment-moderation";
import { shouldShowPublicListingComments } from "@/lib/listing-public-comments-visibility";
import { createNotification } from "@/lib/actions/notifications";
import { qaAuthorDisplayName } from "@/lib/listing-qa-display-name";
import {
  inferLegacyPostedAsRole,
  listingCommentAuthorRoleLabel,
  parsePostedAsRole,
  type ListingCommentPostedAsRole,
} from "@/lib/listing-comment-author-role";

type ListingRow = Database["public"]["Tables"]["listings"]["Row"];
type ListingCommentRow = Database["public"]["Tables"]["listing_comments"]["Row"];
type ProfileMiniRow = Pick<
  Database["public"]["Tables"]["profiles"]["Row"],
  "id" | "full_name" | "roles" | "cleaner_username"
>;

export type ListingCommentPublic = {
  id: string;
  listing_id: string;
  user_id: string;
  parent_comment_id: string | null;
  message_text: string;
  created_at: string;
  author_display_name: string;
  author_role_label: "Lister" | "Cleaner" | "Member";
  /** Role context at post time; drives labels when user_id equals lister_id (dual role). */
  posted_as_role?: ListingCommentPostedAsRole | null;
  /** True when this author is banned from further Q&A participation on this listing. */
  author_banned?: boolean;
};

function normalizeRoles(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.map((r) => String(r).toLowerCase().trim()).filter(Boolean);
  }
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed) return [];
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed.map((r) => String(r).toLowerCase().trim()).filter(Boolean);
      }
    } catch {
      // not JSON array; fallback to comma-separated/plain token
    }
    if (trimmed.includes(",")) {
      return trimmed
        .split(",")
        .map((r) => r.toLowerCase().trim())
        .filter(Boolean);
    }
    return [trimmed.toLowerCase()];
  }
  return [];
}

type QaBanRow = {
  listing_id: string;
  user_id: string;
  banned_by_user_id: string;
  reason: string | null;
  created_at: string;
};

type SupabaseReadClientLike = {
  from: (table: string) => any;
};

async function getListingQaBannedUsersMap(
  readClient: SupabaseReadClientLike,
  listingId: string
): Promise<Map<string, QaBanRow>> {
  const { data, error } = await (readClient as any)
    .from("listing_comment_bans")
    .select("listing_id, user_id, banned_by_user_id, reason, created_at")
    .eq("listing_id", listingId);
  if (error) {
    // Backward-compatible fallback when migration has not been applied yet.
    if (/relation .*listing_comment_bans.* does not exist/i.test(error.message ?? "")) {
      return new Map();
    }
    console.warn("[getListingQaBannedUsersMap]", error.message);
    return new Map();
  }

  const rows = (data ?? []) as QaBanRow[];
  return new Map(rows.map((r) => [String(r.user_id), r]));
}

type CommentRowWithRole = {
  id: string;
  listing_id: string;
  user_id: string;
  parent_comment_id: string | null;
  posted_as_role: string | null;
};

async function fetchCommentRowWithRole(
  readClient: SupabaseReadClientLike,
  id: string
): Promise<CommentRowWithRole | null> {
  const { data, error } = await readClient
    .from("listing_comments")
    .select("id, listing_id, user_id, parent_comment_id, posted_as_role")
    .eq("id", id)
    .maybeSingle();

  if (error && /posted_as_role|column/i.test(error.message ?? "")) {
    const { data: legacy } = await readClient
      .from("listing_comments")
      .select("id, listing_id, user_id, parent_comment_id")
      .eq("id", id)
      .maybeSingle();
    if (!legacy) return null;
    const l = legacy as Omit<CommentRowWithRole, "posted_as_role">;
    return { ...l, posted_as_role: null };
  }

  if (!data) return null;
  return data as CommentRowWithRole;
}

async function getRootCommentForThread(
  readClient: SupabaseReadClientLike,
  commentId: string
): Promise<CommentRowWithRole | null> {
  const start = await fetchCommentRowWithRole(readClient, commentId);
  if (!start) return null;
  if (!start.parent_comment_id) return start;

  const root = await fetchCommentRowWithRole(readClient, start.parent_comment_id);
  return root ?? start;
}

/** Server load for listing page — works with anon session for public read. */
export async function fetchListingCommentsPublic(
  listingId: string,
  listerId: string
): Promise<ListingCommentPublic[]> {
  const supabase = await createServerSupabaseClient();
  type RowWithOptionalRole = ListingCommentRow & { posted_as_role?: string | null };
  let rows: RowWithOptionalRole[] | null = null;
  let error: { message?: string } | null = null;

  const selWithRole = await supabase
    .from("listing_comments")
    .select("id, listing_id, user_id, parent_comment_id, message_text, created_at, posted_as_role")
    .eq("listing_id", listingId)
    .order("created_at", { ascending: true });

  if (selWithRole.error && /posted_as_role|column/i.test(selWithRole.error.message ?? "")) {
    const legacy = await supabase
      .from("listing_comments")
      .select("id, listing_id, user_id, parent_comment_id, message_text, created_at")
      .eq("listing_id", listingId)
      .order("created_at", { ascending: true });
    rows = (legacy.data ?? null) as RowWithOptionalRole[] | null;
    error = legacy.error;
  } else {
    rows = (selWithRole.data ?? null) as RowWithOptionalRole[] | null;
    error = selWithRole.error;
  }

  if (error || !rows?.length) {
    if (error && !/listing_comments/.test(error.message ?? "")) {
      console.warn("[fetchListingCommentsPublic]", error.message);
    }
    return [];
  }

  const typedRows = rows;
  const banMap = await getListingQaBannedUsersMap(supabase, listingId);
  const userIds = [...new Set(typedRows.map((r) => r.user_id))];
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name, roles, cleaner_username")
    .in("id", userIds);

  const byUser = new Map(
    ((profiles ?? []) as ProfileMiniRow[]).map((p) => [
      p.id,
      {
        full_name: p.full_name as string | null,
        roles: p.roles as string[] | null,
        cleaner_username: p.cleaner_username as string | null,
      },
    ])
  );

  return typedRows.map((r) => {
    const p = byUser.get(r.user_id);
    const postedAs =
      parsePostedAsRole(r.posted_as_role) ??
      inferLegacyPostedAsRole({
        userId: String(r.user_id),
        listerId,
        parentCommentId: r.parent_comment_id,
      });
    return {
      id: r.id,
      listing_id: r.listing_id,
      user_id: r.user_id,
      parent_comment_id: r.parent_comment_id,
      message_text: r.message_text,
      created_at: r.created_at,
      author_display_name: qaAuthorDisplayName({
        userId: String(r.user_id),
        listerId,
        fullName: p?.full_name,
        cleanerUsername: p?.cleaner_username,
        roles: p?.roles,
        fallback: "Member",
      }),
      author_role_label: listingCommentAuthorRoleLabel({
        userId: String(r.user_id),
        listerId,
        roles: p?.roles,
        posted_as_role: postedAs,
      }),
      posted_as_role: postedAs,
      author_banned: banMap.has(String(r.user_id)),
    };
  });
}

export type PostListingCommentResult =
  | { ok: true; comment: ListingCommentPublic }
  | { ok: false; error: string };

export async function postListingComment(params: {
  listingId: string;
  message: string;
  parentCommentId: string | null;
}): Promise<PostListingCommentResult> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    return { ok: false, error: "Sign in to post a comment." };
  }

  const mod = moderateListingCommentText(params.message);
  if (!mod.ok) return { ok: false, error: mod.error };

  try {
    const admin = createSupabaseAdminClient();
    const readClient = (admin ?? supabase) as SupabaseClient<Database>;

    const { data: listing, error: listErr } = await readClient
      .from("listings")
      .select("id, lister_id, status, end_time, cancelled_early_at, title")
      .eq("id", params.listingId)
      .maybeSingle();

    if (listErr || !listing) {
      return { ok: false, error: "Listing not found." };
    }

    const row = listing as ListingRow;
    const { data: jobRow } = await readClient
      .from("jobs")
      .select("id, status")
      .eq("listing_id", params.listingId)
      .maybeSingle();

    const hasActiveJob =
      !!jobRow && String((jobRow as { status?: string }).status ?? "").toLowerCase() !== "cancelled";

    if (!shouldShowPublicListingComments(row, hasActiveJob)) {
      return { ok: false, error: "Comments are closed for this listing." };
    }

    const listerId = String(row.lister_id);
    const banMap = await getListingQaBannedUsersMap(readClient, params.listingId);
    if (banMap.has(String(session.user.id))) {
      return { ok: false, error: "You are banned from posting in this listing Q&A." };
    }

    const { data: posterProfile } = await readClient
      .from("profiles")
      .select("roles, full_name, active_role, cleaner_username")
      .eq("id", session.user.id)
      .maybeSingle();

    const rolesLower = normalizeRoles(
      (posterProfile as { roles?: unknown } | null)?.roles ?? []
    );
    const hasCleanerRole = rolesLower.includes("cleaner");
    const hasListerRole = rolesLower.includes("lister");
    const activeRoleRaw = (posterProfile as { active_role?: string | null } | null)?.active_role;
    const activeRoleResolved =
      (typeof activeRoleRaw === "string" && activeRoleRaw.trim()
        ? activeRoleRaw.trim().toLowerCase()
        : null) ?? (rolesLower[0] ?? null);
  /** Matches listing detail page: browsing as cleaner on own listing can start Q&A threads. */
    const isActiveCleanerSession = activeRoleResolved === "cleaner" && hasCleanerRole;
  /** Replying as property owner requires Lister mode when the user has both roles. */
    const isActiveListerSession = activeRoleResolved === "lister" && hasListerRole;

    const ownsThisListing = String(session.user.id) === listerId;
    if (!ownsThisListing && isActiveListerSession) {
      return {
        ok: false,
        error:
          "Listers can't post in Q&A on other people's listings. Switch to Cleaner in the header to ask a question.",
      };
    }

    let insertParentId: string | null = params.parentCommentId;
    let postedAsRoleForInsert: ListingCommentPostedAsRole;

    if (params.parentCommentId) {
      const root = await getRootCommentForThread(readClient, params.parentCommentId);
      if (!root || String(root.listing_id) !== String(params.listingId)) {
        return { ok: false, error: "Invalid reply target." };
      }

      const rootAuthorId = String(root.user_id);
      const isRootAuthor = String(session.user.id) === rootAuthorId;
      const rootPosted =
        parsePostedAsRole(root.posted_as_role) ??
        inferLegacyPostedAsRole({
          userId: rootAuthorId,
          listerId,
          parentCommentId: root.parent_comment_id,
        });
      const rootThreadIsListerOnly =
        rootPosted === "lister" || (rootPosted == null && rootAuthorId === listerId);
      if (rootThreadIsListerOnly) {
        return { ok: false, error: "Replies are only allowed on cleaner-started threads." };
      }

      const canReplyAsLister = String(session.user.id) === listerId && isActiveListerSession;
      const canReplyAsThreadOwner = isRootAuthor;
      if (!canReplyAsLister && !canReplyAsThreadOwner) {
        return { ok: false, error: "Only the lister or the thread owner can reply here." };
      }
      /** Lister mode is required to answer *others'* questions; thread owners may reply in Cleaner mode. */
      if (
        String(session.user.id) === listerId &&
        !isActiveListerSession &&
        !canReplyAsThreadOwner
      ) {
        return {
          ok: false,
          error: "Switch to Lister in the header to reply to public questions on your listing.",
        };
      }
      if (canReplyAsThreadOwner && String(session.user.id) !== rootAuthorId) {
        return { ok: false, error: "You can only reply within your own thread." };
      }
      if (banMap.has(rootAuthorId)) {
        return { ok: false, error: "This thread owner is banned; replying is locked." };
      }
      postedAsRoleForInsert = canReplyAsLister
        ? "lister"
        : hasCleanerRole && isActiveCleanerSession
          ? "cleaner"
          : "member";
      // Keep all replies flattened under the root thread for simpler rendering/moderation.
      insertParentId = root.id;
    } else {
      postedAsRoleForInsert =
        String(session.user.id) === listerId
          ? "cleaner"
          : hasCleanerRole
            ? "cleaner"
            : "member";
      // Cleaner (or member) can only start one thread per listing.
      if (hasCleanerRole) {
        const { data: existingRoot } = await readClient
          .from("listing_comments")
          .select("id")
          .eq("listing_id", params.listingId)
          .eq("user_id", session.user.id)
          .is("parent_comment_id", null)
          .limit(1)
          .maybeSingle();
        if (existingRoot?.id) {
          return {
            ok: false,
            error: "You can only start one thread per listing. Reply in your existing thread instead.",
          };
        }
      }
      if (String(session.user.id) === listerId && !isActiveCleanerSession) {
        return {
          ok: false,
          error:
            "Only cleaners and other members can start a thread. Open a question and use Reply to respond.",
        };
      }
    }

    const { data: inserted, error: insErr } = await supabase
      .from("listing_comments")
      .insert({
        listing_id: params.listingId,
        user_id: session.user.id,
        parent_comment_id: insertParentId,
        message_text: mod.text,
        posted_as_role: postedAsRoleForInsert,
      } as never)
      .select("id, listing_id, user_id, parent_comment_id, message_text, created_at, posted_as_role")
      .single();

    if (insErr || !inserted) {
      const msg = insErr?.message ?? "Could not post comment.";
      if (/row-level security|RLS|policy/i.test(msg) || /relation.*does not exist/i.test(msg)) {
        return {
          ok: false,
          error:
            "Comments are not available yet. Ask your admin to run the listing_comments SQL migration.",
        };
      }
      if (/posted_as_role|column/i.test(msg)) {
        return {
          ok: false,
          error:
            "Q&A needs a quick database update. Ask your admin to apply the latest Supabase migration (listing_comments.posted_as_role).",
        };
      }
      return { ok: false, error: msg };
    }

    const ins = inserted as ListingCommentRow & { posted_as_role?: string | null };
    const prof = posterProfile as {
      full_name?: string | null;
      roles?: string[] | null;
      cleaner_username?: string | null;
    } | null;
    const postedPersisted = parsePostedAsRole(ins.posted_as_role) ?? postedAsRoleForInsert;
    const comment: ListingCommentPublic = {
      id: ins.id,
      listing_id: ins.listing_id,
      user_id: ins.user_id,
      parent_comment_id: ins.parent_comment_id,
      message_text: ins.message_text,
      created_at: ins.created_at,
      author_display_name: qaAuthorDisplayName({
        userId: String(session.user.id),
        listerId,
        fullName: prof?.full_name,
        cleanerUsername: prof?.cleaner_username,
        roles: prof?.roles,
        fallback: "Member",
      }),
      author_role_label: listingCommentAuthorRoleLabel({
        userId: String(session.user.id),
        listerId,
        roles: prof?.roles,
        posted_as_role: postedPersisted,
      }),
      posted_as_role: postedPersisted,
      author_banned: false,
    };

    revalidatePath(`/listings/${params.listingId}`);

    const snippet =
      mod.text.length > 120 ? `${mod.text.slice(0, 117)}…` : mod.text;
    const titleHint = (row.title ?? "").trim() || "A listing";

    const posterName = comment.author_display_name;

    async function qaNotifyAllowed(
    recipientId: string,
    kind: "in_app_qa_new_question" | "in_app_qa_lister_reply"
  ): Promise<boolean> {
    const { data: prof } = await readClient
      .from("profiles")
      .select("notification_preferences")
      .eq("id", recipientId)
      .maybeSingle();
    const np = (prof as { notification_preferences?: Record<string, boolean> | null } | null)
      ?.notification_preferences;
    return np?.[kind] !== false;
  }

    if (params.parentCommentId) {
    const root = await getRootCommentForThread(readClient, params.parentCommentId);
    const askerId = String(root?.user_id ?? "");
    if (
      askerId &&
      askerId !== session.user.id &&
      (await qaNotifyAllowed(askerId, "in_app_qa_lister_reply"))
    ) {
      void createNotification(
        askerId,
        "listing_public_comment",
        null,
        `${posterName} replied on “${titleHint.slice(0, 52)}${titleHint.length > 52 ? "…" : ""}”: ${snippet}`,
        {
          senderName: posterName,
          listingUuid: params.listingId,
          listingTitle: titleHint,
          persistTitle: "Lister replied in Q&A Chat",
          persistBody: `${posterName}: ${snippet}`,
          qaSubkind: "reply",
        }
      );
    }
    } else if (listerId !== session.user.id && (await qaNotifyAllowed(listerId, "in_app_qa_new_question"))) {
    void createNotification(
      listerId,
      "listing_public_comment",
      null,
      `${posterName} on “${titleHint.slice(0, 52)}${titleHint.length > 52 ? "…" : ""}”: ${snippet}`,
      {
        senderName: posterName,
        listingUuid: params.listingId,
        listingTitle: titleHint,
        persistTitle: "New Q&A Chat question",
        persistBody: `${posterName}: ${snippet}`,
        qaSubkind: "question",
      }
    );
    }

    return { ok: true, comment };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Could not post comment.";
    console.error("[postListingComment]", msg);
    if (/relation .*listing_comment_bans.* does not exist/i.test(msg)) {
      return { ok: false, error: "Q&A moderation setup is still rolling out. Please try again shortly." };
    }
    return { ok: false, error: "Could not send message right now. Please try again." };
  }
}

export type RemoveListingCommentResult =
  | { ok: true; removedIds: string[] }
  | { ok: false; error: string };

export async function removeListingComment(params: {
  listingId: string;
  commentId: string;
  scope: "comment" | "thread";
}): Promise<RemoveListingCommentResult> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return { ok: false, error: "Sign in required." };

  const admin = createSupabaseAdminClient();
  const readClient = (admin ?? supabase) as SupabaseClient<Database>;
  const { data: listing } = await readClient
    .from("listings")
    .select("id, lister_id")
    .eq("id", params.listingId)
    .maybeSingle();
  if (!listing) return { ok: false, error: "Listing not found." };
  if (String((listing as { lister_id: string }).lister_id) !== String(session.user.id)) {
    return { ok: false, error: "Only the listing lister can moderate Q&A." };
  }

  const root = await getRootCommentForThread(readClient, params.commentId);
  if (!root || String(root.listing_id) !== String(params.listingId)) {
    return { ok: false, error: "Comment not found." };
  }

  if (params.scope === "thread") {
    const { data: threadRows } = await readClient
      .from("listing_comments")
      .select("id")
      .eq("listing_id", params.listingId)
      .or(`id.eq.${root.id},parent_comment_id.eq.${root.id}`);
    const ids = ((threadRows ?? []) as Array<{ id: string }>).map((r) => r.id);
    if (ids.length === 0) return { ok: true, removedIds: [] };
    await readClient.from("listing_comments").delete().in("id", ids as never);
    revalidatePath(`/listings/${params.listingId}`);
    return { ok: true, removedIds: ids };
  }

  await readClient.from("listing_comments").delete().eq("id", params.commentId);
  revalidatePath(`/listings/${params.listingId}`);
  return { ok: true, removedIds: [params.commentId] };
}

export type BanCleanerFromListingQaResult =
  | { ok: true; bannedUserId: string }
  | { ok: false; error: string };

export async function banCleanerFromListingQa(params: {
  listingId: string;
  targetUserId: string;
  reason?: string | null;
}): Promise<BanCleanerFromListingQaResult> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return { ok: false, error: "Sign in required." };

  const admin = createSupabaseAdminClient();
  const readClient = (admin ?? supabase) as SupabaseClient<Database>;
  const { data: listing } = await readClient
    .from("listings")
    .select("id, lister_id")
    .eq("id", params.listingId)
    .maybeSingle();
  if (!listing) return { ok: false, error: "Listing not found." };
  const listerId = String((listing as { lister_id: string }).lister_id);
  if (String(session.user.id) !== listerId) {
    return { ok: false, error: "Only the listing lister can ban users in Q&A." };
  }
  if (String(params.targetUserId) === listerId) {
    return { ok: false, error: "You cannot ban yourself." };
  }

  const { data: profile } = await readClient
    .from("profiles")
    .select("roles")
    .eq("id", params.targetUserId)
    .maybeSingle();
  const roles = normalizeRoles((profile as { roles?: unknown } | null)?.roles ?? []);
  if (!roles.includes("cleaner")) {
    return { ok: false, error: "Only cleaner users can be banned from Q&A." };
  }

  const reason =
    (params.reason ?? "").trim() || "user was banned for misconduct";
  const payload = {
    listing_id: params.listingId,
    user_id: params.targetUserId,
    banned_by_user_id: session.user.id,
    reason,
    created_at: new Date().toISOString(),
  };
  const { error } = await (readClient as any)
    .from("listing_comment_bans")
    .upsert(payload, { onConflict: "listing_id,user_id" });
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/listings/${params.listingId}`);
  return { ok: true, bannedUserId: String(params.targetUserId) };
}
