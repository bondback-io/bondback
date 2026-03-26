"use client";

import { useEffect } from "react";
import "./globals.css";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Replaces the root layout when the root layout itself throws.
 * Must include html/body (Next.js requirement).
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[GlobalError]", error);
  }, [error]);

  return (
    <html lang="en">
      <body className="min-h-screen bg-background font-sans text-foreground antialiased">
        <div className="flex min-h-[60vh] items-center justify-center px-4 py-12">
          <div className="w-full max-w-md rounded-xl border border-red-200 bg-red-50/60 p-6 dark:border-red-900/60 dark:bg-red-950/40">
            <div className="flex flex-row items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-300" aria-hidden />
              <h1 className="text-base font-semibold text-red-900 dark:text-red-50">
                Something went wrong
              </h1>
            </div>
            <p className="mt-3 text-sm text-red-900 dark:text-red-100">
              The app couldn&apos;t load this page. Try again, or open the site from the home link.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button type="button" size="sm" onClick={() => reset()}>
                Try again
              </Button>
              <Button type="button" size="sm" variant="outline" asChild>
                <a href="/">Home</a>
              </Button>
            </div>
            {error.digest ? (
              <p className="mt-3 text-[11px] text-red-800/80 dark:text-red-200/80">
                Error code: <code>{error.digest}</code>
              </p>
            ) : null}
          </div>
        </div>
      </body>
    </html>
  );
}
