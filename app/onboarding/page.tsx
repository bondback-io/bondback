import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { OnboardingForm } from "@/components/features/onboarding-form";
import type { Database } from "@/types/supabase";

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

export const metadata: Metadata = {
  title: "Welcome",
  description: "Start your Bond Back profile — bond cleaning marketplace in Australia.",
};

const OnboardingPage = async ({
  searchParams,
}: {
  searchParams: Promise<{ role?: string }>;
}) => {
  const supabase = await createServerSupabaseClient();
  const {
    data: { session }
  } = await supabase.auth.getSession();

  if (!session) {
    redirect("/login");
  }

  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", session.user.id)
    .maybeSingle();

  const existingProfile = data as ProfileRow | null;
  const roles = (existingProfile?.roles as string[] | null) ?? [];

  if (roles.length === 0) {
    redirect("/onboarding/role-choice");
  }

  const params = await searchParams;
  const roleParam = params.role;

  if (roleParam === "cleaner" && roles.includes("cleaner")) {
    redirect("/onboarding/cleaner/details");
  }

  return (
    <OnboardingForm
      userId={session.user.id}
      initialRole={
        (existingProfile?.active_role as "lister" | "cleaner" | undefined) ??
        (roleParam === "cleaner" ? "cleaner" : null)
      }
      initialAbn={existingProfile?.abn ?? null}
      initialSuburb={existingProfile?.suburb ?? null}
      initialPostcode={existingProfile?.postcode ?? null}
      initialMaxTravelKm={existingProfile?.max_travel_km ?? null}
    />
  );
};

export default OnboardingPage;

