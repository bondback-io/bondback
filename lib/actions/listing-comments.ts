"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { moderateListingCommentText } from "@/lib/listing-comment-moderation";
import { shouldShowPublicListingComments } from "@/lib/listing-public-comments-visibility";
import { createNotification } from "@/lib/actions/notifications";

type ListingRow = Database["public"]["Tables"]["listings"]["Row"];
type ListingCommentRow = Database["public"]["Tables"]["listing_comments"]["Row"];
type ProfileMiniRow = Pick<
  Database["public"]["Tables"]["profiles"]["Row"],
  "id" | "full_name" | "roles"
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
};

function roleLabel(
  userId: string,
  listerId: string,
  roles: string[] | null | undefined
): "Lister" | "Cleaner" | "Member" {
  if (String(userId) === String(listerId)) return "Lister";
  const r = Array.isArray(roles) ? roles.map((x) => String(x).toLowerCase()) : [];
  if (r.includes("cleaner")) return "Cleaner";
  return "Member";
}

function displayName(fullName: string | null | undefined, fallback: string): string {
  const t = (fullName ?? "").trim();
  if (t.length > 0) return t.length > 48 ? `${t.slice(0, 47)}…` : t;
  return fallback;
}

/** Server load for listing page — works with anon session for public read. */
export async function fetchListingCommentsPublic(
  listingId: string,
  listerId: string
): Promise<ListingCommentPublic[]> {
  const supabase = await createServerSupabaseClient();
  const { data: rows, error } = await supabase
    .from("listing_comments")
    .select("id, listing_id, user_id, parent_comment_id, message_text, created_at")
    .eq("listing_id", listingId)
    .order("created_at", { ascending: true });

  if (error || !rows?.length) {
    if (error && !/listing_comments/.test(error.message)) {
      console.warn("[fetchListingCommentsPublic]", error.message);
    }
    return [];
  }

  const typedRows = rows as ListingCommentRow[];
  const userIds = [...new Set(typedRows.map((r) => r.user_id))];
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name, roles")
    .in("id", userIds);

  const byUser = new Map(
    ((profiles ?? []) as ProfileMiniRow[]).map((p) => [
      p.id,
      {
        full_name: p.full_name as string | null,
        roles: p.roles as string[] | null,
      },
    ])
  );

  return typedRows.map((r) => {
    const p = byUser.get(r.user_id);
    return {
      id: r.id,
      listing_id: r.listing_id,
      user_id: r.user_id,
      parent_comment_id: r.parent_comment_id,
      message_text: r.message_text,
      created_at: r.created_at,
      author_display_name: displayName(p?.full_name, "Member"),
      author_role_label: roleLabel(r.user_id, listerId, p?.roles),
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

  const { data: posterProfile } = await readClient
    .from("profiles")
    .select("active_role, roles, full_name")
    .eq("id", session.user.id)
    .maybeSingle();
  const activeRoleRaw = (posterProfile as { active_role?: string | null } | null)?.active_role;
  const activeRole =
    typeof activeRoleRaw === "string" ? activeRoleRaw.trim().toLowerCase() : "";
  const rolesArr = (posterProfile as { roles?: string[] | null } | null)?.roles ?? [];
  const hasCleanerRole = rolesArr.map((r) => String(r).toLowerCase()).includes("cleaner");
  /** Dual-role: browse/post as cleaner on own listing (same user id as lister_id). */
  const isActiveCleanerSession = activeRole === "cleaner" && hasCleanerRole;

  if (params.parentCommentId) {
    const { data: parent } = await readClient
      .from("listing_comments")
      .select("id, listing_id, user_id, parent_comment_id")
      .eq("id", params.parentCommentId)
      .maybeSingle();
    const pr = parent as {
      listing_id?: string;
      user_id?: string;
      parent_comment_id?: string | null;
    } | null;
    if (!parent || String(pr?.listing_id) !== String(params.listingId)) {
      return { ok: false, error: "Invalid reply target." };
    }
    if (String(session.user.id) !== listerId) {
      return {
        ok: false,
        error: "Only the property lister can reply to public questions.",
      };
    }
    if (pr?.parent_comment_id != null) {
      return {
        ok: false,
        error: "Replies are only allowed on top-level questions, not nested threads.",
      };
    }
    // Root author may be lister_id when they posted as cleaner on their own listing — lister may still reply.
  } else {
    if (String(session.user.id) === listerId && !isActiveCleanerSession) {
      return {
        ok: false,
        error:
          "Switch to Cleaner in the header to post a public question on your own listing, or use My listings to manage this job.",
      };
    }
  }

  const { data: inserted, error: insErr } = await supabase
    .from("listing_comments")
    .insert({
      listing_id: params.listingId,
      user_id: session.user.id,
      parent_comment_id: params.parentCommentId,
      message_text: mod.text,
    } as never)
    .select("id, listing_id, user_id, parent_comment_id, message_text, created_at")
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
    return { ok: false, error: msg };
  }

  const ins = inserted as ListingCommentRow;
  const prof = posterProfile as {
    full_name?: string | null;
    roles?: string[] | null;
  } | null;
  const baseLabel = roleLabel(session.user.id, listerId, prof?.roles);
  const comment: ListingCommentPublic = {
    id: ins.id,
    listing_id: ins.listing_id,
    user_id: ins.user_id,
    parent_comment_id: ins.parent_comment_id,
    message_text: ins.message_text,
    created_at: ins.created_at,
    author_display_name: displayName(prof?.full_name, "Member"),
    author_role_label:
      isActiveCleanerSession && String(session.user.id) === listerId
        ? "Cleaner"
        : baseLabel,
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
    const { data: parentRow } = await readClient
      .from("listing_comments")
      .select("user_id")
      .eq("id", params.parentCommentId)
      .maybeSingle();
    const askerId = String((parentRow as { user_id?: string } | null)?.user_id ?? "");
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
}
