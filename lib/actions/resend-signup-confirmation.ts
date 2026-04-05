"use server";

import { createClient } from "@supabase/supabase-js";
import type { User } from "@supabase/supabase-js";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getAppBaseUrl } from "@/lib/site";

export type ResendSignupConfirmationResult =
  | { ok: true; message: string }
  | { ok: false; reason: "already_confirmed" }
  | { ok: false; reason: "not_found" }
  | { ok: false; reason: "rate_limited" }
  | { ok: false; reason: "resend_failed"; message: string };

function buildAuthConfirmEmailRedirectTo(): string {
  const base = getAppBaseUrl().replace(/\/$/, "");
  const u = new URL("/auth/confirm", base);
  u.searchParams.set("next", "/dashboard");
  return u.toString();
}

/** Paginated search — acceptable for moderate user volumes; prefer admin lookup when service role is set. */
async function findAuthUserByEmail(
  admin: NonNullable<ReturnType<typeof createSupabaseAdminClient>>,
  email: string
): Promise<User | null> {
  const normalized = email.trim().toLowerCase();
  let page = 1;
  const perPage = 1000;
  const maxPages = 100;
  while (page <= maxPages) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) {
      console.warn("[resend-signup-confirmation] listUsers", error.message);
      return null;
    }
    const users = data?.users ?? [];
    if (users.length === 0) break;
    const u = users.find((x) => x.email?.toLowerCase() === normalized);
    if (u) return u;
    if (users.length < perPage) break;
    page += 1;
  }
  return null;
}

function looksLikeAlreadyConfirmedError(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes("already confirmed") ||
    m.includes("email already confirmed") ||
    m.includes("user already registered") ||
    m.includes("already been registered") ||
    (m.includes("confirmed") && m.includes("already"))
  );
}

function looksLikeRateLimit(message: string): boolean {
  const m = message.toLowerCase();
  return m.includes("rate") || m.includes("too many") || m.includes("seconds");
}

/**
 * Resend signup confirmation email. When service role is configured, resolves the auth user first
 * so we can show a clear message if the email is already confirmed or unknown.
 */
export async function requestSignupConfirmationEmail(
  rawEmail: string
): Promise<ResendSignupConfirmationResult> {
  const email = rawEmail.trim();
  if (!email || !email.includes("@")) {
    return { ok: false, reason: "not_found" };
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) {
    return { ok: false, reason: "resend_failed", message: "Email service is not configured." };
  }

  const emailRedirectTo = buildAuthConfirmEmailRedirectTo();
  const anonClient = createClient(url, anon, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const admin = createSupabaseAdminClient();

  if (admin) {
    const user = await findAuthUserByEmail(admin, email);
    if (!user) {
      return { ok: false, reason: "not_found" };
    }
    if (user.email_confirmed_at) {
      return { ok: false, reason: "already_confirmed" };
    }
  }

  const { error } = await anonClient.auth.resend({
    type: "signup",
    email,
    options: { emailRedirectTo },
  });

  if (error) {
    if (looksLikeRateLimit(error.message)) {
      return { ok: false, reason: "rate_limited" };
    }
    if (looksLikeAlreadyConfirmedError(error.message)) {
      return { ok: false, reason: "already_confirmed" };
    }
    return { ok: false, reason: "resend_failed", message: error.message };
  }

  return {
    ok: true,
    message: "Check your inbox — we’ve sent a new confirmation link to that address.",
  };
}
