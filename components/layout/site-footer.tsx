import Link from "next/link";

export const SiteFooter = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t bg-background dark:border-gray-800 dark:bg-gray-950">
      <div className="container mx-auto max-w-6xl px-4 py-5 text-muted-foreground sm:py-6 dark:text-gray-400">
        <div className="flex flex-col items-center gap-5 text-center sm:flex-row sm:items-start sm:justify-between sm:gap-6 sm:text-left">
          <div className="max-w-sm space-y-1 text-xs leading-snug sm:max-w-none sm:text-sm sm:leading-normal">
            <p className="font-medium text-foreground dark:text-gray-200">
              © {currentYear} Bond Back
            </p>
            <p>Built for Aussie bond cleans and end of lease.</p>
          </div>

          <div className="flex w-full max-w-sm flex-col items-center gap-3 sm:max-w-none sm:items-end sm:gap-2">
            <nav
              className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs sm:justify-end sm:text-sm"
              aria-label="Legal"
            >
              <Link
                href="/privacy"
                className="whitespace-nowrap font-medium text-foreground underline-offset-4 hover:text-primary hover:underline dark:text-gray-200"
              >
                <span className="sm:hidden">Privacy</span>
                <span className="hidden sm:inline">Privacy Policy</span>
              </Link>
              <span className="hidden text-muted-foreground/80 sm:inline" aria-hidden>
                ·
              </span>
              <Link
                href="/terms"
                className="whitespace-nowrap font-medium text-foreground underline-offset-4 hover:text-primary hover:underline dark:text-gray-200"
              >
                <span className="sm:hidden">Terms</span>
                <span className="hidden sm:inline">Terms of Service</span>
              </Link>
            </nav>
            <p className="text-[11px] leading-snug text-muted-foreground sm:text-xs">
              Prices in AUD. ABN details collected for professional cleaners.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
};
