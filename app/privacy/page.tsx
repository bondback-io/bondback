import type { Metadata } from "next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/** Must be dynamic so the root layout reads auth cookies (logged-in header). */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "Bond Back Privacy Policy — how we handle account, job, and payment data for bond cleaning in Australia.",
  alternates: { canonical: "/privacy" },
  openGraph: {
    title: "Privacy Policy · Bond Back",
    description: "How Bond Back collects, uses, and protects your personal information.",
    url: "/privacy",
  },
};

export default function PrivacyPage() {
  return (
    <section className="page-inner space-y-6">
      <Card className="border-border bg-card/80 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <CardHeader>
          <CardTitle className="text-xl font-semibold tracking-tight dark:text-gray-100">
            Privacy Policy
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground dark:text-gray-300">
          <p>
            This is a placeholder privacy policy. Add your full policy text here before going
            live.
          </p>
          <p>
            Bond Back stores necessary account and job information to operate the
            marketplace. You can request a copy of your data or account deletion from the
            Settings page or by emailing support@bondback.io.
          </p>
        </CardContent>
      </Card>
    </section>
  );
}

