import { notFound } from "next/navigation";
import { Star } from "lucide-react";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Database } from "@/types/supabase";

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

export default async function CleanerProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const admin = createSupabaseAdminClient();
  const client = admin ?? supabase;

  const { data: profile } = await client
    .from("profiles")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!profile) {
    notFound();
  }

  const cleanerAvg =
    (profile as any).cleaner_avg_rating != null
      ? Number((profile as any).cleaner_avg_rating)
      : null;
  const cleanerCount =
    (profile as any).cleaner_total_reviews != null
      ? Number((profile as any).cleaner_total_reviews)
      : 0;

  const { data: reviews } = await client
    .from("reviews")
    .select(
      `
      id,
      job_id,
      overall_rating,
      quality_of_work,
      reliability,
      communication,
      punctuality,
      cleanliness,
      review_text,
      review_photos,
      created_at,
      reviewer:reviewer_id(full_name, profile_photo_url)
    `
    )
    .eq("reviewee_id", id)
    .eq("reviewee_type", "cleaner")
    .order("created_at", { ascending: false });

  const reviewsSafe = (reviews ?? []) as any[];

  const avg = cleanerAvg ?? (() => {
    if (!reviewsSafe.length) return null;
    const total = reviewsSafe.reduce(
      (sum, r) => sum + (r.overall_rating as number),
      0
    );
    return total / reviewsSafe.length;
  })();

  const fullName = (profile as any).full_name as string | null;
  const suburb = (profile as any).suburb as string | null;
  const postcode = (profile as any).postcode as string | null;
  const years = (profile as any).years_experience as number | null;

  const starValue = avg ? Math.round(avg * 10) / 10 : null;

  const makePhotoUrl = (path: string) => {
    const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!base) return path;
    return `${base}/storage/v1/object/public/review-photos/${path}`;
  };

  return (
    <section className="page-inner space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
        {fullName ?? "Cleaner profile"}
      </h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Rating &amp; reputation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              {starValue != null ? (
                <>
                  <span className="text-3xl font-semibold">
                    {starValue.toFixed(1)}
                  </span>
                  <div className="flex items-center gap-0.5 text-amber-400">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star
                        key={s}
                        className={`h-5 w-5 ${
                          avg && s <= Math.round(avg)
                            ? "fill-amber-400"
                            : "text-muted-foreground"
                        }`}
                      />
                    ))}
                  </div>
                </>
              ) : (
                <span className="text-sm text-muted-foreground">
                  Not rated yet
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {cleanerCount} review{cleanerCount === 1 ? "" : "s"}
            </p>
          </div>

          {(suburb || profile.abn || years != null) && (
            <p className="text-xs text-muted-foreground">
              {suburb && <>Based in {suburb} {postcode ?? ""}</>}
              {suburb && (profile.abn || years != null) && " · "}
              {profile.abn && (
                <span className="font-medium text-emerald-600 dark:text-emerald-400">
                  ABN verified
                </span>
              )}
              {profile.abn && years != null && " · "}
              {years != null && `${years} years experience`}
            </p>
          )}
        </CardContent>
      </Card>

      {reviewsSafe.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Recent reviews</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {reviewsSafe.map((r) => (
              <div
                key={r.id}
                className="space-y-1 rounded-md border bg-background/70 px-3 py-2 text-xs"
              >
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="font-semibold">
                      {r.reviewer?.full_name ?? "Lister"}
                    </p>
                    <div className="flex items-center gap-1 text-amber-400">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Star
                          key={s}
                          className={`h-3 w-3 ${
                            s <= (r.overall_rating as number)
                              ? "fill-amber-400"
                              : "text-muted-foreground"
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    Job #{r.job_id}
                  </p>
                </div>
                {r.review_text && (
                  <p className="text-[11px] text-foreground">
                    {r.review_text as string}
                  </p>
                )}
                {Array.isArray(r.review_photos) &&
                  r.review_photos.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {r.review_photos.slice(0, 3).map((path: string, idx: number) => (
                        <div
                          key={`${path}-${idx}`}
                          className="h-14 w-16 overflow-hidden rounded-md border bg-muted/40"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={makePhotoUrl(path)}
                            alt="Review"
                            className="h-full w-full object-cover"
                          />
                        </div>
                      ))}
                    </div>
                  )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </section>
  );
}

