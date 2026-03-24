import type { Metadata } from "next";
import { LandingHero } from "@/components/features/landing-hero";
import { HowItWorks } from "@/components/features/how-it-works";
import { FindJobsSearch } from "@/components/features/find-jobs-search";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AdminOnlyToast } from "@/components/admin/admin-only-toast";

export const metadata: Metadata = {
  title: "Bond cleaning & end of lease cleaning marketplace",
  description:
    "Bond Back is Australia’s marketplace for bond cleaning and end of lease cleaning. Post a job, receive bids in a reverse auction, and get your bond back with clear pricing.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "Bond Back — Bond cleaning & end of lease cleaning (Australia)",
    description:
      "List bond cleans, compare cleaner bids, and pay securely — built for Australian renters and cleaners.",
    url: "/",
  },
};

type HomePageProps = { searchParams?: Promise<{ error?: string }> };

const HomePage = async ({ searchParams }: HomePageProps) => {
  const params = searchParams ? await searchParams : {};
  const showAdminOnlyToast = params.error === "admin_only";
  const supabase = await createServerSupabaseClient();

  const {
    data: { session },
  } = await supabase.auth.getSession();

  const isLoggedIn = !!session;

  return (
    <main className="space-y-10 pb-16">
      {showAdminOnlyToast && <AdminOnlyToast />}
      {/* 1. Hero */}
      <section>
        <LandingHero />
      </section>

      {/* 1.5 Search section */}
      <section className="container">
        <Card className="overflow-hidden border border-emerald-200/50 bg-gradient-to-br from-emerald-50/90 via-white to-sky-50/70 shadow-lg dark:border-gray-800 dark:from-gray-900 dark:via-gray-900 dark:to-gray-950">
          <CardHeader className="gap-1 pb-2">
            <CardTitle className="text-lg font-bold leading-snug md:text-2xl dark:text-gray-100">
              {isLoggedIn
                ? "Find bond cleans near you"
                : "Login to browse jobs"}
            </CardTitle>
            <CardDescription className="text-sm dark:text-gray-400">
              Suburb, distance, then search — like Airtasker.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 pt-0">
            <FindJobsSearch variant="home" defaultRadiusKm={20} />
            <p className="text-xs text-muted-foreground dark:text-gray-400">
              Or{" "}
              <a
                href="/listings/new"
                className="font-semibold text-primary underline-offset-4 hover:underline dark:text-blue-300 dark:hover:text-blue-200"
              >
                list your clean →
              </a>
            </p>
            <p className="text-[11px] text-muted-foreground sm:text-xs dark:text-gray-500">
              Secure payments • Verified cleaners • 48-hour protection
            </p>
          </CardContent>
        </Card>
      </section>

      {/* 1.5 Trust bar */}
      <section className="border-y bg-muted/40 dark:border-gray-800 dark:bg-gray-900/50">
        <div className="container flex flex-wrap items-center justify-between gap-4 py-4 text-xs text-muted-foreground sm:text-sm dark:text-gray-400">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300">
              $
            </span>
            <span className="font-medium text-foreground dark:text-gray-100">Secure payments (Stripe-ready)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-sky-50 text-sky-700 dark:bg-sky-900/50 dark:text-sky-300">
              ✓
            </span>
            <span className="font-medium text-foreground dark:text-gray-100">Verified cleaners with ABNs</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-amber-50 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300">
              ★
            </span>
            <span className="font-medium text-foreground dark:text-gray-100">Ratings &amp; reviews coming soon</span>
          </div>
        </div>
      </section>

      {/* 2. How Bond Back Works */}
      <section className="container">
        <HowItWorks />
      </section>

    </main>
  );
};

export default HomePage;

