import Link from "next/link";
import { Button } from "@/components/ui/button";
import { SignOutButton } from "@/components/layout/sign-out-button";

export const DashboardNav = ({ dashboardLabel = "Dashboard" }: { dashboardLabel?: string }) => {
  return (
    <nav className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground dark:border-gray-700 dark:bg-gray-800/60 dark:text-gray-300">
      <div className="flex flex-wrap items-center gap-1.5">
        <Button variant="ghost" size="sm" asChild className="px-2 py-1 text-xs hover:bg-muted/60 dark:hover:bg-gray-700 dark:hover:text-gray-100">
          <Link href="/">Home</Link>
        </Button>
        <span className="text-border dark:text-gray-500">/</span>
        <Button variant="ghost" size="sm" asChild className="px-2 py-1 text-xs hover:bg-muted/60 dark:hover:bg-gray-700 dark:hover:text-gray-100">
          <Link href="/dashboard">{dashboardLabel}</Link>
        </Button>
        <span className="text-border dark:text-gray-500">/</span>
        <Button variant="ghost" size="sm" asChild className="px-2 py-1 text-xs hover:bg-muted/60 dark:hover:bg-gray-700 dark:hover:text-gray-100">
          <Link href="/messages">Messages</Link>
        </Button>
        <span className="text-border dark:text-gray-500">/</span>
        <Button variant="ghost" size="sm" asChild className="px-2 py-1 text-xs hover:bg-muted/60 dark:hover:bg-gray-700 dark:hover:text-gray-100">
          <Link href="/my-listings">My Listings</Link>
        </Button>
        <span className="text-border dark:text-gray-500">/</span>
        <Button variant="ghost" size="sm" asChild className="px-2 py-1 text-xs hover:bg-muted/60 dark:hover:bg-gray-700 dark:hover:text-gray-100">
          <Link href="/profile">My Profile</Link>
        </Button>
      </div>
      <div className="flex items-center">
        <SignOutButton />
      </div>
    </nav>
  );
};

