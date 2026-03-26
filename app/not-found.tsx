import Link from "next/link";
import type { Metadata } from "next";
import { FileQuestion } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Page not found",
  robots: { index: false, follow: false },
};

/**
 * Shown for unmatched routes and when server code calls `notFound()`.
 * Without this file, Next.js falls back to a generic 404 that can feel like a broken app.
 */
export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4 py-12">
      <Card className="w-full max-w-md border-border bg-card/80 dark:border-gray-800 dark:bg-gray-950/60">
        <CardHeader className="flex flex-row items-center gap-2">
          <FileQuestion className="h-5 w-5 text-muted-foreground" aria-hidden />
          <CardTitle className="text-base font-semibold">Page not found</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <p>
            We couldn&apos;t find that page. The link may be wrong, out of date, or the content may
            have moved.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" asChild>
              <Link href="/">Home</Link>
            </Button>
            <Button type="button" size="sm" variant="outline" asChild>
              <Link href="/jobs">Browse jobs</Link>
            </Button>
            <Button type="button" size="sm" variant="outline" asChild>
              <Link href="/help">Help</Link>
            </Button>
            <Button type="button" size="sm" variant="outline" asChild>
              <Link href="/dashboard">Dashboard</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
