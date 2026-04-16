import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/types/supabase";
import { profileFieldIsAdmin } from "@/lib/is-admin";
import { AdminShell } from "@/components/admin/admin-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AdminReviewsClient,
  type AdminReviewProfileMini,
  type AdminReviewTableRow,
} from "@/components/admin/admin-reviews-client";
import {
  ADMIN_REVIEWS_PAGE_SIZE,
  applyAdminReviewsFilters,
  parseAdminReviewsPage,
  type AdminReviewsSearchParams,
} from "@/lib/admin/admin-reviews-filters";
import { computeReviewStats } from "@/lib/admin/admin-reviews-stats";

export const dynamic = "force-dynamic";

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

function buildListPath(sp: AdminReviewsSearchParams, pageNum: number): string {
  const p = new URLSearchParams();
  const q = (sp.q ?? "").trim();
  if (q) p.set("q", q);
  const rating = (sp.rating ?? "all").trim();
  if (rating && rating !== "all") p.set("rating", rating);
  const reviewee = (sp.reviewee ?? "all").trim();
  if (reviewee && reviewee !== "all") p.set("reviewee", reviewee);
  const status = (sp.status ?? "all").trim();
  if (status && status !== "all") p.set("status", status);
  const from = (sp.from ?? "").trim();
  if (from) p.set("from", from);
  const to = (sp.to ?? "").trim();
  if (to) p.set("to", to);
  if (pageNum > 1) p.set("page", String(pageNum));
  const qs = p.toString();
  return qs ? `/admin/reviews?${qs}` : "/admin/reviews";
}

export default async function AdminReviewsPage({
  searchParams,
}: {
  searchParams?: Promise<AdminReviewsSearchParams>;
}) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) redirect("/");

  const { data: profileData } = await supabase
    .from("profiles")
    .select("id, is_admin")
    .eq("id", session.user.id)
    .maybeSingle();
  const profile = profileData as Pick<ProfileRow, "id" | "is_admin"> | null;
  if (!profile || !profileFieldIsAdmin(profile.is_admin)) {
    redirect("/dashboard");
  }

  const sp = (await searchParams) ?? {};
  const page = parseAdminReviewsPage(sp);
  const admin = createSupabaseAdminClient();
  const readOnly = !admin;

  let reviews: AdminReviewTableRow[] = [];
  let totalFiltered = 0;
  let profilesById: Record<string, AdminReviewProfileMini> = {};
  let stats = computeReviewStats([]);

  if (admin) {
    const selectCols =
      "id, job_id, reviewer_id, reviewee_id, reviewee_type, reviewee_role, overall_rating, quality_of_work, reliability, communication, punctuality, review_text, review_photos, created_at, is_approved, is_hidden, is_flagged, moderation_note, moderated_at";

    let countQ = admin.from("reviews").select("id", { count: "exact", head: true });
    countQ = applyAdminReviewsFilters(countQ, sp);
    const { count } = await countQ;
    totalFiltered = typeof count === "number" ? count : 0;

    const from = (page - 1) * ADMIN_REVIEWS_PAGE_SIZE;
    const to = from + ADMIN_REVIEWS_PAGE_SIZE - 1;
    let dataQ = admin.from("reviews").select(selectCols);
    dataQ = applyAdminReviewsFilters(dataQ, sp);
    const { data: rows, error } = await dataQ
      .order("created_at", { ascending: false })
      .range(from, to);
    if (!error && rows) {
      reviews = rows as unknown as AdminReviewTableRow[];
    }

    const { data: statRows } = await admin.from("reviews").select("overall_rating").limit(25_000);
    stats = computeReviewStats((statRows ?? []) as { overall_rating: number | null }[]);

    const ids = new Set<string>();
    for (const r of reviews) {
      ids.add(r.reviewer_id);
      ids.add(r.reviewee_id);
    }
    if (ids.size > 0) {
      const { data: profs } = await admin
        .from("profiles")
        .select("id, full_name, cleaner_username")
        .in("id", [...ids]);
      for (const p of profs ?? []) {
        const row = p as AdminReviewProfileMini;
        profilesById[row.id] = row;
      }
    }
  }

  const totalPages = Math.max(1, Math.ceil(totalFiltered / ADMIN_REVIEWS_PAGE_SIZE));
  const prevUrl = page > 1 ? buildListPath(sp, page - 1) : null;
  const nextUrl = page < totalPages ? buildListPath(sp, page + 1) : null;

  return (
    <AdminShell activeHref="/admin/reviews">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl dark:text-gray-100">
            Reviews &amp; ratings
          </h1>
          <p className="text-sm text-muted-foreground dark:text-gray-400">
            Moderate job-linked reviews, tied to completed work and released payments on the public site.
          </p>
        </div>

        <Card className="border-border dark:border-gray-800 dark:bg-gray-900">
          <CardHeader className="pb-3">
            <CardTitle className="text-base dark:text-gray-100">Filters</CardTitle>
          </CardHeader>
          <CardContent>
            <form action="/admin/reviews" method="get" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
              <div className="space-y-1 sm:col-span-2">
                <Label htmlFor="q" className="text-xs dark:text-gray-300">
                  Search
                </Label>
                <Input
                  id="q"
                  name="q"
                  placeholder="Job ID or comment text…"
                  defaultValue={sp.q ?? ""}
                  className="dark:border-gray-700 dark:bg-gray-950"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="rating" className="text-xs dark:text-gray-300">
                  Rating
                </Label>
                <select
                  id="rating"
                  name="rating"
                  defaultValue={sp.rating ?? "all"}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                >
                  <option value="all">All stars</option>
                  <option value="5">5★</option>
                  <option value="4">4★</option>
                  <option value="3">3★</option>
                  <option value="2">2★</option>
                  <option value="1">1★</option>
                </select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="reviewee" className="text-xs dark:text-gray-300">
                  Reviewee
                </Label>
                <select
                  id="reviewee"
                  name="reviewee"
                  defaultValue={sp.reviewee ?? "all"}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                >
                  <option value="all">All</option>
                  <option value="cleaner">Cleaner</option>
                  <option value="lister">Lister</option>
                </select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="status" className="text-xs dark:text-gray-300">
                  Status
                </Label>
                <select
                  id="status"
                  name="status"
                  defaultValue={sp.status ?? "all"}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                >
                  <option value="all">All</option>
                  <option value="approved">Approved (visible)</option>
                  <option value="pending">Pending approval</option>
                  <option value="hidden">Hidden</option>
                  <option value="flagged">Flagged</option>
                </select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="from" className="text-xs dark:text-gray-300">
                  From
                </Label>
                <Input
                  id="from"
                  name="from"
                  type="date"
                  defaultValue={sp.from ?? ""}
                  className="dark:border-gray-700 dark:bg-gray-950"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="to" className="text-xs dark:text-gray-300">
                  To
                </Label>
                <Input
                  id="to"
                  name="to"
                  type="date"
                  defaultValue={sp.to ?? ""}
                  className="dark:border-gray-700 dark:bg-gray-950"
                />
              </div>
              <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-3 xl:col-span-6">
                <Button type="submit" size="sm">
                  Apply filters
                </Button>
                <Button type="button" variant="outline" size="sm" asChild>
                  <a href="/admin/reviews">Reset</a>
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <AdminReviewsClient
          reviews={reviews}
          profilesById={profilesById}
          stats={{
            total: stats.total,
            average: stats.average,
            distribution: stats.distribution,
          }}
          totalFiltered={totalFiltered}
          page={page}
          pageSize={ADMIN_REVIEWS_PAGE_SIZE}
          readOnly={readOnly}
          prevUrl={prevUrl}
          nextUrl={nextUrl}
        />
      </div>
    </AdminShell>
  );
}
