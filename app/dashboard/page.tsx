import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Database } from "@/types/supabase";
import { getPostLoginDashboardPath } from "@/lib/auth/post-login-redirect";

export const metadata: Metadata = {
  title: "Dashboard",
  description:
    "Your Bond Back dashboard — redirects to your lister or cleaner home for bond cleaning jobs in Australia.",
  alternates: { canonical: "/dashboard" },
  robots: { index: false, follow: true },
};

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

/**
 * Entry `/dashboard`: sends everyone to the role-specific dashboard.
 * Single-role → `/lister/dashboard` or `/cleaner/dashboard`.
 * Dual-role → same URLs using `profiles.active_role` (change role in header / Settings).
 */
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = await createServerSupabaseClient();
  /** Prefer getUser() so the JWT is validated server-side (avoids stale cookie-only session after login). */
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) redirect("/login");

  const { data: profileData, error } = await supabase
    .from("profiles")
    .select("roles, active_role")
    .eq("id", user.id)
    .maybeSingle();

  if (error || !profileData) redirect("/onboarding/role-choice");

  redirect(getPostLoginDashboardPath(profileData as ProfileRow));
}
