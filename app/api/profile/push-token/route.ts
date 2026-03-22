import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * POST /api/profile/push-token
 * Register or update the current user's Expo push token (e.g. from Bond Back mobile app).
 * Body: { "token": "ExponentPushToken[xxx]" } or { "token": null } to clear.
 * Requires authenticated session.
 */
export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { token?: string | null };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const token =
    body.token === null || body.token === undefined
      ? null
      : typeof body.token === "string"
        ? body.token.trim() || null
        : null;

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }

  const { error } = await admin
    .from("profiles")
    .update({
      expo_push_token: token,
      updated_at: new Date().toISOString(),
    } as any)
    .eq("id", session.user.id);

  if (error) {
    console.error("[profile/push-token] update failed", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
