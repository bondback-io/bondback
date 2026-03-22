import Link from "next/link";

export const metadata = {
  title: "Offline · Bond Back",
  description: "You are offline. Check your connection and try again.",
};

/**
 * Offline fallback page. Cached by the service worker and shown when navigation fails (e.g. no network).
 * Keep minimal for fast load and cache efficiency.
 */
export default function OfflinePage() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-xl font-semibold text-foreground sm:text-2xl">
        Offline – check connection
      </h1>
      <p className="max-w-sm text-muted-foreground">
        You&apos;re not connected. Check your network and try again.
      </p>
      <Link
        href="/"
        className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
      >
        Try again
      </Link>
    </div>
  );
}
