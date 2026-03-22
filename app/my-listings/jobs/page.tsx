import { redirect } from "next/navigation";
import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Database } from "@/types/supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, Briefcase, CheckCircle2 } from "lucide-react";
import { getListingCoverUrl, formatCents } from "@/lib/listings";
import { formatLocationWithState } from "@/lib/state-from-postcode";

type ListingRow = Database["public"]["Tables"]["listings"]["Row"];
type JobRow = { id: number; listing_id: string; status: string };

type SearchParams = { tab?: string };

export default async function MyListingsJobsPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const supabase = await createServerSupabaseClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) redirect("/login");

  const params = searchParams ? await searchParams : {};
  const tabParam = params.tab ?? "active";
  const tab = tabParam === "completed" ? "completed" : tabParam === "cancelled" ? "cancelled" : "active";

  const { data: profile } = await supabase
    .from("profiles")
    .select("roles, active_role")
    .eq("id", session.user.id)
    .maybeSingle();

  const roles = (profile?.roles as string[] | null) ?? [];
  const activeRole = (profile?.active_role as string | null) ?? roles[0];
  if (!roles.includes("lister") || activeRole !== "lister") {
    redirect("/dashboard");
  }

  const { data: listingsData } = await supabase
    .from("listings")
    .select("*")
    .eq("lister_id", session.user.id)
    .order("created_at", { ascending: false });

  const { data: jobsData } = await supabase
    .from("jobs")
    .select("id, listing_id, status")
    .eq("lister_id", session.user.id);

  const listings = (listingsData ?? []) as ListingRow[];
  const jobs = (jobsData ?? []) as JobRow[];
  const listingMap = new Map(listings.map((l) => [l.id, l]));

  const activeJobs = jobs.filter(
    (j) =>
      j.status === "accepted" ||
      j.status === "in_progress" ||
      j.status === "completed_pending_approval"
  );
  const completedJobs = jobs.filter((j) => j.status === "completed");
  const cancelledJobs = jobs.filter((j) => j.status === "cancelled");

  return (
    <section className="page-inner space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl dark:text-gray-100">
          My Jobs
        </h1>
        <p className="mt-1 text-sm text-muted-foreground dark:text-gray-400">
          Active jobs in progress and your completed bond cleans.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          asChild
          variant={tab === "active" ? "default" : "outline"}
          size="sm"
        >
          <Link href="/my-listings/jobs?tab=active">
            Active ({activeJobs.length})
          </Link>
        </Button>
        <Button
          asChild
          variant={tab === "completed" ? "default" : "outline"}
          size="sm"
        >
          <Link href="/my-listings/jobs?tab=completed">
            Completed ({completedJobs.length})
          </Link>
        </Button>
        <Button
          asChild
          variant={tab === "cancelled" ? "default" : "outline"}
          size="sm"
        >
          <Link href="/my-listings/jobs?tab=cancelled">
            Cancelled
          </Link>
        </Button>
      </div>

      {tab === "active" && (
        <Card className="border-border dark:border-gray-800 dark:bg-gray-900/50">
          <CardHeader>
            <CardTitle className="text-lg dark:text-gray-100">
              Active jobs
            </CardTitle>
            <p className="text-sm text-muted-foreground dark:text-gray-400">
              Jobs awaiting your approval or currently in progress with a cleaner.
            </p>
          </CardHeader>
          <CardContent>
            {activeJobs.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border bg-muted/30 py-12 text-center dark:bg-gray-800/30">
                <Briefcase className="mx-auto h-10 w-10 text-muted-foreground dark:text-gray-500" />
                <p className="mt-3 font-medium text-foreground dark:text-gray-100">
                  No active jobs
                </p>
                <p className="mt-1 text-sm text-muted-foreground dark:text-gray-400">
                  When a cleaner wins an auction or you accept a bid, the job will appear here.
                </p>
                <Button asChild variant="outline" size="sm" className="mt-4">
                  <Link href="/my-listings">View my listings</Link>
                </Button>
              </div>
            ) : (
              <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {activeJobs.map((job) => {
                  const listing = listingMap.get(job.listing_id);
                  if (!listing) return null;
                  const cover = getListingCoverUrl(listing);
                  return (
                    <li key={job.id}>
                      <Link
                        href={`/jobs/${job.id}`}
                        className="flex flex-col overflow-hidden rounded-lg border border-border bg-card text-left shadow-sm transition hover:border-primary/50 hover:shadow-md dark:border-gray-800 dark:bg-gray-900 dark:hover:border-primary/40"
                      >
                        <div className="relative aspect-[16/10] w-full shrink-0 bg-muted dark:bg-gray-800">
                          {cover ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={cover}
                              alt=""
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-muted-foreground dark:text-gray-400">
                              <Briefcase className="h-10 w-10" />
                            </div>
                          )}
                          <Badge className="absolute right-2 top-2 bg-sky-600 text-white dark:bg-sky-500">
                            {job.status === "accepted"
                              ? "Awaiting approval"
                              : job.status === "completed_pending_approval"
                                ? "Pending review"
                                : "In progress"}
                          </Badge>
                        </div>
                        <div className="flex flex-1 flex-col gap-1.5 p-3">
                          <p className="line-clamp-2 text-sm font-medium text-foreground dark:text-gray-100">
                            {listing.title}
                          </p>
                          <p className="flex items-center gap-1 text-xs text-muted-foreground dark:text-gray-400">
                            <MapPin className="h-3 w-3 shrink-0" />
                            {formatLocationWithState(listing.suburb, listing.postcode)}
                          </p>
                          <p className="text-xs font-medium text-foreground dark:text-gray-100">
                            View job →
                          </p>
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      )}

      {tab === "completed" && (
        <Card className="border-border dark:border-gray-800 dark:bg-gray-900/50">
          <CardHeader>
            <CardTitle className="text-lg dark:text-gray-100">
              Completed jobs
            </CardTitle>
            <p className="text-sm text-muted-foreground dark:text-gray-400">
              Past bond cleans and outcomes.
            </p>
          </CardHeader>
          <CardContent>
            {completedJobs.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border bg-muted/30 py-12 text-center dark:bg-gray-800/30">
                <CheckCircle2 className="mx-auto h-10 w-10 text-muted-foreground dark:text-gray-500" />
                <p className="mt-3 font-medium text-foreground dark:text-gray-100">
                  No completed jobs yet
                </p>
                <p className="mt-1 text-sm text-muted-foreground dark:text-gray-400">
                  Completed jobs will appear here for review and history.
                </p>
                <Button asChild variant="outline" size="sm" className="mt-4">
                  <Link href="/my-listings">View my listings</Link>
                </Button>
              </div>
            ) : (
              <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {completedJobs.map((job) => {
                  const listing = listingMap.get(job.listing_id);
                  if (!listing) return null;
                  const cover = getListingCoverUrl(listing);
                  const amount = (listing as { current_lowest_bid_cents?: number }).current_lowest_bid_cents;
                  return (
                    <li key={job.id}>
                      <Link
                        href={`/jobs/${job.id}`}
                        className="flex flex-col overflow-hidden rounded-lg border border-border bg-card text-left shadow-sm transition hover:border-primary/50 hover:shadow-md dark:border-gray-800 dark:bg-gray-900 dark:hover:border-primary/40"
                      >
                        <div className="relative aspect-[16/10] w-full shrink-0 bg-muted dark:bg-gray-800">
                          {cover ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={cover}
                              alt=""
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-muted-foreground dark:text-gray-400">
                              <CheckCircle2 className="h-10 w-10" />
                            </div>
                          )}
                          <Badge className="absolute right-2 top-2 bg-emerald-600 text-white dark:bg-emerald-500">
                            Completed
                          </Badge>
                        </div>
                        <div className="flex flex-1 flex-col gap-1.5 p-3">
                          <p className="line-clamp-2 text-sm font-medium text-foreground dark:text-gray-100">
                            {listing.title}
                          </p>
                          <p className="flex items-center gap-1 text-xs text-muted-foreground dark:text-gray-400">
                            <MapPin className="h-3 w-3 shrink-0" />
                            {formatLocationWithState(listing.suburb, listing.postcode)}
                          </p>
                          {typeof amount === "number" && (
                            <p className="text-xs font-medium text-foreground dark:text-gray-100">
                              {formatCents(amount)}
                            </p>
                          )}
                          <p className="text-xs text-muted-foreground dark:text-gray-400">
                            View job →
                          </p>
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      )}

      {tab === "cancelled" && (
        <Card className="border-border dark:border-gray-800 dark:bg-gray-900/50">
          <CardHeader>
            <CardTitle className="text-lg dark:text-gray-100">
              Cancelled jobs
            </CardTitle>
            <p className="text-sm text-muted-foreground dark:text-gray-400">
              Jobs you cancelled. Click to view details.
            </p>
          </CardHeader>
          <CardContent>
            {cancelledJobs.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border bg-muted/30 py-12 text-center dark:bg-gray-800/30">
                <Briefcase className="mx-auto h-10 w-10 text-muted-foreground dark:text-gray-500" />
                <p className="mt-3 font-medium text-foreground dark:text-gray-100">
                  No cancelled jobs
                </p>
                <p className="mt-1 text-sm text-muted-foreground dark:text-gray-400">
                  Cancelled jobs will appear here for history.
                </p>
                <Button asChild variant="outline" size="sm" className="mt-4">
                  <Link href="/my-listings">View my listings</Link>
                </Button>
              </div>
            ) : (
              <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {cancelledJobs.map((job) => {
                  const listing = listingMap.get(job.listing_id);
                  if (!listing) return null;
                  const cover = getListingCoverUrl(listing);
                  return (
                    <li key={job.id}>
                      <Link
                        href={`/jobs/${job.id}`}
                        className="flex flex-col overflow-hidden rounded-lg border border-border bg-card text-left shadow-sm transition hover:border-primary/50 hover:shadow-md dark:border-gray-800 dark:bg-gray-900 dark:hover:border-primary/40"
                      >
                        <div className="relative aspect-[16/10] w-full shrink-0 bg-muted dark:bg-gray-800">
                          {cover ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={cover}
                              alt=""
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-muted-foreground dark:text-gray-400">
                              <Briefcase className="h-10 w-10" />
                            </div>
                          )}
                          <Badge className="absolute right-2 top-2 bg-red-600 text-white dark:bg-red-500">
                            Cancelled
                          </Badge>
                        </div>
                        <div className="flex flex-1 flex-col gap-1.5 p-3">
                          <p className="line-clamp-2 text-sm font-medium text-foreground dark:text-gray-100">
                            {listing.title}
                          </p>
                          <p className="flex items-center gap-1 text-xs text-muted-foreground dark:text-gray-400">
                            <MapPin className="h-3 w-3 shrink-0" />
                            {formatLocationWithState(listing.suburb, listing.postcode)}
                          </p>
                          <p className="text-xs text-muted-foreground dark:text-gray-400">
                            View job →
                          </p>
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      )}

      <div className="flex flex-wrap gap-2">
        <Button asChild variant="outline" size="sm">
          <Link href="/dashboard">Back to dashboard</Link>
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link href="/my-listings">My listings</Link>
        </Button>
      </div>
    </section>
  );
}
