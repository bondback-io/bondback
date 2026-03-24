import type { Metadata } from "next";
import { getHelpArticles } from "@/lib/help-articles";
import { HelpPageClient } from "@/components/help/help-page-client";

export const metadata: Metadata = {
  title: "Help centre",
  description:
    "Guides and FAQs for bond cleaning, end of lease cleaning, bidding, payments, and disputes on Bond Back — Australia.",
  alternates: { canonical: "/help" },
  openGraph: {
    title: "Help centre · Bond Back",
    description:
      "Learn how Bond Back works for renters, listers, and cleaners — bond back cleaning made clearer.",
    url: "/help",
  },
};

export default async function HelpPage() {
  const initialArticles = await getHelpArticles();

  return <HelpPageClient initialArticles={initialArticles} />;
}
