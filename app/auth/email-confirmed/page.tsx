import { Suspense } from "react";
import type { Metadata } from "next";
import { Loader2 } from "lucide-react";
import { EmailConfirmedContent } from "./email-confirmed-content";

export const metadata: Metadata = {
  title: "Email confirmed",
  description: "Your Bond Back account email has been confirmed.",
};

function EmailConfirmedFallback() {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 px-4 py-16">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" aria-hidden />
      <p className="text-sm text-muted-foreground">Loading…</p>
    </div>
  );
}

export default function EmailConfirmedPage() {
  return (
    <Suspense fallback={<EmailConfirmedFallback />}>
      <EmailConfirmedContent />
    </Suspense>
  );
}
