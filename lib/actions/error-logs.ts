"use server";

import { createServerSupabaseClient } from "@/lib/supabase/server";

export type LogErrorEventInput = {
  scope: string;
  message: string;
  attempt?: number;
  maxAttempts?: number;
  context?: Record<string, unknown>;
};

/**
 * Best-effort insert into `error_logs` (ignored if table missing or RLS blocks).
 * Call from client after final failure or from retry helpers.
 */
export async function logErrorEvent(input: LogErrorEventInput): Promise<void> {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const userId = session?.user?.id ?? null;
    if (!userId) return;

    const { error } = await supabase.from("error_logs").insert({
      user_id: userId,
      scope: input.scope.slice(0, 200),
      message: input.message.slice(0, 2000),
      context: (input.context ?? {}) as never,
      attempt: input.attempt ?? null,
      max_attempts: input.maxAttempts ?? null,
    } as never);
    if (error && process.env.NODE_ENV !== "production") {
      console.warn("[logErrorEvent]", error.message);
    }
  } catch (e) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[logErrorEvent] skipped", e);
    }
  }
}
