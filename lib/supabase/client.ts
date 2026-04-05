import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/supabase";

export type BrowserSupabaseAuthFlow = "pkce" | "implicit";

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
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        flowType: authFlow,
      },
    }
  );
}
