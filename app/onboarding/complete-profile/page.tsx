import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { CompleteProfileClient } from "@/components/onboarding/complete-profile-client";
import type { Database } from "@/types/supabase";

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

/**
 * After email confirmation: user has session but may have no profile/roles.
 * Client reads role+details from localStorage, calls completeOnboardingFromSignup, redirects.
 */
export const metadata: Metadata = {
  title: "Complete profile",
  description:
    "Finish setting up your Bond Back profile after email confirmation — bond cleaning marketplace.",
};

export default async function CompleteProfilePage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    redirect("/login");
  }

  const { data } = await supabase
    .from("profiles")
    .select("roles")
    .eq("id", session.user.id)
    .maybeSingle();

  const profile = data as Pick<ProfileRow, "roles"> | null;
  const roles = (profile?.roles as string[] | null) ?? [];

  if (roles.length > 0) {
    redirect("/dashboard");
  }

  return (
    <section className="page-inner flex min-h-[40vh] flex-col items-center justify-center">
      <CompleteProfileClient />
    </section>
  );
}
