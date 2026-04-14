import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Database } from "@/types/supabase";
import { MessagesPageClient } from "@/components/features/messages-page-client";
import { CHAT_UNLOCK_STATUSES } from "@/lib/chat-unlock";

type JobRow = Database["public"]["Tables"]["jobs"]["Row"];
type ListingRow = Database["public"]["Tables"]["listings"]["Row"];
type JobMessageRow = Database["public"]["Tables"]["job_messages"]["Row"];
type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

export const metadata: Metadata = {
  title: "Messages",
  description:
    "Job messages between listers and cleaners on Bond Back — bond cleaning coordination in Australia.",
  alternates: { canonical: "/messages" },
  robots: { index: false, follow: true },
};

const MessagesPage = async () => {
  const supabase = await createServerSupabaseClient();

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    redirect("/login");
  }

  const { data: profileRow } = await supabase
    .from("profiles")
    .select("active_role")
    .eq("id", session.user.id)
    .maybeSingle();
  const activeAppRole =
    (profileRow as { active_role: "lister" | "cleaner" | null } | null)?.active_role ??
    null;

  // Jobs where messenger is allowed (matches server `sendJobMessage` + RLS).
  const { data: jobsData } = await supabase
    .from("jobs")
    .select("*")
    .or(
      `lister_id.eq.${session.user.id},winner_id.eq.${session.user.id}`,
    )
    .in("status", [...CHAT_UNLOCK_STATUSES])
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
      <div className="space-y-2">
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl md:text-3xl dark:text-gray-100">
          Messages
        </h1>
        <p className="text-xs text-muted-foreground sm:text-sm">
          Job chats stay on Bond Back for escrow and disputes. Choose a conversation, then message below.
        </p>
      </div>

      <MessagesPageClient
        currentUserId={session.user.id}
        activeAppRole={activeAppRole}
        jobs={jobs}
        listings={listings}
        messages={messages}
        profiles={profiles}
      />
    </section>
  );
};

export default MessagesPage;

