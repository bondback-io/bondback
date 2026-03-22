import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2, ShieldCheck, Star } from "lucide-react";

export const LandingHero = () => {
  return (
    <section className="page-inner py-10 sm:py-14 md:py-16">
      <div className="grid gap-10 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] md:items-center">
        <div className="space-y-7">
          <h1 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl md:text-5xl lg:text-6xl">
            Australia&apos;s smarter way
            <br />
            to get your{" "}
            <span className="underline decoration-accent decoration-4 underline-offset-4">
              bond back
            </span>
            .
          </h1>
          <p className="max-w-xl text-balance text-base text-muted-foreground sm:text-lg md:text-xl">
            Bond Back is a reverse-auction marketplace for end-of-lease cleans.
            Listers describe their place, verified cleaners bid down, and you
            lock in a fair price with confidence.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button size="lg" asChild className="rounded-full px-8 text-base font-semibold">
              <Link href="/jobs">Browse Jobs</Link>
            </Button>
            <Button
              size="lg"
              variant="outline"
              asChild
              className="rounded-full px-6 text-base"
            >
              <Link href="/signup?role=lister">Create Listing</Link>
            </Button>
            <Button
              size="lg"
              variant="ghost"
              asChild
              className="text-base text-muted-foreground hover:text-foreground"
            >
              <Link href="#how-it-works">How it works</Link>
            </Button>
          </div>
          <ul className="flex flex-wrap gap-4 text-sm text-muted-foreground">
            <li className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              Reverse-auction pricing for bond cleans.
            </li>
            <li className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-sky-500" />
              Secure payments &amp; dispute support planned.
            </li>
            <li className="flex items-center gap-2">
              <Star className="h-4 w-4 text-amber-500" />
              Ratings &amp; reviews to find reliable cleaners.
            </li>
          </ul>
        </div>
        <Card className="border-primary/10 bg-card/80 shadow-md transition-shadow hover:shadow-lg">
          <CardContent className="space-y-4 p-6">
            <p className="text-sm font-medium text-muted-foreground">
              Example listing · Brisbane 4000, QLD
            </p>
            <div className="space-y-1 text-sm">
              <p className="font-semibold">2 bed unit · end-of-lease clean</p>
              <p className="text-muted-foreground">
                Reserve: <span className="font-semibold">$450 AUD</span>
              </p>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between rounded-md bg-muted px-3 py-2">
                <span className="text-muted-foreground">Cleaner A</span>
                <span className="font-semibold">$420</span>
              </div>
              <div className="flex items-center justify-between rounded-md bg-muted px-3 py-2">
                <span className="text-muted-foreground">Cleaner B</span>
                <span className="font-semibold">$405</span>
              </div>
              <div className="flex items-center justify-between rounded-md bg-accent/10 px-3 py-2">
                <span className="text-muted-foreground">Cleaner C</span>
                <span className="font-semibold text-accent">$390</span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Lowest bid wins if it&apos;s at or below your reserve. Realtime bids and secure
              workflows are powered by Supabase and Stripe-ready architecture.
            </p>
          </CardContent>
        </Card>
      </div>
    </section>
  );
};

