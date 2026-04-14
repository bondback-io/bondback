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

  if (params.parentCommentId) {
    const { data: parent } = await readClient
      .from("listing_comments")
      .select("id, listing_id")
      .eq("id", params.parentCommentId)
      .maybeSingle();
    const pr = parent as { listing_id?: string } | null;
    if (!parent || String(pr?.listing_id) !== String(params.listingId)) {
      return { ok: false, error: "Invalid reply target." };
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

  const { data: author } = await readClient
    .from("profiles")
    .select("full_name, roles")
    .eq("id", session.user.id)
    .maybeSingle();

  const listerId = String(row.lister_id);
  const ins = inserted as ListingCommentRow;
  const comment: ListingCommentPublic = {
    id: ins.id,
    listing_id: ins.listing_id,
    user_id: ins.user_id,
    parent_comment_id: ins.parent_comment_id,
    message_text: ins.message_text,
    created_at: ins.created_at,
    author_display_name: displayName(
      (author as { full_name?: string | null } | null)?.full_name,
      "Member"
    ),
    author_role_label: roleLabel(
      session.user.id,
      listerId,
      (author as { roles?: string[] | null } | null)?.roles
    ),
  };

  revalidatePath(`/listings/${params.listingId}`);

  const snippet =
    mod.text.length > 120 ? `${mod.text.slice(0, 117)}…` : mod.text;
  const titleHint = (row.title ?? "").trim() || "A listing";

  const notifyUserIds = new Set<string>();
  if (listerId !== session.user.id) notifyUserIds.add(listerId);

  const { data: bidRows } = await readClient
    .from("bids")
    .select("cleaner_id, bidder_id, status")
    .eq("listing_id", params.listingId)
    .eq("status", "active");

  for (const b of bidRows ?? []) {
    const cid = String((b as { cleaner_id?: string }).cleaner_id ?? "");
    if (cid && cid !== session.user.id) notifyUserIds.add(cid);
    const bid = b as { bidder_id?: string };
    if (bid.bidder_id && String(bid.bidder_id) !== session.user.id) {
      notifyUserIds.add(String(bid.bidder_id));
    }
  }

  const posterName = comment.author_display_name;
  for (const uid of notifyUserIds) {
    void createNotification(
      uid,
      "listing_public_comment",
      null,
      `${posterName} on “${titleHint.slice(0, 60)}${titleHint.length > 60 ? "…" : ""}”: ${snippet}`,
      {
        senderName: posterName,
        listingUuid: params.listingId,
        listingTitle: titleHint,
        persistTitle: "New public comment",
        persistBody: `${posterName}: ${snippet}`,
      }
    );
  }

  return { ok: true, comment };
}
