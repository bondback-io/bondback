import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { MESSAGES_INBOX_JOB_STATUSES } from "@/lib/chat-unlock";
import { effectiveMessengerRoleFromProfile } from "@/lib/chat-participant-role";
import { fetchMessengerPeerProfilesByIds } from "@/lib/messenger-peer-profiles-server";

type Body = { ids?: unknown };

/**
 * Returns minimal profile rows for job chat peers (lister ↔ winner on the caller’s jobs).
 * POST avoids very long query strings when many threads load at once.
 */
export async function POST(req: Request) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const rawIds = Array.isArray(body.ids) ? body.ids : [];
  const requested = [
    ...new Set(
      rawIds
        .map((x) => String(x ?? "").trim())
        .filter((id) => id.length > 0)
    ),
  ];
  if (requested.length === 0) {
    return NextResponse.json({ profiles: [] });
  }

  const { data: profileRow } = await supabase
    .from("profiles")
    .select("active_role, roles")
    .eq("id", user.id)
    .maybeSingle();

  const messengerRoleFilter = effectiveMessengerRoleFromProfile({
    active_role: (profileRow as { active_role?: string | null } | null)?.active_role ?? null,
    roles: (profileRow as { roles?: string[] | null } | null)?.roles ?? null,
  });

  let jobsQuery = supabase
    .from("jobs")
    .select("lister_id, winner_id")
    .in("status", [...MESSAGES_INBOX_JOB_STATUSES] as never[]);
  if (messengerRoleFilter === "lister") {
    jobsQuery = jobsQuery.eq("lister_id", user.id as never);
  } else {
    jobsQuery = jobsQuery.eq("winner_id", user.id as never);
  }

  const { data: jobsData } = await jobsQuery;
  const allowed = new Set<string>();
  for (const row of jobsData ?? []) {
    const j = row as { lister_id?: string | null; winner_id?: string | null };
    if (j.lister_id) allowed.add(String(j.lister_id));
    if (j.winner_id) allowed.add(String(j.winner_id));
  }

  const filtered = requested.filter((id) => allowed.has(id));
  if (filtered.length === 0) {
    return NextResponse.json({ profiles: [] });
  }

  const profiles = await fetchMessengerPeerProfilesByIds(filtered);
  return NextResponse.json({ profiles });
}
