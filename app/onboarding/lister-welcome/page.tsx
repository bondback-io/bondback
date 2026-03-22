import { redirect } from "next/navigation";
import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { Database } from "@/types/supabase";
import { Home } from "lucide-react";

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

export default async function ListerWelcomePage() {
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

  if (!roles.includes("lister")) {
    redirect("/dashboard");
  }

  return (
    <section className="page-inner flex justify-center">
      <Card className="w-full max-w-lg border-border dark:border-gray-800 dark:bg-gray-900">
        <CardHeader className="space-y-2">
          <div className="flex items-center gap-2">
            <Home className="h-8 w-8 text-sky-600 dark:text-sky-400" />
            <CardTitle className="text-xl font-semibold tracking-tight dark:text-gray-100">
              Lister role unlocked
            </CardTitle>
          </div>
          <CardDescription className="text-sm dark:text-gray-400">
            You can now list bond clean jobs, receive bids, and hire cleaners. Head to your dashboard to create a listing.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild className="dark:bg-gray-800 dark:hover:bg-gray-700">
            <Link href="/dashboard">Go to Dashboard</Link>
          </Button>
        </CardContent>
      </Card>
    </section>
  );
}
