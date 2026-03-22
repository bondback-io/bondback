import Link from "next/link";
import { redirect } from "next/navigation";
import { format } from "date-fns";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Database } from "@/types/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { AdminShell } from "@/components/admin/admin-shell";
import { AdminDeleteListingButton } from "@/components/admin/admin-delete-listing-button";
import { adminForceEndListing, adminResetAllListings } from "@/lib/actions/admin-listings";

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
type ListingRow = Database["public"]["Tables"]["listings"]["Row"];

interface AdminListingsPageProps {
  searchParams?: {
    q?: string;
    status?: string;
  };
}

async function requireAdmin() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    redirect("/");
  }

  const { data: profileData } = await supabase
    .from("profiles")
    .select("id, full_name, is_admin")
    .eq("id", session.user.id)
    .maybeSingle();

  const profile = profileData as ProfileRow | null;
  if (!profile || !profile.is_admin) {
    redirect("/dashboard");
  }

  return { profile, supabase };
}

export default async function AdminListingsPage({ searchParams }: AdminListingsPageProps) {
  const { profile, supabase } = await requireAdmin();

  const q = (searchParams?.q ?? "").trim().toLowerCase();
  const statusFilter = (searchParams?.status ?? "all").toLowerCase();

  const { data: listingsData } = await supabase
    .from("listings")
    .select("*")
    .order("created_at", { ascending: false });

  const listings = (listingsData ?? []) as ListingRow[];

  // Determine which listings have already been converted into jobs (assigned to a cleaner).
  const listingIds = listings.map((l) => l.id).filter((id) => id != null);
  const assignedListingIds = new Set<string | number>();
  const bidCountByListingId = new Map<string | number, number>();

  if (listingIds.length > 0) {
    const [jobsRes, bidsRes] = await Promise.all([
      supabase.from("jobs").select("listing_id").in("listing_id", listingIds),
      supabase.from("bids").select("listing_id").in("listing_id", listingIds),
    ]);

    (jobsRes.data ?? []).forEach((job: { listing_id: string | number | null }) => {
      if (job.listing_id != null) assignedListingIds.add(job.listing_id);
    });

    (bidsRes.data ?? []).forEach((row: { listing_id: string | number }) => {
      const lid = row.listing_id;
      bidCountByListingId.set(lid, (bidCountByListingId.get(lid) ?? 0) + 1);
    });
  }

  const listerIds = Array.from(new Set(listings.map((l) => l.lister_id).filter(Boolean))) as string[];
  const profilesMap = new Map<string, { full_name: string | null }>();

  if (listerIds.length > 0) {
    const { data: listers } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", listerIds);
    (listers ?? []).forEach((p: any) => {
      profilesMap.set(p.id, { full_name: p.full_name });
    });
  }

  const filtered = listings.filter((listing) => {
    // Once a listing has an associated job (assigned to a cleaner), it appears in Jobs, not here.
    if (assignedListingIds.has(listing.id)) {
      return false;
    }

    const status = ((listing.status as string | null) ?? "").toLowerCase();
    const matchesStatus =
      statusFilter === "all" ? true : status === statusFilter;

    if (!matchesStatus) return false;

    if (!q) return true;

    const title = (listing.title ?? "").toLowerCase();
    const suburb = (listing.suburb ?? "").toLowerCase();
    const idMatch = String(listing.id).includes(q);

    return title.includes(q) || suburb.includes(q) || idMatch;
  });

  return (
    <AdminShell activeHref="/admin/listings">
      <div className="space-y-4 md:space-y-6">
        <Card className="border-border bg-card/80 shadow-sm dark:border-gray-800 dark:bg-gray-900/80">
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
            <div>
              <CardTitle className="text-lg font-semibold tracking-tight md:text-xl dark:text-gray-100">
                Listings moderation
              </CardTitle>
              <p className="text-xs text-muted-foreground dark:text-gray-400">
                {profile.full_name ?? "Admin"} · Review, search and moderate bond clean listings.
              </p>
            </div>
            <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
              {filtered.length} of {listings.length} listings
            </Badge>
          </CardHeader>
        </Card>

        {/* Filters */}
        <Card className="border-border bg-card/80 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <CardContent className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between">
            <form className="flex w-full max-w-md items-center gap-2" action="/admin/listings" method="GET">
              <Input
                type="search"
                name="q"
                defaultValue={searchParams?.q ?? ""}
                placeholder="Search by ID, title or suburb"
                className="h-9 text-sm dark:bg-gray-800 dark:border-gray-700"
              />
              <select
                name="status"
                defaultValue={searchParams?.status ?? "all"}
                className="h-9 rounded-md border border-border bg-background px-2 text-xs dark:border-gray-700 dark:bg-gray-900"
              >
                <option value="all">All statuses</option>
                <option value="live">Live</option>
                <option value="ended">Ended</option>
                <option value="cancelled">Cancelled</option>
                <option value="draft">Draft</option>
              </select>
              <Button type="submit" size="sm" className="whitespace-nowrap">
                Apply
              </Button>
            </form>
            <p className="text-xs text-muted-foreground dark:text-gray-400">
              Showing{" "}
              <span className="font-semibold">
                {filtered.length} of {listings.length}
              </span>{" "}
              listings
            </p>
          </CardContent>
        </Card>

        {/* Table */}
        <Card className="border-border bg-card/80 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <CardHeader>
            <CardTitle className="text-base md:text-lg dark:text-gray-100">
              All listings
            </CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto p-0">
            {filtered.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground dark:text-gray-400">
                No listings match your filters.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="dark:border-gray-800">
                    <TableHead>ID</TableHead>
                    <TableHead className="hidden md:table-cell">Lister</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead className="hidden sm:table-cell">Suburb</TableHead>
                    <TableHead className="text-right whitespace-nowrap">Price</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="hidden sm:table-cell text-right">Bids</TableHead>
                    <TableHead className="hidden lg:table-cell">Created</TableHead>
                    <TableHead className="w-40">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((listing) => {
                    const lister = listing.lister_id
                      ? profilesMap.get(listing.lister_id) ?? null
                      : null;
                    const status = (listing.status as string | null) ?? "draft";
                    const statusClass =
                      status === "live"
                        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200"
                        : status === "ended"
                          ? "bg-slate-100 text-slate-800 dark:bg-slate-800/60 dark:text-slate-200"
                          : status === "cancelled"
                            ? "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200"
                            : "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200";

                    return (
                      <TableRow key={listing.id} className="dark:border-gray-800">
                        <TableCell className="text-xs font-medium text-foreground dark:text-gray-100">
                          #{listing.id}
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-xs text-muted-foreground dark:text-gray-400">
                          {lister?.full_name ?? "—"}
                        </TableCell>
                        <TableCell className="text-xs sm:text-sm">
                          <Link
                            href={`/listings/${listing.id}`}
                            className="font-medium text-primary underline-offset-4 hover:underline"
                          >
                            {listing.title ?? "Untitled listing"}
                          </Link>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell text-xs text-muted-foreground dark:text-gray-400">
                          {listing.suburb ?? "—"}
                        </TableCell>
                        <TableCell className="text-right text-xs tabular-nums text-foreground dark:text-gray-100">
                          {listing.current_lowest_bid_cents != null
                            ? `$${(listing.current_lowest_bid_cents / 100).toFixed(0)}`
                            : listing.reserve_cents != null
                              ? `Reserve $${(listing.reserve_cents / 100).toFixed(0)}`
                              : "—"}
                        </TableCell>
                        <TableCell>
                          <Badge
                            className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${statusClass}`}
                          >
                            {status.replace("_", " ")}
                          </Badge>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell text-right text-xs tabular-nums text-muted-foreground dark:text-gray-400">
                          {bidCountByListingId.get(listing.id) ?? 0}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell text-xs text-muted-foreground dark:text-gray-400 whitespace-nowrap">
                          {listing.created_at
                            ? format(new Date(listing.created_at), "dd MMM yyyy")
                            : "—"}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            <Button
                              asChild
                              size="xs"
                              variant="outline"
                              className="text-[11px]"
                            >
                              <Link href={`/listings/${listing.id}`}>View</Link>
                            </Button>
                            {status !== "ended" && (
                              <form action={adminForceEndListing}>
                                <input
                                  type="hidden"
                                  name="listingId"
                                  value={listing.id}
                                />
                                <Button
                                  type="submit"
                                  size="xs"
                                  variant="outline"
                                  className="text-[11px]"
                                >
                                  Force end
                                </Button>
                              </form>
                            )}
                            <AdminDeleteListingButton listingId={listing.id} />
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card className="border-border bg-card/80 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <CardHeader>
            <CardTitle className="text-sm font-semibold dark:text-gray-100">
              Dangerous: Reset all listings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form action={adminResetAllListings} className="space-y-3 text-xs text-muted-foreground dark:text-gray-300">
              <p>
                This will permanently delete <strong>all listings</strong> and their associated
                jobs, messages and bids. This action cannot be undone.
              </p>
              <label className="flex items-center gap-2">
                <input type="checkbox" name="confirm" className="h-3 w-3" />
                <span>I understand this cannot be undone.</span>
              </label>
              <div className="flex flex-wrap items-center gap-2">
                <span>Type &quot;delete&quot; to confirm:</span>
                <input
                  type="text"
                  name="confirmText"
                  className="h-7 rounded-md border border-border bg-background px-2 text-xs dark:border-gray-700 dark:bg-gray-900"
                />
              </div>
              <Button
                type="submit"
                size="sm"
                variant="destructive"
                className="mt-1"
              >
                Reset ALL Listings
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </AdminShell>
  );
}
