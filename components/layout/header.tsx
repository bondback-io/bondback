import Link from "next/link";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { getSessionWithProfile } from "@/lib/supabase/session";
import { UserMenu } from "@/components/layout/user-menu";
import { RoleSwitcher } from "@/components/layout/RoleSwitcher";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { NotificationBell } from "@/components/layout/notification-bell";
import { ChatPanelToggle } from "@/components/layout/chat-panel-toggle";
import { MainNav } from "@/components/layout/main-nav";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { PendingBidsBadge } from "@/components/pwa/pending-bids-badge";

export type HeaderProps = {
  className?: string;
  /** When false, hide the chat icon in the nav. Default true when not passed. */
  floatingChatEnabled?: boolean;
  /** When true, show TEST MODE badge in the nav (Stripe test mode from Admin). */
  stripeTestMode?: boolean;
};

function LogoMark() {
  return (
    <Link
      href="/"
      className="flex min-h-11 min-w-11 shrink-0 items-center justify-start rounded-xl transition-opacity hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      aria-label="Bond Back home"
    >
      <span className="rounded-xl bg-primary px-2.5 py-2 text-sm font-semibold leading-tight text-primary-foreground shadow-sm ring-1 ring-black/5 dark:ring-white/10">
        Bond<span className="font-normal text-primary-foreground/90"> Back</span>
      </span>
    </Link>
  );
}

export const Header = async ({
  className,
  floatingChatEnabled = true,
  stripeTestMode = false,
}: HeaderProps) => {
  const session = await getSessionWithProfile();
  const isLoggedIn = !!session;
  const roles = session?.roles ?? [];
  const activeRole = session?.activeRole ?? null;
  const isCleaner = roles.includes("cleaner") && activeRole === "cleaner";
  const isLister = roles.includes("lister") && activeRole === "lister";

  return (
    <header
      className={cn(
        "sticky top-0 z-30 w-full border-b border-border/60 bg-background/95 backdrop-blur-md",
        "dark:border-gray-800 dark:bg-gray-950/95",
        "shadow-sm dark:shadow-none",
        "min-h-[3.25rem] sm:min-h-14",
        "pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]",
        className
      )}
    >
      {session ? (
        <>
          {/* Mobile: logo | role pill | avatar (thumb-friendly) */}
          <div className="flex min-h-[3.25rem] w-full items-center justify-between gap-2 px-3 py-2 md:hidden">
            <LogoMark />
            <div className="min-w-0 flex-1 px-1 flex justify-center">
              <RoleSwitcher session={session} variant="compact" />
            </div>
            <div className="flex shrink-0 items-center gap-0.5">
              <ThemeToggle />
              <UserMenu session={session} />
            </div>
          </div>

          {/* Desktop */}
          <div className="container hidden min-h-[3.25rem] min-w-0 max-w-7xl flex-nowrap items-center justify-between gap-2 px-3 py-2 sm:min-h-14 sm:gap-4 sm:px-4 md:flex md:px-6">
            <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-4 md:gap-8">
              <LogoMark />
              <span className="hidden truncate text-xs text-muted-foreground sm:inline lg:text-[13px]">
                Bond clean marketplace
              </span>
              <MainNav
                isLoggedIn={isLoggedIn}
                isCleaner={isCleaner}
                isLister={isLister}
                session={session ?? null}
              />
            </div>

            <nav
              className="flex shrink-0 items-center justify-end gap-1 sm:gap-2"
              aria-label="Account and tools"
            >
              <div className="flex items-center gap-1.5">
                <NotificationBell userId={session.user.id} />
                <PendingBidsBadge isCleaner={isCleaner} />
                {floatingChatEnabled && <ChatPanelToggle />}
                <RoleSwitcher session={session} />
                {stripeTestMode && (
                  <span
                    className="rounded bg-amber-500/90 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-900"
                    title="Stripe test mode is on. No real charges."
                  >
                    Test mode
                  </span>
                )}
                <UserMenu session={session} />
              </div>
              <span
                className="mx-0.5 hidden h-5 w-px shrink-0 bg-border dark:bg-gray-700 sm:block md:mx-1"
                aria-hidden
              />
              <ThemeToggle />
            </nav>
          </div>
        </>
      ) : (
        <div className="container flex min-h-[3.25rem] min-w-0 max-w-7xl flex-nowrap items-center justify-between gap-2 px-3 py-2 sm:min-h-14 sm:gap-4 sm:px-4 md:px-6">
          <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-4 md:gap-8">
            <Link
              href="/"
              className="flex shrink-0 items-center gap-2 transition-opacity hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-lg"
              aria-label="Bond Back home"
            >
              <span className="rounded-lg bg-primary px-2 py-1.5 text-sm font-semibold leading-tight text-primary-foreground shadow-sm ring-1 ring-black/5 dark:ring-white/10 sm:px-2.5">
                Bond<span className="font-normal text-primary-foreground/90"> Back</span>
              </span>
              <span className="hidden truncate text-xs text-muted-foreground sm:inline lg:text-[13px]">
                Bond clean marketplace
              </span>
            </Link>
            <MainNav
              isLoggedIn={isLoggedIn}
              isCleaner={isCleaner}
              isLister={isLister}
              session={session ?? null}
            />
          </div>

          <nav
            className="flex shrink-0 items-center justify-end gap-1 sm:gap-2"
            aria-label="Account and tools"
          >
            <div className="flex items-center gap-1.5 sm:gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="min-h-9 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60 dark:hover:bg-gray-800 dark:hover:text-gray-100"
                  >
                    Log in
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="w-48 rounded-xl border-border/80 py-1 shadow-lg dark:border-gray-800 dark:bg-gray-900"
                >
                  <DropdownMenuItem
                    asChild
                    className="cursor-pointer rounded-lg py-2.5 text-sky-700 focus:bg-sky-50 focus:text-sky-900 dark:text-sky-300 dark:focus:bg-sky-900/30 dark:focus:text-sky-100"
                  >
                    <Link href="/login?role=lister">Log in as Lister</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    asChild
                    className="cursor-pointer rounded-lg py-2.5 text-emerald-700 focus:bg-emerald-50 focus:text-emerald-900 dark:text-emerald-300 dark:focus:bg-emerald-900/30 dark:focus:text-emerald-100"
                  >
                    <Link href="/login?role=cleaner">Log in as Cleaner</Link>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button
                asChild
                size="sm"
                className="min-h-9 rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90"
              >
                <Link href="/signup">Sign up</Link>
              </Button>
            </div>
            <span
              className="mx-0.5 hidden h-5 w-px shrink-0 bg-border dark:bg-gray-700 sm:block md:mx-1"
              aria-hidden
            />
            <ThemeToggle />
          </nav>
        </div>
      )}
    </header>
  );
};
