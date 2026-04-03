import type { Metadata } from "next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/** Must be dynamic so the root layout reads auth cookies (logged-in header). */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Terms of Service",
  description:
    "Bond Back Terms of Service — rules for using the Australian bond cleaning and end of lease marketplace.",
  alternates: { canonical: "/terms" },
  openGraph: {
    title: "Terms of Service · Bond Back",
    description: "Terms for listing, bidding, payments, and disputes on Bond Back.",
    url: "/terms",
  },
};

export default function TermsPage() {
  return (
    <section className="page-inner space-y-6">
      <Card className="border-border bg-card/80 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <CardHeader>
          <CardTitle className="text-xl font-semibold tracking-tight dark:text-gray-100">
            Terms of Service
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground dark:text-gray-300">
          <p>
            These terms are a placeholder for your legal Terms of Service. Add your full
            agreement text here before going live.
          </p>
          <p>
            By using Bond Back, you agree to follow local laws and treat other users fairly.
            Disputes are handled via the in-app dispute flow and may be escalated to admin.
          </p>
        </CardContent>
      </Card>
    </section>
  );
}

