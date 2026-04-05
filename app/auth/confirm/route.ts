import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/types/supabase";
import { redirectAfterAuthSessionEstablished } from "@/lib/auth/auth-callback-session";
import { resolveEmailOtpTypeFromSearchParams } from "@/lib/auth/resolve-email-otp-type";
import { establishSessionFromEmailRedirectParams } from "@/lib/auth/establish-email-session";

export const dynamic = "force-dynamic";

function readTokenHash(searchParams: URLSearchParams): string | null {
  const raw = searchParams.get("token_hash") ?? searchParams.get("token");
  if (raw == null) return null;
  const t = raw.trim();
  return t || null;
}

/**
 * Email confirmation — GET only.
 *
 * `createServerClient` + `cookies()` for reads, but **Set-Cookie must be applied to the redirect
 * response** (`authCookieResponse.cookies`) — `cookieStore.set` alone often omits cookies on
 * redirects (Vercel), which breaks sessions and can contribute to PKCE / flow issues.
 *
 * PKCE (`?code=` or `token_hash=pkce_…`) uses `exchangeCodeForSession` inside
 * `establishSessionFromEmailRedirectParams`; legacy OTP uses `verifyOtp`.
 */
export async function GET(request: NextRequest) {
  const requestUrl = request.nextUrl;
  const { searchParams, origin } = requestUrl;

  const token_hash = readTokenHash(searchParams);
  const typeParam = searchParams.get("type");
  const otpType = resolveEmailOtpTypeFromSearchParams(searchParams);
  const code = searchParams.get("code")?.trim() || null;

  const tokenPreview =
    token_hash && token_hash.length > 20 ? `${token_hash.substring(0, 20)}…` : token_hash;

  console.log("=== CONFIRM ROUTE HIT ===", {
    url: request.url,
    token_hash: tokenPreview,
    type: typeParam,
    otpType,
    code: code ? "[present]" : null,
  });

  const redirectToLogin = (message: "confirm_link_invalid" | "confirm_link_expired") => {
    const url = new URL("/login", origin);
    url.searchParams.set("message", message);
    return NextResponse.redirect(url);
  };

  if (!code && !token_hash) {
    console.log("No token_hash or code in URL");
    return redirectToLogin("confirm_link_invalid");
  }

  const authCookieResponse = NextResponse.redirect(new URL("/dashboard", origin));
  const cookieStore = await cookies();

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          // Prefer the incoming request cookie jar (PKCE flow state); fall back to `cookies()`.
          const fromRequest = request.cookies.getAll();
          if (fromRequest.length > 0) return fromRequest;
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: object }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              authCookieResponse.cookies.set(name, value, options as Record<string, unknown>);
            });
          } catch {
            // ignore
          }
        },
      },
    }
  );

  console.log("Calling establishSessionFromEmailRedirectParams (PKCE exchange or verifyOtp)…");

  const outcome = await establishSessionFromEmailRedirectParams(supabase, {
    code,
    tokenHash: token_hash,
    otpType,
  });

  if (!outcome.ok) {
    console.error("verifyOtp / exchange failed:", {
      message: outcome.error.message,
      method: outcome.method,
    });
    return redirectToLogin("confirm_link_expired");
  }

  console.log("Session established — user:", outcome.user.id, "method:", outcome.method);

  return redirectAfterAuthSessionEstablished({
    supabase,
    request,
    next: "/dashboard",
    signupFlow: null,
    refParam: null,
    authCookieResponse,
    sessionFromAuth: outcome.session,
  });
}
