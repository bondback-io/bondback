export const SiteFooter = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t bg-background dark:border-gray-800 dark:bg-gray-950">
      <div className="container flex flex-col gap-4 py-6 text-sm text-muted-foreground dark:text-gray-400 sm:flex-row sm:items-center sm:justify-between">
        <p>
          © {currentYear} Bond Back. Built for Aussie bond cleans and end of
          lease.
        </p>
        <p className="text-xs">
          Prices in AUD. ABN details collected for professional cleaners.
        </p>
      </div>
    </footer>
  );
};

