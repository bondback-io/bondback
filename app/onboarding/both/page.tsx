import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { Database } from "@/types/supabase";

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

export const metadata: Metadata = {
  title: "Lister & cleaner",
  description:
    "Onboard as both lister and cleaner on Bond Back — post and bid on bond cleaning jobs.",
};

export default async function OnboardingBothPage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    redirect("/login");
  }

  const { data } = await supabase
    .from("profiles")
    .select("roles, active_role")
    .eq("id", session.user.id)
    .maybeSingle();

  const profile = data as Pick<ProfileRow, "roles" | "active_role"> | null;
  const roles = (profile?.roles as string[] | null) ?? [];

  if (!roles.includes("lister") || !roles.includes("cleaner")) {
    redirect("/onboarding/role-choice");
  }

  return (
    <section className="page-inner flex justify-center">
      <Card className="w-full max-w-lg border-border dark:border-gray-800 dark:bg-gray-900">
        <CardHeader className="space-y-2">
          <CardTitle className="text-xl font-semibold tracking-tight dark:text-gray-100">
            You&apos;re set up for both roles
          </CardTitle>
          <CardDescription className="text-sm dark:text-gray-400">
            You can switch between <strong>Lister</strong> and <strong>Cleaner</strong> anytime using the role switcher in the header or on your dashboard. Complete your cleaner profile when you&apos;re ready to bid on jobs.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button asChild className="dark:bg-gray-800 dark:hover:bg-gray-700">
            <Link href="/dashboard">Go to Dashboard</Link>
          </Button>
          <Button variant="outline" asChild className="dark:border-gray-700 dark:hover:bg-gray-800">
            <Link href="/onboarding/cleaner/details">Complete cleaner profile</Link>
          </Button>
        </CardContent>
      </Card>
    </section>
  );
}
