import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { Database } from "@/types/supabase";
import { Briefcase, CheckCircle2 } from "lucide-react";

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

export const metadata: Metadata = {
  title: "Welcome, cleaner",
  description:
    "Welcome to Bond Back as a cleaner — bid on bond cleaning and end of lease jobs near you.",
};

export default async function CleanerWelcomePage() {
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

  if (!roles.includes("cleaner")) {
    redirect("/dashboard");
  }

  return (
    <section className="page-inner flex justify-center">
      <Card className="w-full max-w-lg border-border dark:border-gray-800 dark:bg-gray-900">
        <CardHeader className="space-y-2">
          <div className="flex items-center gap-2">
            <Briefcase className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
            <CardTitle className="text-xl font-semibold tracking-tight dark:text-gray-100">
              Cleaner role unlocked
            </CardTitle>
          </div>
          <CardDescription className="text-sm dark:text-gray-400">
            You can now bid on bond clean jobs and get hired. Quick tips:
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ul className="space-y-2 text-sm dark:text-gray-200">
            <li className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400 mt-0.5" />
              <span>Complete your cleaner profile (location, travel range, ABN) so listers can find you.</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400 mt-0.5" />
              <span>Browse open jobs and place bids. Listers choose a cleaner and you get the job.</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400 mt-0.5" />
              <span>Switch between Lister and Cleaner anytime using the role switcher in the header.</span>
            </li>
          </ul>
          <div className="flex flex-wrap gap-3 pt-2">
            <Button asChild className="dark:bg-gray-800 dark:hover:bg-gray-700">
              <Link href="/onboarding/cleaner">Complete cleaner profile</Link>
            </Button>
            <Button variant="outline" asChild className="dark:border-gray-700 dark:hover:bg-gray-800">
              <Link href="/jobs">Browse jobs</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
