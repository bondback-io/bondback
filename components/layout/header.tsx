import Link from "next/link";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { getSessionWithProfile } from "@/lib/supabase/session";
import { UserMenu } from "@/components/layout/user-menu";
import { RoleSwitcher } from "@/components/layout/RoleSwitcher";
import { NotificationBell } from "@/components/layout/notification-bell";
import { MainNav } from "@/components/layout/main-nav";
import { FindJobsNavLink } from "@/components/layout/find-jobs-nav-link";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { PendingBidsBadge } from "@/components/pwa/pending-bids-badge";
import { getInAppNotificationFeedbackPrefs } from "@/lib/notifications/in-app-notification-prefs";

export type HeaderProps = {
  className?: string;
  /** When true, show TEST MODE badge in the nav (Stripe test mode from Admin). */
  stripeTestMode?: boolean;
};

/** Bond Back wordmark home link. */
function LogoWithTagline({ className }: { className?: string }) {
  return (
    <Link
      href="/"
      className={cn(
        "inline-flex min-h-9 min-w-0 shrink-0 items-center justify-center rounded-lg transition-opacity hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:min-h-11 sm:rounded-xl",
        className
      )}
      aria-label="Bond Back home"
    >
      <span className="rounded-lg bg-primary px-2 py-1.5 text-xs font-semibold leading-tight text-primary-foreground shadow-sm ring-1 ring-black/5 dark:text-white dark:ring-white/10 sm:rounded-xl sm:px-2.5 sm:py-2 sm:text-sm">
        Bond<span className="font-normal text-primary-foreground/90 dark:text-white/90"> Back</span>
      </span>
    </Link>
  );
}

export const Header = async ({
  className,
  stripeTestMode = false,
}: HeaderProps) => {
  const session = await getSessionWithProfile();
  const isLoggedIn = !!session;
  const roles = session?.roles ?? [];
  const activeRole = session?.activeRole ?? null;
  const hasCleanerRole = roles.includes("cleaner");
  const isCleaner = hasCleanerRole && activeRole === "cleaner";
  const isLister = roles.includes("lister") && activeRole === "lister";

  const { inAppSoundEnabled, inAppVibrateEnabled } = session
    ? getInAppNotificationFeedbackPrefs(session.profile?.notification_preferences)
    : { inAppSoundEnabled: true, inAppVibrateEnabled: true };

  return (
    <header
      className={cn(
        /** Site chrome: keep above in-page sticky search/filter bars (z-20). */
        "sticky top-0 z-30 w-full border-b border-navHeaderBorder/95 bg-navHeaderSurface/95 backdrop-blur-md",
        "dark:border-gray-800 dark:bg-gray-950/95",
        "shadow-sm shadow-sky-900/10 dark:shadow-none",
        "min-h-[3.25rem] sm:min-h-14",
        "pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]",
        className
      )}
    >
      {session ? (
        /**
         * One toolbar row + a single account-tools cluster (bell, bids, role, avatar).
         * Previously we rendered the same tools twice (mobile row + desktop row); after
         * `router.refresh()` that could show both clusters at once (duplicate bells / role UI).
         */
        <div className="container mx-auto min-h-[3.25rem] min-w-0 max-w-7xl px-2 py-1.5 sm:min-h-14 sm:px-4 sm:py-2 md:px-6">
          <div className="flex w-full min-w-0 flex-nowrap items-center justify-between gap-1.5 sm:gap-2">
            <div className="flex min-h-[2.75rem] min-w-0 flex-1 flex-nowrap items-center gap-1.5 overflow-x-auto overflow-y-visible [scrollbar-width:none] sm:gap-2 md:gap-3 lg:gap-4 [&::-webkit-scrollbar]:hidden">
              {/**
               * Mobile (logged-in): hide logo to reduce clutter — Browse Jobs sits at the leading edge.
               * md+: logo → divider → Browse Jobs (flex `order` keeps DOM stable for a11y).
               */}
              <LogoWithTagline className="hidden shrink-0 md:order-1 md:flex" />
              <span
                className="hidden h-7 w-px shrink-0 self-center bg-border/90 dark:bg-gray-700 md:order-2 md:block"
                aria-hidden
              />
              <FindJobsNavLink
                id="tour-find-jobs-nav"
                className="relative z-20 order-1 min-w-0 md:order-3"
              />
              <MainNav className="order-2 min-w-0 md:order-4" isLoggedIn={isLoggedIn} isLister={isLister} />
            </div>

            <nav
              id="tour-account-tools-nav"
              className="flex min-w-0 shrink-0 flex-nowrap items-center justify-end gap-x-0.5 sm:gap-x-1.5 lg:gap-x-2"
              aria-label="Account and tools"
            >
              <NotificationBell
                key={`${session.user.id}-notification-bell`}
                userId={session.user.id}
                activeRole={session.activeRole}
                inAppSoundEnabled={inAppSoundEnabled}
                inAppVibrateEnabled={inAppVibrateEnabled}
              />
              <span className="hidden md:inline-flex">
                <PendingBidsBadge isCleaner={isCleaner} />
              </span>
              <span className="md:hidden">
                <RoleSwitcher key={`${session.user.id}-compact`} session={session} variant="compact" />
              </span>
              <span className="hidden md:inline-flex">
                <RoleSwitcher key={`${session.user.id}-full`} session={session} />
              </span>
              {stripeTestMode && (
                <span
                  className="shrink-0 rounded bg-amber-500/90 px-1 py-0.5 text-[8px] font-semibold uppercase leading-none tracking-tight text-amber-950 md:px-1.5 md:py-0.5 md:text-[10px] md:tracking-wide dark:bg-amber-400/90 dark:text-amber-950"
                  title="Stripe test mode is on. No real charges."
                >
                  <span className="md:hidden">Test</span>
                  <span className="hidden md:inline">Test mode</span>
                </span>
              )}
              <UserMenu key={`${session.user.id}-user-menu`} session={session} />
            </nav>
          </div>
        </div>
      ) : (
        <div className="container flex min-h-[2.875rem] min-w-0 max-w-7xl flex-nowrap items-center justify-between gap-1 px-2 py-1 sm:min-h-14 sm:gap-2 sm:px-4 sm:py-1.5 md:gap-3 md:px-6 md:py-2">
          <div className="flex min-w-0 flex-1 items-center gap-1 sm:gap-2 md:gap-5">
            <LogoWithTagline className="shrink-0" />
            <span
              className="hidden h-7 w-px shrink-0 bg-border/90 dark:bg-gray-700 sm:block"
              aria-hidden
            />
            {/**
             * Same visible label as logged-in mobile: icon + "Browse Jobs" (not icon-only).
             */}
            <FindJobsNavLink className="min-w-0 shrink" />
          </div>

          <nav
            className="flex min-w-0 shrink-0 items-center justify-end gap-0.5 sm:gap-1.5 md:gap-2"
            aria-label="Account and tools"
          >
            <div className="flex items-center gap-0.5 sm:gap-1.5">
              <Button
                variant="ghost"
                size="sm"
                asChild
                className="h-9 min-h-9 px-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60 sm:h-10 sm:min-h-10 sm:px-3 sm:text-sm dark:hover:bg-gray-800 dark:hover:text-gray-100"
              >
                <Link href="/login">Log in</Link>
              </Button>
              <Button
                asChild
                size="sm"
                className="h-9 min-h-9 shrink-0 rounded-full bg-primary px-2.5 text-xs font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 sm:h-10 sm:min-h-10 sm:px-4 sm:text-sm"
              >
                <Link href="/signup">Sign up</Link>
              </Button>
            </div>
            {/** Guest hamburger at far right (mobile); desktop sheet trigger stays hidden md+. */}
            <MainNav isLoggedIn={isLoggedIn} isLister={false} trailingGuestTools />
            <span
              className="mx-0.5 hidden h-5 w-px shrink-0 bg-border dark:bg-gray-700 md:mx-1 md:block"
              aria-hidden
            />
            <span className="hidden md:inline-flex">
              <ThemeToggle />
            </span>
          </nav>
        </div>
      )}
    </header>
  );
};
