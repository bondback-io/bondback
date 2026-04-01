import { createServerClient } from "@supabase/ssr";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import type { Database } from "@/types/supabase";

/**
 * Supabase browser session cookies must be written onto this `response` so Set-Cookie is included
 * in the Route Handler’s outgoing HTTP response. Using `cookies()` from `next/headers` alone
 * often fails for redirects — the session is created in memory but the browser never stores cookies,
 * so the next request looks logged out (common on Vercel + `/auth/confirm`).
 */
export function createSupabaseRouteHandlerClient(
  request: NextRequest,
  response: NextResponse
) {
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: object }[]) {
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options as Record<string, unknown>)
          );
        },
      },
    }
  );
}
