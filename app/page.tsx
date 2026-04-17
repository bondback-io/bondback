import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  HandCoins,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { AdminOnlyToast } from "@/components/admin/admin-only-toast";
import { cn } from "@/lib/utils";
import { buildHomePageMetadata } from "@/lib/seo/home-metadata";
import { buildHomePageJsonLd } from "@/lib/seo/home-json-ld";
import { getSiteUrl } from "@/lib/site";

export const metadata = buildHomePageMetadata();

const STEPS = [
  {
    title: "Post or discover",
    body: "Renters list a bond clean; cleaners browse live jobs across Australia.",
    icon: ClipboardList,
  },
  {
    title: "Compare bids",
    body: "Reverse-auction pricing — watch bids drop so you know you’re getting a fair deal.",
    icon: HandCoins,
  },
  {
    title: "Book with confidence",
    body: "Choose your cleaner, coordinate in-app, and track the job to completion.",
    icon: CheckCircle2,
  },
  {
    title: "Pay securely",
    body: "Stripe-backed payments with verified cleaners — built for peace of mind.",
    icon: ShieldCheck,
  },
] as const;

type HomePageProps = { searchParams?: Promise<{ error?: string }> };

const HomePage = async ({ searchParams }: HomePageProps) => {
  const params = searchParams ? await searchParams : {};
  const showAdminOnlyToast = params.error === "admin_only";
  const supabase = await createServerSupabaseClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const isLoggedIn = !!session;

  const site = getSiteUrl();
  const homeJsonLd = buildHomePageJsonLd(site.origin);

  return (
    <main className="min-h-[85vh] bg-background pb-20 pt-6 dark:bg-gray-950 sm:pb-24 sm:pt-10 md:pt-14">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(homeJsonLd) }}
      />
      {showAdminOnlyToast && <AdminOnlyToast />}

      <div className="container max-w-5xl px-4 sm:px-6">
        {/* Hero */}
        <section
          className={cn(
            "relative overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-b from-emerald-50/80 via-background to-background px-5 py-10 shadow-sm sm:rounded-3xl sm:px-10 sm:py-14 md:px-14 md:py-16",
            "dark:border-gray-700/90 dark:bg-gradient-to-b dark:from-emerald-950/50 dark:via-gray-900/80 dark:to-gray-950 dark:shadow-[0_0_0_1px_rgba(16,185,129,0.12)]"
          )}
        >
          <div className="mx-auto max-w-2xl text-center">
            <p className="mb-3 inline-flex items-center gap-2 rounded-full border border-emerald-200/80 bg-emerald-50/90 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-900 dark:border-emerald-500/35 dark:bg-emerald-950/90 dark:text-emerald-100">
              <Sparkles className="h-3.5 w-3.5 shrink-0 text-emerald-700 dark:text-emerald-300" aria-hidden />
              Sunshine Coast · QLD · Australia
            </p>
            <h1 className="text-balance text-3xl font-bold leading-[1.15] tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-4xl md:text-5xl">
              Bond cleaning Sunshine Coast &amp; Australia — bids you can trust
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-pretty text-base leading-relaxed text-zinc-600 dark:text-zinc-300 sm:text-lg">
              End of lease cleaning and bond cleans from Maroochydore to Gympie and nationwide — simple
              pricing, verified cleaners, and secure payments. Built for renters and cleaners.
            </p>

            {/* Primary CTAs — large tap targets, vertical on narrow screens */}
            <div className="mt-10 flex w-full flex-col gap-3 sm:mx-auto sm:max-w-lg sm:flex-row sm:items-stretch sm:justify-center sm:gap-4">
              <Button
                asChild
                size="lg"
                className="h-14 min-h-[52px] w-full rounded-xl text-base font-semibold shadow-sm sm:h-12 sm:min-h-[48px] sm:flex-1 sm:max-w-xs dark:shadow-emerald-900/40"
              >
                <Link href="/listings/new">
                  Post a Bond Clean
                  <ArrowRight className="ml-2 h-5 w-5 shrink-0 opacity-90" aria-hidden />
                </Link>
              </Button>
              <Button
                asChild
                variant="outline"
                size="lg"
                className={cn(
                  "h-14 min-h-[52px] w-full rounded-xl border-2 text-base font-semibold bg-background/80 backdrop-blur-sm sm:h-12 sm:min-h-[48px] sm:flex-1 sm:max-w-xs",
                  "dark:border-emerald-500/45 dark:bg-gray-900/70 dark:text-gray-50 dark:hover:border-emerald-400/55 dark:hover:bg-emerald-950/40"
                )}
              >
                <Link href="/find-jobs">
                  Find Cleaning Jobs
                  <ArrowRight className="ml-2 h-5 w-5 shrink-0 opacity-90" aria-hidden />
                </Link>
              </Button>
            </div>

            {/* Auth shortcuts */}
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
              {isLoggedIn ? (
                <p className="text-sm text-zinc-600 dark:text-zinc-300">
                  You&apos;re signed in — ready when you are.
                </p>
              ) : (
                <>
                  <Button
                    asChild
                    variant="ghost"
                    className="h-12 min-h-[48px] w-full max-w-xs rounded-xl text-base font-medium text-foreground sm:w-auto sm:max-w-none dark:text-gray-100 dark:hover:bg-white/10 dark:hover:text-white"
                  >
                    <Link href="/login">Log in</Link>
                  </Button>
                  <Button
                    asChild
                    variant="secondary"
                    className="h-12 min-h-[48px] w-full max-w-xs rounded-xl text-base font-semibold sm:w-auto sm:max-w-none dark:border dark:border-gray-600 dark:bg-gray-800 dark:text-gray-50 dark:hover:bg-gray-700"
                  >
                    <Link href="/signup">Sign up</Link>
                  </Button>
                </>
              )}
            </div>

            <p className="mt-10 text-center text-xs leading-relaxed text-zinc-500 dark:text-zinc-400 sm:text-sm">
              Secure payments · Verified cleaners · Australia-wide
            </p>
          </div>
        </section>

        {/* How it works */}
        <section className="mt-16 sm:mt-20 md:mt-24" aria-labelledby="how-it-works-heading">
          <div className="mx-auto max-w-2xl text-center">
            <h2
              id="how-it-works-heading"
              className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-3xl"
            >
              How Bond Back works
            </h2>
            <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-300 sm:text-base">
              Four steps from listing to payout — no noise, no jargon.
            </p>
          </div>

          <ol className="mt-10 grid gap-6 sm:grid-cols-2 sm:gap-8 lg:grid-cols-4 lg:gap-6">
            {STEPS.map((step, i) => {
              const Icon = step.icon;
              return (
                <li key={step.title}>
                  <div
                    className={cn(
                      "flex h-full flex-col rounded-2xl border border-border/70 bg-card/50 p-4 sm:p-5",
                      "dark:border-gray-700/70 dark:bg-gray-900/70 dark:shadow-sm dark:shadow-black/20"
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <span
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary dark:bg-emerald-950/70 dark:text-emerald-300"
                        aria-hidden
                      >
                        <Icon className="h-5 w-5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-emerald-400/90">
                          Step {i + 1}
                        </span>
                        <h3 className="mt-1 text-base font-semibold text-zinc-900 dark:text-zinc-50">
                          {step.title}
                        </h3>
                      </div>
                    </div>
                    <p className="mt-3 text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">
                      {step.body}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
        </section>

        {/* Bottom trust strip — subtle, not busy */}
        <section
          className="mt-16 rounded-2xl border border-dashed border-border/80 bg-muted/30 px-5 py-6 text-center sm:mt-20 md:mt-24 dark:border-gray-600/60 dark:bg-gray-900/55"
          aria-label="Trust and coverage"
        >
          <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
            Built for Australian bond cleans
          </p>
          <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-300 sm:text-sm">
            Secure payments · Verified cleaners · Australia-wide
          </p>
          <nav
            className="mt-4 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs text-zinc-600 dark:text-zinc-400"
            aria-label="Legal"
          >
            <Link
              href="/privacy"
              className="font-medium text-zinc-800 underline-offset-4 hover:text-primary hover:underline dark:text-zinc-200"
            >
              Privacy Policy
            </Link>
            <span className="text-zinc-400 dark:text-zinc-500" aria-hidden>
              ·
            </span>
            <Link
              href="/terms"
              className="font-medium text-zinc-800 underline-offset-4 hover:text-primary hover:underline dark:text-zinc-200"
            >
              Terms of Service
            </Link>
          </nav>
        </section>
      </div>
    </main>
  );
};

export default HomePage;
