import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Database } from "@/types/supabase";
import { MessagesPageClient } from "@/components/features/messages-page-client";

type JobRow = Database["public"]["Tables"]["jobs"]["Row"];
type ListingRow = Database["public"]["Tables"]["listings"]["Row"];
type JobMessageRow = Database["public"]["Tables"]["job_messages"]["Row"];
type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

const MessagesPage = async () => {
  const supabase = await createServerSupabaseClient();

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    redirect("/login");
  }

  // Only show chat for jobs approved to start (in_progress) or completed.
  // Jobs in "accepted" (waiting for lister to approve) are hidden until approved.
  const { data: jobsData } = await supabase
    .from("jobs")
    .select("*")
    .or(
      `lister_id.eq.${session.user.id},winner_id.eq.${session.user.id}`,
    )
    .in("status", ["in_progress", "completed", "completed_pending_approval"])
    .order("created_at", { ascending: false });

  const jobs = (jobsData ?? []) as JobRow[];

  if (!jobs.length) {
    return (
      <section className="page-inner space-y-6">
        <div className="space-y-3">
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl dark:text-gray-100">
            Messages
          </h1>
          <p className="text-sm text-muted-foreground">
            You don&apos;t have any job conversations yet. Once an auction
            finishes and a job is created, you&apos;ll see it here.
          </p>
        </div>
      </section>
    );
  }

  const jobIds = jobs.map((j) => j.id);
  const listingIds = jobs.map((j) => j.listing_id);

  const [
    { data: messagesData },
    { data: listingsData },
    { data: profilesData },
  ] = await Promise.all([
    supabase
      .from("job_messages")
      .select("*")
      .in("job_id", jobIds)
      .order("created_at", { ascending: false }),
    supabase
      .from("listings")
      .select("*")
      .in("id", listingIds),
    supabase
      .from("profiles")
      .select("*")
      .in(
        "id",
        Array.from(
          new Set(
            jobs
              .map((j) => [j.lister_id, j.winner_id])
              .flat()
              .filter(Boolean) as string[]
          )
        ) as any
      ),
  ]);

  const messages = (messagesData ?? []) as JobMessageRow[];
  const listings = (listingsData ?? []) as ListingRow[];
  const profiles = (profilesData ?? []) as ProfileRow[];

  return (
    <section className="page-inner space-y-6">
      <div className="space-y-3">
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl dark:text-gray-100">
          Messages
        </h1>
        <p className="text-sm text-muted-foreground">
          All your job conversations live here. Pick a job on the left to chat,
          share photos and keep everything inside Bond Back.
        </p>
      </div>

      <MessagesPageClient
        currentUserId={session.user.id}
        jobs={jobs}
        listings={listings}
        messages={messages}
        profiles={profiles}
      />
    </section>
  );
};

export default MessagesPage;

