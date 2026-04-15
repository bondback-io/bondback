import Link from "next/link";
import { redirect } from "next/navigation";
import { endOfDay, format, isValid, parseISO, startOfDay } from "date-fns";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
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
import { LISTING_ADMIN_TABLE_SELECT } from "@/lib/supabase/queries";
import { fetchBidCountsByListingIds } from "@/lib/marketplace/bid-counts";

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
type ListingRow = Database["public"]["Tables"]["listings"]["Row"];

/** PostgREST may return `listings.id` as string or number; normalize for consistent joins. */
function listingIdKey(id: string | number): string {
  return String(id);
}

const SORT_OPTIONS = [
  { value: "created_desc", label: "Created: newest first" },
  { value: "created_asc", label: "Created: oldest first" },
  { value: "end_asc", label: "Time ending: soonest first" },
  { value: "end_desc", label: "Time ending: latest first" },
  { value: "price_asc", label: "Price: low to high" },
  { value: "price_desc", label: "Price: high to low" },
  { value: "bids_asc", label: "Bids: fewest first" },
  { value: "bids_desc", label: "Bids: most first" },
] as const;

type SortValue = (typeof SORT_OPTIONS)[number]["value"];

const SORT_VALUES = new Set<string>(SORT_OPTIONS.map((o) => o.value));

function endTimeMs(listing: ListingRow): number | null {
  const raw = listing.end_time as string | null | undefined;
  if (raw == null || raw === "") return null;
  const t = new Date(raw).getTime();
  return Number.isFinite(t) ? t : null;
}

/** Price used for admin table display, sorting, and price filters (cents). */
function effectiveListingPriceCents(listing: ListingRow): number | null {
  if (listing.current_lowest_bid_cents != null) return listing.current_lowest_bid_cents;
  if (listing.reserve_cents != null) return listing.reserve_cents;
  return null;
}

interface AdminListingsPageProps {
  searchParams?: Promise<{
    q?: string;
    status?: string;
    sort?: string;
    price_min?: string;
    price_max?: string;
    bids?: string;
    created_from?: string;
    created_to?: string;
  }>;
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

  const sp = (await searchParams) ?? {};
  const q = (sp.q ?? "").trim().toLowerCase();
  const statusFilter = (sp.status ?? "all").toLowerCase();
  const sortRaw = (sp.sort ?? "created_desc").toLowerCase();
  const sort: SortValue = SORT_VALUES.has(sortRaw) ? (sortRaw as SortValue) : "created_desc";

  const priceMinParsed = parseInt(String(sp.price_min ?? "").trim(), 10);
  const priceMaxParsed = parseInt(String(sp.price_max ?? "").trim(), 10);
  const priceMinCents =
    Number.isFinite(priceMinParsed) && priceMinParsed >= 0 ? priceMinParsed * 100 : null;
  const priceMaxCents =
    Number.isFinite(priceMaxParsed) && priceMaxParsed >= 0 ? priceMaxParsed * 100 : null;

  const bidsFilter = (sp.bids ?? "all").toLowerCase();
  const bidsFilterNorm =
    bidsFilter === "none" || bidsFilter === "has" ? bidsFilter : "all";

  const createdFromRaw = (sp.created_from ?? "").trim();
  const createdToRaw = (sp.created_to ?? "").trim();
  const createdFromParsed = createdFromRaw ? parseISO(createdFromRaw) : null;
  const createdToParsed = createdToRaw ? parseISO(createdToRaw) : null;
  const createdFromStart =
    createdFromParsed && isValid(createdFromParsed)
      ? startOfDay(createdFromParsed)
      : null;
  const createdToEnd =
    createdToParsed && isValid(createdToParsed) ? endOfDay(createdToParsed) : null;

  /** Service role bypasses RLS so admin can see all listings and lister names. */
  const db = (createSupabaseAdminClient() ?? supabase) as SupabaseClient<Database>;

  const { data: listingsData } = await db
    .from("listings")
    .select(LISTING_ADMIN_TABLE_SELECT)
    .order("created_at", { ascending: false });

  const rawListings = (listingsData ?? []) as ListingRow[];
  const listings = Array.from(
    new Map(rawListings.map((l) => [listingIdKey(l.id as string | number), l])).values()
  );

  // Determine which listings have already been converted into jobs (assigned to a cleaner).
  const listingIds = listings.map((l) => l.id).filter((id) => id != null);
  const assignedListingIds = new Set<string>();
  const bidCountByListingId = new Map<string, number>();

  if (listingIds.length > 0) {
    const [jobsRes, bidCountsRecord] = await Promise.all([
      db.from("jobs").select("listing_id").in("listing_id", listingIds),
      fetchBidCountsByListingIds(db, listingIds),
    ]);

    (jobsRes.data ?? []).forEach((job: { listing_id: string | number | null }) => {
      if (job.listing_id != null) assignedListingIds.add(listingIdKey(job.listing_id));
    });

    for (const [lid, n] of Object.entries(bidCountsRecord)) {
      bidCountByListingId.set(listingIdKey(lid), n);
    }
  }

  const listerIds = Array.from(new Set(listings.map((l) => l.lister_id).filter(Boolean))) as string[];
  const profilesMap = new Map<string, { full_name: string | null }>();

  if (listerIds.length > 0) {
    const { data: listers } = await db.from("profiles").select("id, full_name").in("id", listerIds);
    (listers ?? []).forEach((p: { id: string; full_name: string | null }) => {
      profilesMap.set(p.id, { full_name: p.full_name });
    });
  }

  const filtered = listings.filter((listing) => {
    // Once a listing has an associated job (assigned to a cleaner), it appears in Jobs, not here.
    if (assignedListingIds.has(listingIdKey(listing.id as string | number))) {
      return false;
    }

    const status = ((listing.status as string | null) ?? "").toLowerCase();
    const matchesStatus =
      statusFilter === "all" ? true : status === statusFilter;

    if (!matchesStatus) return false;

    if (q) {
      const title = (listing.title ?? "").toLowerCase();
      const suburb = (listing.suburb ?? "").toLowerCase();
      const idMatch = String(listing.id).includes(q);
      if (!title.includes(q) && !suburb.includes(q) && !idMatch) return false;
    }

    const bidCount =
      bidCountByListingId.get(listingIdKey(listing.id as string | number)) ?? 0;
    if (bidsFilterNorm === "none" && bidCount !== 0) return false;
    if (bidsFilterNorm === "has" && bidCount < 1) return false;

    const priceCents = effectiveListingPriceCents(listing);
    if (priceMinCents != null) {
      if (priceCents == null || priceCents < priceMinCents) return false;
    }
    if (priceMaxCents != null) {
      if (priceCents == null || priceCents > priceMaxCents) return false;
    }

    if (createdFromStart && listing.created_at) {
      const ca = new Date(listing.created_at).getTime();
      if (!Number.isFinite(ca) || ca < createdFromStart.getTime()) return false;
    }
    if (createdToEnd && listing.created_at) {
      const ca = new Date(listing.created_at).getTime();
      if (!Number.isFinite(ca) || ca > createdToEnd.getTime()) return false;
    }

    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    const key = sort;
    if (key === "created_desc" || key === "created_asc") {
      const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
      const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
      return key === "created_desc" ? tb - ta : ta - tb;
    }
    if (key === "end_asc" || key === "end_desc") {
      const ea = endTimeMs(a);
      const eb = endTimeMs(b);
      const aN = ea ?? (key === "end_asc" ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY);
      const bN = eb ?? (key === "end_asc" ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY);
      return key === "end_asc" ? aN - bN : bN - aN;
    }
    if (key === "price_asc") {
      const pa = effectiveListingPriceCents(a) ?? Number.MAX_SAFE_INTEGER;
      const pb = effectiveListingPriceCents(b) ?? Number.MAX_SAFE_INTEGER;
      return pa - pb;
    }
    if (key === "price_desc") {
      const pa = effectiveListingPriceCents(a) ?? -1;
      const pb = effectiveListingPriceCents(b) ?? -1;
      return pb - pa;
    }
    if (key === "bids_asc" || key === "bids_desc") {
      const ba =
        bidCountByListingId.get(listingIdKey(a.id as string | number)) ?? 0;
      const bb =
        bidCountByListingId.get(listingIdKey(b.id as string | number)) ?? 0;
      return key === "bids_asc" ? ba - bb : bb - ba;
    }
    return 0;
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
              {sorted.length} of {listings.length} listings
            </Badge>
          </CardHeader>
        </Card>

        {/* Filters */}
        <Card className="border-border bg-card/80 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <CardContent className="space-y-3 p-3">
            <form action="/admin/listings" method="GET" className="space-y-3">
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                <div className="sm:col-span-2 lg:col-span-2">
                  <label className="mb-1 block text-[11px] font-medium text-muted-foreground dark:text-gray-400">
                    Search
                  </label>
                  <Input
                    type="search"
                    name="q"
                    defaultValue={sp.q ?? ""}
                    placeholder="ID, title or suburb"
                    className="h-9 text-sm dark:bg-gray-800 dark:border-gray-700"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-muted-foreground dark:text-gray-400">
                    Status
                  </label>
                  <select
                    name="status"
                    defaultValue={sp.status ?? "all"}
                    className="h-9 w-full rounded-md border border-border bg-background px-2 text-xs dark:border-gray-700 dark:bg-gray-900"
                  >
                    <option value="all">All statuses</option>
                    <option value="live">Live</option>
                    <option value="ended">Ended</option>
                    <option value="cancelled">Cancelled</option>
                    <option value="draft">Draft</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-muted-foreground dark:text-gray-400">
                    Sort
                  </label>
                  <select
                    name="sort"
                    defaultValue={sort}
                    className="h-9 w-full rounded-md border border-border bg-background px-2 text-xs dark:border-gray-700 dark:bg-gray-900"
                  >
                    {SORT_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-muted-foreground dark:text-gray-400">
                    Price min ($)
                  </label>
                  <Input
                    type="number"
                    name="price_min"
                    min={0}
                    step={1}
                    placeholder="Any"
                    defaultValue={sp.price_min ?? ""}
                    className="h-9 text-sm dark:bg-gray-800 dark:border-gray-700"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-muted-foreground dark:text-gray-400">
                    Price max ($)
                  </label>
                  <Input
                    type="number"
                    name="price_max"
                    min={0}
                    step={1}
                    placeholder="Any"
                    defaultValue={sp.price_max ?? ""}
                    className="h-9 text-sm dark:bg-gray-800 dark:border-gray-700"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-muted-foreground dark:text-gray-400">
                    Bids
                  </label>
                  <select
                    name="bids"
                    defaultValue={bidsFilterNorm}
                    className="h-9 w-full rounded-md border border-border bg-background px-2 text-xs dark:border-gray-700 dark:bg-gray-900"
                  >
                    <option value="all">Any</option>
                    <option value="has">Has bids (1+)</option>
                    <option value="none">No bids</option>
                  </select>
                </div>
                <div className="flex flex-wrap items-end gap-2">
                  <Button type="submit" size="sm" className="h-9">
                    Apply filters
                  </Button>
                  <Button type="button" variant="outline" size="sm" className="h-9" asChild>
                    <Link href="/admin/listings">Clear</Link>
                  </Button>
                </div>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-muted-foreground dark:text-gray-400">
                    Created from
                  </label>
                  <Input
                    type="date"
                    name="created_from"
                    defaultValue={createdFromRaw}
                    className="h-9 text-sm dark:bg-gray-800 dark:border-gray-700"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-muted-foreground dark:text-gray-400">
                    Created to
                  </label>
                  <Input
                    type="date"
                    name="created_to"
                    defaultValue={createdToRaw}
                    className="h-9 text-sm dark:bg-gray-800 dark:border-gray-700"
                  />
                </div>
              </div>
            </form>
            <p className="text-xs text-muted-foreground dark:text-gray-400">
              Showing{" "}
              <span className="font-semibold">
                {sorted.length} of {listings.length}
              </span>{" "}
              listings (unassigned to a job).
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
            {sorted.length === 0 ? (
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
                    <TableHead className="whitespace-nowrap text-xs sm:text-sm">Time ending</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="hidden sm:table-cell text-right">Bids</TableHead>
                    <TableHead className="hidden lg:table-cell">Created</TableHead>
                    <TableHead className="w-40">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sorted.map((listing) => {
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
                          <div className="space-y-0.5">
                            <Link
                              href={`/listings/${listing.id}`}
                              className="font-medium text-primary underline-offset-4 hover:underline"
                            >
                              {listing.title ?? "Untitled listing"}
                            </Link>
                            <p className="text-[11px] text-muted-foreground dark:text-gray-400 md:hidden">
                              Lister · {lister?.full_name ?? "—"}
                            </p>
                          </div>
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
                        <TableCell className="whitespace-nowrap text-[11px] text-muted-foreground dark:text-gray-400 sm:text-xs">
                          {listing.end_time
                            ? format(new Date(listing.end_time), "dd MMM yyyy, HH:mm")
                            : "—"}
                        </TableCell>
                        <TableCell>
                          <Badge
                            className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${statusClass}`}
                          >
                            {status.replace(/_/g, " ")}
                          </Badge>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell text-right text-xs tabular-nums text-muted-foreground dark:text-gray-400">
                          {bidCountByListingId.get(listingIdKey(listing.id as string | number)) ?? 0}
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
