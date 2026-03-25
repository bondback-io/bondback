"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();

  useEffect(() => {
     
    console.error("Global app error:", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <Card className="w-full max-w-md border-red-200 bg-red-50/60 dark:border-red-900/60 dark:bg-red-950/40">
        <CardHeader className="flex flex-row items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-300" />
          <CardTitle className="text-base font-semibold dark:text-red-50">
            Something went wrong
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p className="text-red-900 dark:text-red-100">
            An unexpected error occurred while loading this page. You can try again, or go
            back to your dashboard.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => reset()}
            >
              Try again
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => router.push("/dashboard")}
            >
              Back to dashboard
            </Button>
          </div>
          {error.digest && (
            <p className="mt-1 text-[11px] text-red-800/80 dark:text-red-200/80">
              Error code: <code>{error.digest}</code>
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

