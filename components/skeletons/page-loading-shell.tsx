import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type PageLoadingShellProps = {
  children: ReactNode;
  className?: string;
};

/**
 * Consistent route-level loading wrapper: `page-inner`, spacing, a11y.
 * Use inside `loading.tsx` files only — does not replace spinners/modals in live UI.
 */
export function PageLoadingShell({ children, className }: PageLoadingShellProps) {
  return (
    <section
      className={cn("page-inner space-y-6 pb-16 sm:space-y-5 sm:pb-8", className)}
      role="status"
      aria-busy="true"
      aria-label="Loading page"
    >
      {children}
    </section>
  );
}
