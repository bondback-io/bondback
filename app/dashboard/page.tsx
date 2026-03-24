import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Database } from "@/types/supabase";

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
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) redirect("/login");

  const { data: profileData, error } = await supabase
    .from("profiles")
    .select("roles, active_role")
    .eq("id", session.user.id)
    .maybeSingle();

  if (error || !profileData) redirect("/onboarding/role-choice");

  const profile = profileData as ProfileRow;
  const roles = (profile.roles as string[] | null) ?? [];
  if (roles.length === 0) redirect("/onboarding/role-choice");

  const activeRole =
    (profile.active_role as string | null) ?? roles[0] ?? "lister";

  if (roles.length === 1) {
    if (roles.includes("cleaner")) redirect("/cleaner/dashboard");
    redirect("/lister/dashboard");
  }

  // Dual-role: follow active role (same as header switcher)
  if (activeRole === "cleaner" && roles.includes("cleaner")) {
    redirect("/cleaner/dashboard");
  }
  if (roles.includes("lister")) {
    redirect("/lister/dashboard");
  }
  redirect("/cleaner/dashboard");
}
