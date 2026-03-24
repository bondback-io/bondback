import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { OnboardingCleanerForm } from "@/components/features/onboarding-cleaner-form";
import type { Database } from "@/types/supabase";

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

export const metadata: Metadata = {
  title: "Cleaner onboarding",
  description:
    "Set up your cleaner profile on Bond Back — travel radius, bond cleaning, and end of lease work.",
};

const OnboardingCleanerPage = async ({
  searchParams,
}: {
  searchParams: Promise<{
    suburb?: string;
    postcode?: string;
    max_travel_km?: string;
    abn?: string;
  }>;
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
    .select("roles, suburb")
    .eq("id", session.user.id)
    .maybeSingle();

  const existing = data as Pick<ProfileRow, "roles" | "suburb"> | null;
  const roles = (existing?.roles as string[] | null) ?? [];
  const params = await searchParams;

  if (roles.includes("cleaner") && (existing?.suburb ?? "").trim().length >= 2) {
    redirect("/jobs");
  }

  return (
    <OnboardingCleanerForm
      initialSuburb={params.suburb ?? ""}
      initialPostcode={params.postcode ?? ""}
      initialMaxTravelKm={
        params.max_travel_km ? Number(params.max_travel_km) : 30
      }
      initialAbn={params.abn ?? ""}
    />
  );
};

export default OnboardingCleanerPage;
