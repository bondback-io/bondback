import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

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

export async function proxy(request: NextRequest) {
  const apexRedirect = redirectApexToWww(request);
  if (apexRedirect) return apexRedirect;

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

  // Refresh session (e.g. after long Stripe Checkout) so JWT is valid before getUser
  await supabase.auth.getSession();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (isProtected(request.nextUrl.pathname) && !user) {
    const loginUrl = new URL("/login", request.url);
    const nextDest =
      request.nextUrl.pathname +
      (request.nextUrl.search ?? "");
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
