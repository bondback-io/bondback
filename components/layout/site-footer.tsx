import Link from "next/link";

export const SiteFooter = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t bg-background dark:border-gray-800 dark:bg-gray-950">
      <div className="container flex flex-col gap-4 py-6 text-sm text-muted-foreground dark:text-gray-400 sm:flex-row sm:items-center sm:justify-between">
        <p>
          © {currentYear} Bond Back. Built for Aussie bond cleans and end of
          lease.
        </p>
        <div className="flex flex-col gap-2 sm:items-end">
          <nav
            className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs sm:text-sm"
            aria-label="Legal"
          >
            <Link
              href="/privacy"
              className="font-medium text-foreground underline-offset-4 hover:text-primary hover:underline dark:text-gray-200"
            >
              Privacy Policy
            </Link>
            <span className="text-muted-foreground/80" aria-hidden>
              ·
            </span>
            <Link
              href="/terms"
              className="font-medium text-foreground underline-offset-4 hover:text-primary hover:underline dark:text-gray-200"
            >
              Terms of Service
            </Link>
          </nav>
          <p className="text-xs">
            Prices in AUD. ABN details collected for professional cleaners.
          </p>
        </div>
      </div>
    </footer>
  );
};

