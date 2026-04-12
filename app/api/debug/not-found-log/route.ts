import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { logSystemError } from "@/lib/system-error-log";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type Body = {
  pathname?: string;
  href?: string;
  referrer?: string;
  userAgent?: string;
  /** e.g. "not-found" */
  trigger?: string;
};

/**
 * Persists a 404 view to `system_error_log` for Admin → System errors.
 * Called once per session per pathname from the global not-found client panel.
 */
export async function POST(req: Request) {
  let body: Body = {};
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const pathname = String(body.pathname ?? "").trim() || "(unknown)";
  const href = String(body.href ?? "").trim() || null;
  const referrer = String(body.referrer ?? "").trim() || null;
  const userAgent = String(body.userAgent ?? "").trim() || null;

  let userId: string | null = null;
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    userId = user?.id ?? null;
  } catch {
    // ignore
  }

  const segments = pathname.split("/").filter(Boolean);
  const first = segments[0] ?? "";
  const second = segments[1] ?? "";

  let hint: string | null = null;
  if (first === "jobs" && second && UUID_RE.test(second)) {
    hint =
      "Path looks like /jobs/[uuid]. Job routes expect a numeric id; listing detail uses /listings/[uuid].";
  } else if (first === "listings" && second && /^\d+$/.test(second)) {
    hint =
      "Path looks like /listings/[number]. Listing routes expect a listing UUID; numeric ids are usually job ids → /jobs/[id].";
  }

  const message = [
    "Global 404 / notFound() page was shown in the browser.",
    hint ? `Hint: ${hint}` : null,
  ]
    .filter(Boolean)
    .join(" ");

  await logSystemError({
    source: "not_found:page_view",
    severity: "warning",
    routePath: pathname,
    message,
    userId,
    context: {
      trigger: body.trigger ?? "not-found",
      pathname,
      href,
      referrer,
      userAgent,
      hint,
      segment0: first || null,
      segment1: second || null,
      capturedAt: new Date().toISOString(),
    },
  });

  return NextResponse.json({ ok: true });
}
