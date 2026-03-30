import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  type EmailPlaceholderValues,
  parseAmountFromMessageForEmail,
} from "@/lib/email-placeholders";

function firstName(full: string | null | undefined): string {
  const t = (full ?? "").trim();
  if (!t) return "Valued User";
  return t.split(/\s+/)[0] ?? t;
}

/**
 * Resolve real lister/cleaner/listing names for transactional emails (admin HTML templates).
 */
export async function resolveEmailPlaceholderValues(params: {
  jobId: number | null;
  messageText: string;
  senderName?: string;
  listingId?: number | null;
  recipientUserId?: string;
}): Promise<EmailPlaceholderValues> {
  const messageText = params.messageText ?? "";
  const jobIdStr = params.jobId != null ? String(params.jobId) : "";
  const listingIdParam =
    params.listingId != null ? String(params.listingId) : jobIdStr;
  const senderName = (params.senderName ?? "").trim();
  const amount = parseAmountFromMessageForEmail(messageText) ?? "$0";

  let name = "Valued User";
  let recipientName = "Valued User";
  let role = "Member";
  let listerName = "—";
  let cleanerName = "—";
  let listingTitle = "Your listing";
  let suburb = "—";

  const admin = createSupabaseAdminClient();

  if (params.recipientUserId && admin) {
    const { data: p } = await admin
      .from("profiles")
      .select("full_name, active_role")
      .eq("id", params.recipientUserId)
      .maybeSingle();
    const row = p as { full_name?: string | null; active_role?: string | null } | null;
    const fn = row?.full_name?.trim();
    if (fn) {
      recipientName = fn;
      name = firstName(fn);
    }
    const ar = row?.active_role;
    role = ar === "cleaner" ? "Cleaner" : ar === "lister" ? "Lister" : "Member";
  }

  if (admin && params.jobId != null) {
    const { data: job } = await admin
      .from("jobs")
      .select("lister_id, winner_id, listing_id, title")
      .eq("id", params.jobId)
      .maybeSingle();
    const j = job as {
      lister_id?: string;
      winner_id?: string | null;
      listing_id?: string | null;
      title?: string | null;
    } | null;
    if (j?.title?.trim()) listingTitle = j.title.trim();

    if (j?.lister_id || j?.winner_id) {
      const ids = [j.lister_id, j.winner_id].filter(Boolean) as string[];
      const { data: profs } = await admin.from("profiles").select("id, full_name").in("id", ids);
      const map = Object.fromEntries(
        (profs ?? []).map((r: { id: string; full_name?: string | null }) => [
          r.id,
          r.full_name?.trim() || "—",
        ])
      );
      if (j.lister_id) listerName = map[j.lister_id] ?? "—";
      if (j.winner_id) cleanerName = map[j.winner_id] ?? "—";
    }

    const lid = j?.listing_id;
    if (lid) {
      const { data: listing } = await admin
        .from("listings")
        .select("title, suburb")
        .eq("id", lid)
        .maybeSingle();
      const L = listing as { title?: string | null; suburb?: string | null } | null;
      if (L?.title?.trim()) listingTitle = L.title.trim();
      if (L?.suburb?.trim()) suburb = L.suburb.trim();
    }
  } else if (admin && params.listingId != null && !Number.isNaN(Number(params.listingId))) {
    const { data: listing } = await admin
      .from("listings")
      .select("title, suburb, lister_id")
      .eq("id", String(params.listingId))
      .maybeSingle();
    const L = listing as {
      title?: string | null;
      suburb?: string | null;
      lister_id?: string | null;
    } | null;
    if (L?.title?.trim()) listingTitle = L.title.trim();
    if (L?.suburb?.trim()) suburb = L.suburb.trim();
    if (L?.lister_id) {
      const { data: lp } = await admin
        .from("profiles")
        .select("full_name")
        .eq("id", L.lister_id)
        .maybeSingle();
      const fn = (lp as { full_name?: string | null } | null)?.full_name?.trim();
      if (fn) listerName = fn;
    }
  }

  return {
    messageText,
    jobId: jobIdStr || "—",
    listingId: listingIdParam || "—",
    senderName: senderName || "someone",
    name,
    recipientName,
    listerName,
    cleanerName,
    listingTitle,
    amount,
    role,
    suburb,
  };
}
