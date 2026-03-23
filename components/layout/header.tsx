import Link from "next/link";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { getSessionWithProfile } from "@/lib/supabase/session";
import { UserMenu } from "@/components/layout/user-menu";
import { RoleSwitcher } from "@/components/layout/RoleSwitcher";
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
  const hasCleanerRole = roles.includes("cleaner");
  const isCleaner = hasCleanerRole && activeRole === "cleaner";
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
          {/* Mobile: logo (left) · theme + role pill + avatar (right) */}
          <div className="flex min-h-[3.25rem] w-full items-center justify-between gap-2 px-3 py-2 md:hidden">
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <LogoMark />
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <ThemeToggle persistToServer={!!session} />
              <RoleSwitcher session={session} variant="compact" />
              <UserMenu session={session} />
            </div>
          </div>

          {/* Desktop — single row; inner nav uses flex-nowrap so Create Listing stays aligned with Find Jobs / Dashboard */}
          <div className="container hidden min-h-[3.25rem] min-w-0 max-w-7xl flex-nowrap items-center justify-between gap-x-2 gap-y-0 px-3 py-2 sm:min-h-14 sm:gap-x-3 sm:px-4 md:flex md:px-6">
            <div className="flex min-h-[2.75rem] min-w-0 flex-1 flex-nowrap items-center gap-2 overflow-x-auto overflow-y-visible [scrollbar-width:none] sm:min-h-0 sm:gap-3 lg:gap-4 [&::-webkit-scrollbar]:hidden">
              <LogoMark />
              <span className="hidden shrink-0 truncate text-xs text-muted-foreground xl:inline xl:max-w-[11rem] xl:text-[13px]">
                Bond clean marketplace
              </span>
              <MainNav
                isLoggedIn={isLoggedIn}
                hasCleanerRole={hasCleanerRole}
                isCleaner={isCleaner}
                isLister={isLister}
                session={session ?? null}
              />
            </div>

            <nav
              className="flex min-w-0 shrink-0 flex-nowrap items-center justify-end gap-x-1 sm:gap-x-1.5 lg:gap-x-2"
              aria-label="Account and tools"
            >
              <div className="flex min-w-0 flex-nowrap items-center justify-end gap-x-1 sm:gap-x-1.5 lg:gap-x-2">
                <NotificationBell userId={session.user.id} />
                <PendingBidsBadge isCleaner={isCleaner} />
                {floatingChatEnabled && <ChatPanelToggle />}
                <RoleSwitcher session={session} />
                {stripeTestMode && (
                  <span
                    className="rounded bg-amber-500/90 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-950 dark:bg-amber-400/90 dark:text-amber-950"
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
              <ThemeToggle persistToServer={!!session} />
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
              hasCleanerRole={false}
              isCleaner={false}
              isLister={false}
              session={null}
            />
          </div>

          <nav
            className="flex shrink-0 items-center justify-end gap-1 sm:gap-2"
            aria-label="Account and tools"
          >
            <div className="flex items-center gap-1.5 sm:gap-2">
              <Button
                variant="ghost"
                size="sm"
                asChild
                className="min-h-9 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60 dark:hover:bg-gray-800 dark:hover:text-gray-100"
              >
                <Link href="/login">Log in</Link>
              </Button>
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
