import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/supabase";

export type BrowserSupabaseAuthFlow = "pkce" | "implicit";

type BrowserClient = ReturnType<typeof createBrowserClient<Database>>;

/** One client per flow — avoids gotrue-js auth storage lock contention (Strict Mode + many mounts). */
let browserPkce: BrowserClient | undefined;
let browserImplicit: BrowserClient | undefined;

/**
 * Browser Supabase client for Client Components ('use client').
 *
 * Use **`implicit`** only for `signUp` / email-confirmation flows: confirmation links then use
 * OTP-style `token_hash` values that work with `verifyOtp` when the user opens the email in
 * another browser. **`pkce`** (default) is kept for OAuth and the rest of the app.
 */
export function createBrowserSupabaseClient(options?: {
  authFlow?: BrowserSupabaseAuthFlow;
}) {
  const authFlow = options?.authFlow ?? "pkce";
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  if (authFlow === "implicit") {
    if (!browserImplicit) {
      browserImplicit = createBrowserClient<Database>(url, key, {
        auth: { flowType: "implicit" },
      });
    }
    return browserImplicit;
  }

  if (!browserPkce) {
    browserPkce = createBrowserClient<Database>(url, key, {
      auth: { flowType: "pkce" },
    });
  }
  return browserPkce;
}
