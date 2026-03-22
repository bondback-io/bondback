import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { sendSyncPushToUser } from "@/lib/notifications/push";

export type SendPushBody = {
  type: "bid_sync_success" | "bid_sync_failure";
  jobIds?: string[];
  syncedCount?: number;
};

/**
 * POST /api/send-push
 * Send a push for background sync completion or failure. Called by the service worker after sync.
 * Body: { type: 'bid_sync_success' | 'bid_sync_failure', jobIds?: string[], syncedCount?: number }
 * Uses session (credentials). Rate limit: max 3 sync pushes per user per hour.
 */
export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  let body: SendPushBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const type = body.type;
  if (type !== "bid_sync_success" && type !== "bid_sync_failure") {
    return NextResponse.json({ ok: false, error: "Invalid type" }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json({ ok: false, error: "Server error" }, { status: 500 });
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("expo_push_token")
    .eq("id", session.user.id)
    .maybeSingle();

  const pushToken = (profile as { expo_push_token?: string | null } | null)?.expo_push_token ?? null;
  if (!pushToken || typeof pushToken !== "string" || !pushToken.trim()) {
    return NextResponse.json({ ok: true, sent: false });
  }

  const userId = session.user.id;
  let title: string;
  let bodyText: string;
  let data: { jobId?: string; type: string };

  if (type === "bid_sync_success") {
    const jobIds = Array.isArray(body.jobIds) ? body.jobIds.filter((id): id is string => typeof id === "string") : [];
    const firstId = jobIds[0] ?? "";
    const count = typeof body.syncedCount === "number" && body.syncedCount > 0 ? body.syncedCount : jobIds.length || 1;
    title = "Sync complete";
    bodyText =
      count === 1 && firstId
        ? `Your queued bid on Job #${firstId} was successfully placed!`
        : `${count} queued bid${count === 1 ? "" : "s"} placed successfully.`;
    data = { jobId: firstId || undefined, type: "bid_sync_success" };
  } else {
    title = "Sync failed";
    bodyText = "Check your connection and try again.";
    data = { type: "bid_sync_failure" };
  }

  const result = await sendSyncPushToUser(userId, pushToken, {
    title,
    body: bodyText,
    data,
  });

  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 500 });
  }
  return NextResponse.json({ ok: true, sent: result.sent ?? false });
}
