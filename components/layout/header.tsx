import Link from "next/link";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { getSessionWithProfile } from "@/lib/supabase/session";
import { UserMenu } from "@/components/layout/user-menu";
import { RoleSwitcher } from "@/components/layout/RoleSwitcher";
import { NotificationBell } from "@/components/layout/notification-bell";
import { MainNav } from "@/components/layout/main-nav";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { PendingBidsBadge } from "@/components/pwa/pending-bids-badge";
import { ListerMobileCreateListingHeaderButton } from "@/components/layout/lister-mobile-create-header-button";
import { getInAppNotificationFeedbackPrefs } from "@/lib/notifications/in-app-notification-prefs";

export type HeaderProps = {
  className?: string;
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
        <div className="container mx-auto min-h-[3.25rem] min-w-0 max-w-7xl px-3 py-2 sm:min-h-14 sm:px-4 md:px-6">
          <div className="flex w-full flex-nowrap items-center justify-between gap-2">
            {/* Mobile: logo + quick create — shrink-0 so bell/role row never clips the brand */}
            <div className="flex min-w-0 shrink-0 items-center gap-2 md:hidden">
              <LogoMark />
              {isLister && <ListerMobileCreateListingHeaderButton />}
            </div>
            {/* Desktop (md+): logo, tagline, MainNav + menu trigger */}
            <div className="hidden min-h-[2.75rem] min-w-0 flex-1 flex-nowrap items-center gap-2 overflow-x-auto overflow-y-visible [scrollbar-width:none] md:flex sm:min-h-0 sm:gap-3 lg:gap-4 [&::-webkit-scrollbar]:hidden">
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
