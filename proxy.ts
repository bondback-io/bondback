import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

/** Public site host — keep Supabase Auth “Redirect URLs” to `https://www.bondback.io/**` only (+ localhost). */
const CANONICAL_WWW_HOST = "www.bondback.io";

/** Apex → www so OAuth, cookies, and NEXT_PUBLIC_APP_URL stay aligned with https://www.bondback.io */
function redirectApexToWww(request: NextRequest): NextResponse | null {
  const host = request.headers.get("host")?.split(":")[0]?.toLowerCase();
  if (host === "bondback.io") {
    const url = request.nextUrl.clone();
    url.hostname = CANONICAL_WWW_HOST;
    url.protocol = "https:";
    return NextResponse.redirect(url, 308);
  }
  return null;
}

const PROTECTED_PATHS = [
  "/dashboard",
  "/cleaner",
  "/lister",
  "/listings/new",
  "/jobs",
  "/profile",
  "/settings",
  "/my-listings",
  "/onboarding",
  "/admin",
];

/**
 * Public onboarding routes (no session). `/onboarding/role-choice` is auth-only
 * (user lands there after `/signup`); legacy pre-auth flows stay public here.
 */
const PUBLIC_ONBOARDING = [
  "/onboarding/signup",
  "/onboarding/lister/details",
  "/onboarding/cleaner/details",
  "/onboarding/both/details",
];

function isProtected(pathname: string): boolean {
  if (pathname === "/") return false;
  if (pathname.startsWith("/auth/")) return false;
  if (pathname.startsWith("/api/")) return false;
  if (PUBLIC_ONBOARDING.some((p) => pathname === p)) return false;
  /** Logged-in browse directory; `/cleaners/[id]` stays public for shared profile links. */
  if (pathname === "/cleaners") return true;
  return PROTECTED_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

/** Edge entry — also exported as `middleware` for Next.js compatibility. */
export async function proxy(request: NextRequest) {
  const apexRedirect = redirectApexToWww(request);
  if (apexRedirect) return apexRedirect;

  const pathname = request.nextUrl.pathname;
  const sp = request.nextUrl.searchParams;

  /**
   * Supabase OAuth can land on the **Site URL** root (`/?code=…`) when `redirectTo` is not
   * allow-listed or Dashboard “Site URL” is used as a fallback — the PKCE `code` never reaches
   * `/auth/callback`, so no session is established. Forward the same query string to the callback
   * route so `exchangeCodeForSession` runs and post-login redirect (e.g. Google → role selection)
   * still applies via `redirectAfterAuthSessionEstablished`.
   */
  const code = sp.get("code")?.trim();
  const tokenHash = sp.get("token_hash")?.trim() ?? sp.get("token")?.trim();
  const isOAuthOrPkcePayload =
    Boolean(code) ||
    Boolean(tokenHash) ||
    (sp.has("error") && (sp.has("error_code") || sp.has("error_description")));

  if (
    isOAuthOrPkcePayload &&
    !pathname.startsWith("/auth/callback") &&
    !pathname.startsWith("/auth/confirm")
  ) {
    const destination = new URL("/auth/callback", request.url);
    sp.forEach((value, key) => {
      destination.searchParams.set(key, value);
    });
    return NextResponse.redirect(destination);
  }

  /**
   * Do not run `getSession()` (token refresh) on email/OAuth link routes. If the browser still
   * holds another account’s cookies, refreshing here can re-assert the old session on the
   * middleware response before the route handler replaces cookies with the new user.
   */
  if (pathname.startsWith("/auth/confirm") || pathname.startsWith("/auth/callback")) {
    return NextResponse.next({ request });
  }

  const supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: object }[]) {
          cookiesToSet.forEach(({ name, value, options }) => {
            supabaseResponse.cookies.set(name, value, options as Record<string, unknown>);
          });
        },
      },
    }
  );

  /**
   * Always refresh the session cookie (cheap local read + optional refresh).
   * Only call `getUser()` (network JWT validation) for **protected** routes — skipping it on
   * `/auth/confirm`, `/login`, marketing pages, etc. removes a full Supabase Auth round-trip
   * on every navigation. That round-trip is especially painful on mobile Safari / iOS Mail → Safari.
   */
  await supabase.auth.getSession();

  if (!isProtected(pathname)) {
    return supabaseResponse;
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const loginUrl = new URL("/login", request.url);
    const nextDest = pathname + (request.nextUrl.search ?? "");
    loginUrl.searchParams.set("next", nextDest);
    return NextResponse.redirect(loginUrl);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};

/** Use `proxy.ts` only (no `middleware.ts`) — Vercel/Next reject both files together. */
export { proxy as middleware };
