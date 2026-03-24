import { redirect } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Database } from "@/types/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { NotificationsList } from "@/components/features/notifications-list";

type NotificationRow = Database["public"]["Tables"]["notifications"]["Row"];

export const metadata: Metadata = {
  title: "Notifications",
  description:
    "Bond Back notifications for bids, jobs, payments, and bond cleaning updates in Australia.",
  alternates: { canonical: "/notifications" },
  robots: { index: false, follow: true },
};

export default async function NotificationsPage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    redirect("/login?next=/notifications");
  }

  const { data: profileRow } = await supabase
    .from("profiles")
    .select("active_role")
    .eq("id", session.user.id)
    .maybeSingle();
  const ar = (profileRow as { active_role?: string } | null)?.active_role;
  const activeRole =
    ar === "lister" || ar === "cleaner" ? ar : null;

  const { data: rows } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", session.user.id)
    .order("created_at", { ascending: false })
    .limit(100);

  const notifications = (rows ?? []) as NotificationRow[];

  return (
    <section className="page-inner space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight dark:text-gray-100">
            Notifications
          </h1>
          <p className="text-sm text-muted-foreground dark:text-gray-400">
            Job updates, messages, and dispute activity.
          </p>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link href="/dashboard">Back to dashboard</Link>
        </Button>
      </div>

      <Card className="border-border dark:border-gray-800 dark:bg-gray-900/80">
        <CardHeader>
          <CardTitle className="text-base dark:text-gray-100">All notifications</CardTitle>
        </CardHeader>
        <CardContent>
          <NotificationsList
            initialNotifications={notifications}
            currentUserId={session.user.id}
            activeRole={activeRole}
          />
        </CardContent>
      </Card>
    </section>
  );
}
