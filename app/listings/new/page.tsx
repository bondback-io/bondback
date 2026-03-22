import { redirect } from "next/navigation";
import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getGlobalSettings } from "@/lib/actions/global-settings";
import { NewListingForm } from "@/components/features/new-listing-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { Database } from "@/types/supabase";
import { Home, LogIn } from "lucide-react";

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

const NewListingPage = async () => {
  const supabase = await createServerSupabaseClient();

  const {
    data: { session }
  } = await supabase.auth.getSession();

  if (!session) {
    redirect("/login");
  }

  const { data } = await supabase
    .from("profiles")
    .select("*, roles, active_role")
    .eq("id", session.user.id)
    .maybeSingle();

  const profile = data as (ProfileRow & { roles?: string[] | null; active_role?: string | null }) | null;
  if (!profile) {
    redirect("/onboarding");
  }

  const roles = (profile.roles as string[] | null) ?? [];
  const activeRole = (profile.active_role as string | null) ?? roles[0] ?? "lister";

  // Only listers can create listings. Cleaners see a prompt to switch to Lister.
  if (activeRole !== "lister") {
    const hasListerRole = roles.includes("lister");

    return (
      <section className="page-inner flex min-h-[50vh] items-center justify-center p-4">
        <Card className="w-full max-w-md border-border shadow-sm dark:border-gray-800 dark:bg-gray-900/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg text-foreground dark:text-gray-100">
              <Home className="h-5 w-5 text-muted-foreground" />
              Create a listing
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Creating bond clean listings is for <strong className="text-foreground dark:text-gray-100">Listers</strong>. You’re currently signed in as a <strong>Cleaner</strong>.
            </p>
            {hasListerRole ? (
              <p className="text-sm text-muted-foreground">
                Switch to your Lister role in the header (or from your dashboard) to create and manage listings.
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                Log in with a Lister account to create a bond clean listing, or use the same account after adding the Lister role.
              </p>
            )}
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button asChild className="w-full sm:w-auto">
                <Link href="/dashboard">
                  <LogIn className="mr-2 h-4 w-4" />
                  Back to dashboard
                </Link>
              </Button>
              {hasListerRole && (
                <Button asChild variant="outline" className="w-full sm:w-auto">
                  <Link href="/settings">Account &amp; role settings</Link>
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </section>
    );
  }

  const settings = await getGlobalSettings();
  const feePercentage =
    (typeof settings?.platform_fee_percentage === "number" &&
      settings.platform_fee_percentage > 0 &&
      settings.platform_fee_percentage) ||
    (typeof settings?.fee_percentage === "number" &&
      settings.fee_percentage > 0 &&
      settings.fee_percentage) ||
    12;

  return (
    <NewListingForm
      listerId={session.user.id}
      listerSuburb={profile.suburb ?? undefined}
      listerPostcode={profile.postcode ?? ""}
      feePercentage={feePercentage}
    />
  );
};

export default NewListingPage;
