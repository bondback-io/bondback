/**
 * Server-only. Persist diagnostic errors to `system_error_log` (service role insert).
 * Safe to call from RSC / route handlers; no-ops if service role is missing.
 */
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Database, Json } from "@/types/supabase";

/** Shape shared by Supabase/PostgREST query errors. */
type PostgrestLikeError = {
  message: string;
  code?: string;
  details?: string;
  hint?: string;
};

export type LogSystemErrorParams = {
  source: string;
  severity: "error" | "warning";
  routePath?: string;
  jobId?: number | null;
  listingId?: string | null;
  message: string;
  code?: string | null;
  details?: string | null;
  hint?: string | null;
  context?: Record<string, unknown>;
  userId?: string | null;
};

type InsertRow = Database["public"]["Tables"]["system_error_log"]["Insert"];

export async function logSystemError(params: LogSystemErrorParams): Promise<void> {
  const admin = createSupabaseAdminClient();
  if (!admin) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[logSystemError] SUPABASE_SERVICE_ROLE_KEY missing; skip persist", params.source);
    }
    return;
  }

  const row: InsertRow = {
    source: params.source,
    severity: params.severity,
    route_path: params.routePath ?? null,
    job_id: params.jobId ?? null,
    listing_id: params.listingId ?? null,
    message: params.message,
    code: params.code ?? null,
    details: params.details ?? null,
    hint: params.hint ?? null,
    context: (params.context ?? {}) as Json,
    user_id: params.userId ?? null,
  };

  const { error } = await admin.from("system_error_log").insert(row);
  if (error) {
    console.warn("[logSystemError] insert failed:", error.message, params.source);
  }
}

export function fieldsFromPostgrestError(err: PostgrestLikeError): {
  message: string;
  code: string | null;
  details: string | null;
  hint: string | null;
} {
  return {
    message: err.message,
    code: err.code ?? null,
    details: err.details ?? null,
    hint: err.hint ?? null,
  };
}
