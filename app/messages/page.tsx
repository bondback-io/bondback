import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Database } from "@/types/supabase";
import { MessagesPageClient } from "@/components/features/messages-page-client";
import { CHAT_UNLOCK_STATUSES } from "@/lib/chat-unlock";
import { effectiveMessengerRoleFromProfile } from "@/lib/chat-participant-role";
import {
  fetchMessengerPeerProfilesByIds,
  MESSENGER_PEER_PROFILE_SELECT,
} from "@/lib/messenger-peer-profiles-server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { normalizeChatUid } from "@/lib/chat-participant-role";

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
    .select("active_role, roles")
    .eq("id", session.user.id)
    .maybeSingle();
  const activeAppRole =
    (profileRow as { active_role: "lister" | "cleaner" | null } | null)?.active_role ??
    null;
  const messengerRoleFilter = effectiveMessengerRoleFromProfile({
    active_role: (profileRow as { active_role?: string | null } | null)?.active_role ?? null,
    roles: (profileRow as { roles?: string[] | null } | null)?.roles ?? null,
  });

  // Jobs where messenger is allowed for the user’s current marketplace mode (lister vs cleaner).
  // Dual-role users must not see cleaner threads while in lister mode, and vice versa.
  let jobsQuery = supabase
    .from("jobs")
    .select("*")
    .in("status", [...CHAT_UNLOCK_STATUSES])
    .order("created_at", { ascending: false });
  if (messengerRoleFilter === "lister") {
    jobsQuery = jobsQuery.eq("lister_id", session.user.id);
  } else {
    jobsQuery = jobsQuery.eq("winner_id", session.user.id);
  }
  const { data: jobsData } = await jobsQuery;

  const jobs = (jobsData ?? []) as JobRow[];

  if (!jobs.length) {
    return (
      <section className="page-inner space-y-6">
        <div className="space-y-3">
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl dark:text-gray-100">
            Messages
          </h1>
          <p className="text-sm text-muted-foreground">
            You don&apos;t have any job conversations in your current{" "}
            {messengerRoleFilter === "cleaner" ? "Cleaner" : "Lister"} mode. Switch role in the
            header if you expected a different inbox, or check back once a matching job is active.
          </p>
        </div>
      </section>
    );
  }

  const jobIds = jobs.map((j) => j.id);
  const listingIds = jobs.map((j) => j.listing_id);

  const peerUserIds = Array.from(
    new Set(
      jobs
        .map((j) => [j.lister_id, j.winner_id])
        .flat()
        .filter(Boolean) as string[]
    )
  );

  const [{ data: messagesData }, { data: listingsData }, profilesData] = await Promise.all([
    supabase
      .from("job_messages")
      .select("*")
      .in("job_id", jobIds)
      .order("created_at", { ascending: false }),
    supabase
      .from("listings")
      .select("*")
      .in("id", listingIds),
    fetchMessengerPeerProfilesByIds(peerUserIds),
  ]);

  const messages = (messagesData ?? []) as JobMessageRow[];
  const listings = (listingsData ?? []) as ListingRow[];
  let profiles = (profilesData ?? []) as ProfileRow[];

  /** If RLS returned only the signed-in user, merge any missing job peers via service role (same as `fetchMessengerPeerProfilesByIds` when admin is available). */
  const havePeerNorm = new Set(
    profiles.map((p) => normalizeChatUid(String(p.id ?? ""))).filter(Boolean)
  );
  const missingPeerIds = peerUserIds.filter(
    (id) => id && !havePeerNorm.has(normalizeChatUid(id))
  );
  if (missingPeerIds.length > 0) {
    const admin = createSupabaseAdminClient();
    if (admin) {
      const { data: extra } = await admin
        .from("profiles")
        .select(MESSENGER_PEER_PROFILE_SELECT)
        .in("id", missingPeerIds);
      const seen = new Set(havePeerNorm);
      for (const row of extra ?? []) {
        const id = String((row as { id?: string }).id ?? "");
        const k = normalizeChatUid(id);
        if (k && !seen.has(k)) {
          seen.add(k);
          profiles = [...profiles, row as ProfileRow];
        }
      }
    }
  }

  return (
    <section className="page-inner space-y-3 pb-28 pt-2 sm:space-y-6 sm:py-8 md:pb-8">
      <div className="space-y-1 sm:space-y-2">
        <h1 className="text-lg font-semibold tracking-tight sm:text-2xl md:text-3xl dark:text-gray-100">
          Messages
        </h1>
        <p className="text-[11px] leading-snug text-muted-foreground sm:text-sm sm:leading-normal">
          Job chats stay on Bond Back for escrow and disputes. Pick a thread — job title, price, status, and{" "}
          <span className="font-medium text-foreground/80 dark:text-slate-300">View job</span> live in the chat header.
        </p>
      </div>

      <MessagesPageClient
        currentUserId={session.user.id}
        activeAppRole={activeAppRole}
        messengerRoleFilter={messengerRoleFilter}
        jobs={jobs}
        listings={listings}
        messages={messages}
        profiles={profiles}
      />
    </section>
  );
};

export default MessagesPage;

