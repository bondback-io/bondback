import { redirect } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { fetchUserCalendarPayload } from "@/lib/calendar/fetch-user-calendar";
import { UserCalendarClient } from "@/components/calendar/user-calendar-client";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "My calendar",
  description:
    "Preferred cleaning dates, recurring visits, and key milestones for your Bond Back jobs and listings.",
  alternates: { canonical: "/calendar" },
  robots: { index: false, follow: true },
};

export default async function CalendarPage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    redirect("/login?next=/calendar");
  }

  const initial = await fetchUserCalendarPayload(session.user.id);

  return (
    <section className="page-inner">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <Button variant="outline" size="sm" asChild className="w-fit">
          <Link href="/dashboard">Back to dashboard</Link>
        </Button>
      </div>
      <UserCalendarClient initial={initial} />
    </section>
  );
}
