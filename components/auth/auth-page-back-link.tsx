import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

type AuthPageBackLinkProps = {
  href?: string;
  children?: ReactNode;
};

/**
 * Breadcrumb-style link for auth screens so users can leave sign-in/sign-up without OAuth.
 */
export function AuthPageBackLink({
  href = "/",
  children = "Back to home",
}: AuthPageBackLinkProps) {
  return (
    <Link
      href={href}
      className="inline-flex max-w-full items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 dark:hover:text-gray-200"
    >
      <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden />
      <span className="truncate">{children}</span>
    </Link>
  );
}
