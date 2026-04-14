"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  Joyride,
  EVENTS,
  type EventData,
  type Step,
  type TooltipRenderProps,
} from "react-joyride";
import { markOnboardingTourSeen } from "@/lib/actions/profile";
import { PRODUCT_TOUR_RESTART_EVENT } from "@/lib/product-tour-constants";
import type { ProfileRole } from "@/lib/types";
import { cn } from "@/lib/utils";

const MD_MIN = 768;

function useIsDesktopMd(): boolean {
  const [wide, setWide] = React.useState(false);
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia(`(min-width: ${MD_MIN}px)`);
    const apply = () => setWide(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);
  return wide;
}

function tourExcludedPath(pathname: string | null): boolean {
  if (!pathname) return true;
  return (
    pathname.startsWith("/login") ||
    pathname.startsWith("/signup") ||
    pathname.startsWith("/onboarding") ||
    pathname.startsWith("/auth") ||
    pathname.startsWith("/admin")
  );
}

function listerSteps(isDesktop: boolean): Step[] {
  const createTarget = isDesktop ? "#tour-create-listing-desktop" : "#tour-create-listing-mobile";
  const listingsTarget = isDesktop ? "#tour-user-menu" : "#tour-bottom-listings";
  return [
    {
      target: "body",
      placement: "center",
      skipBeacon: true,
      content: (
        <p className="m-0 text-sm leading-relaxed text-popover-foreground">
          Welcome to Bond Back. You&apos;re in <strong>Lister</strong> mode — post bond cleans, compare
          bids, and hire cleaners with confidence.
        </p>
      ),
    },
    {
      target: createTarget,
      skipBeacon: true,
      placement: isDesktop ? "bottom" : "bottom",
      spotlightPadding: 10,
      content: (
        <p className="m-0 text-sm leading-relaxed text-popover-foreground">
          Start here: <strong>Create Listing</strong> walks you through photos, dates, and pricing so
          cleaners can bid accurately.
        </p>
      ),
    },
    {
      target: listingsTarget,
      skipBeacon: true,
      placement: isDesktop ? "bottom" : "top",
      spotlightPadding: 10,
      content: (
        <p className="m-0 text-sm leading-relaxed text-popover-foreground">
          {isDesktop ? (
            <>
              Open your <strong>avatar menu</strong> for <strong>My Listings</strong>, your dashboard, and
              activity.
            </>
          ) : (
            <>
              Use the bottom <strong>Listings</strong> tab to open everything you&apos;ve posted.
            </>
          )}
        </p>
      ),
    },
    {
      target: "#tour-account-tools-nav",
      skipBeacon: true,
      placement: "bottom",
      spotlightPadding: 8,
      content: (
        <p className="m-0 text-sm leading-relaxed text-popover-foreground">
          <strong>Notifications</strong> keep you on top of bids and job updates. Your{" "}
          <strong>role switcher</strong> and <strong>account menu</strong> (including light/dark mode) live
          here too.
        </p>
      ),
    },
    {
      target: "#tour-footer-help",
      skipBeacon: true,
      placement: "top",
      spotlightPadding: 8,
      content: (
        <p className="m-0 text-sm leading-relaxed text-popover-foreground">
          Need FAQs or support? Use <strong>Help</strong> in the footer (or your account menu) any time.
        </p>
      ),
    },
  ];
}

function cleanerSteps(isDesktop: boolean): Step[] {
  const jobsTarget = isDesktop ? "#tour-find-jobs-desktop" : "#tour-mobile-main-menu";
  const messagesTarget = isDesktop ? "#tour-user-menu" : "#tour-bottom-messages";
  return [
    {
      target: "body",
      placement: "center",
      skipBeacon: true,
      content: (
        <p className="m-0 text-sm leading-relaxed text-popover-foreground">
          Welcome to Bond Back. You&apos;re in <strong>Cleaner</strong> mode — browse jobs, bid with clear
          pricing, and get paid securely after the clean.
        </p>
      ),
    },
    {
      target: jobsTarget,
      skipBeacon: true,
      placement: isDesktop ? "bottom" : "top",
      spotlightPadding: 10,
      content: (
        <p className="m-0 text-sm leading-relaxed text-popover-foreground">
          {isDesktop ? (
            <>
              Tap <strong>Find Jobs</strong> to see bond cleans near you. Filters help you match suburb and
              timing.
            </>
          ) : (
            <>
              Tap the <strong>menu (☰)</strong>, then <strong>Find Jobs</strong> — same listings as on
              desktop.
            </>
          )}
        </p>
      ),
    },
    {
      target: "body",
      placement: "center",
      skipBeacon: true,
      content: (
        <p className="m-0 text-sm leading-relaxed text-popover-foreground">
          On a job page, place your <strong>bid</strong> or use <strong>public comments</strong> to ask the
          lister questions before you commit.
        </p>
      ),
    },
    {
      target: messagesTarget,
      skipBeacon: true,
      placement: isDesktop ? "bottom" : "top",
      spotlightPadding: 10,
      content: (
        <p className="m-0 text-sm leading-relaxed text-popover-foreground">
          When you <strong>win a job</strong>, <strong>Messages</strong> becomes the home for on-job chat
          with the lister — check here for updates and photos.
        </p>
      ),
    },
    {
      target: "#tour-account-tools-nav",
      skipBeacon: true,
      placement: "bottom",
      spotlightPadding: 8,
      content: (
        <p className="m-0 text-sm leading-relaxed text-popover-foreground">
          The <strong>bell</strong> is for notifications. <strong>My Earnings</strong> and account settings
          (including theme) are under your <strong>avatar menu</strong>.
        </p>
      ),
    },
  ];
}

function ProductTourTooltip(tooltipProps: TooltipRenderProps) {
  const {
    continuous,
    index,
    isLastStep,
    size,
    step,
    backProps,
    closeProps,
    primaryProps,
    skipProps,
    tooltipProps: rootProps,
  } = tooltipProps;
  const stepNum = index + 1;
  return (
    <div
      {...rootProps}
      className={cn(
        "max-w-[min(100vw-1.5rem,22rem)] rounded-2xl border border-border bg-popover text-popover-foreground shadow-2xl",
        "dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100",
        "ring-1 ring-black/5 dark:ring-white/10"
      )}
    >
      <div className="flex items-center justify-between gap-2 border-b border-border/80 px-3 py-2.5 dark:border-gray-800">
        <p className="m-0 text-xs font-semibold uppercase tracking-wide text-muted-foreground dark:text-gray-400">
          {stepNum} of {size}
        </p>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1" aria-hidden>
            {Array.from({ length: size }, (_, i) => (
              <span
                key={i}
                className={cn(
                  "h-1.5 w-1.5 rounded-full transition-colors",
                  i === index ? "bg-primary" : "bg-muted-foreground/35 dark:bg-gray-600"
                )}
              />
            ))}
          </div>
          <button
            type="button"
            {...closeProps}
            className="flex h-9 min-w-9 items-center justify-center rounded-full text-muted-foreground hover:bg-muted dark:text-gray-400 dark:hover:bg-gray-800"
            aria-label="Close tour"
          >
            <span className="text-lg leading-none" aria-hidden>
              ×
            </span>
          </button>
        </div>
      </div>
      <div className="px-3 py-3.5 sm:px-4 sm:py-4">{step.content}</div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/80 px-3 py-2.5 dark:border-gray-800">
        <button
          type="button"
          {...skipProps}
          className="min-h-11 touch-manipulation rounded-full px-3 text-sm font-medium text-muted-foreground underline-offset-4 hover:underline dark:text-gray-400"
        >
          Skip tour
        </button>
        <div className="flex items-center gap-2">
          {index > 0 && (
            <button
              type="button"
              {...backProps}
              className="min-h-11 touch-manipulation rounded-full border border-border bg-background px-4 text-sm font-semibold dark:border-gray-600 dark:bg-gray-900"
            >
              Back
            </button>
          )}
          <button
            type="button"
            {...primaryProps}
            className="min-h-11 min-w-[5.5rem] touch-manipulation rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm"
          >
            {continuous && !isLastStep ? "Next" : "Done"}
          </button>
        </div>
      </div>
    </div>
  );
}

export type ProductTourProps = {
  activeRole: ProfileRole | null;
  isEmailVerified: boolean;
  hasSeenOnboardingTour: boolean;
};

export function ProductTour({ activeRole, isEmailVerified, hasSeenOnboardingTour }: ProductTourProps) {
  const pathname = usePathname();
  const router = useRouter();
  const isDesktop = useIsDesktopMd();
  const [run, setRun] = React.useState(false);
  const [tourKey, setTourKey] = React.useState(0);
  const autoStartedRef = React.useRef(false);

  const steps = React.useMemo(() => {
    if (activeRole === "lister") return listerSteps(isDesktop);
    if (activeRole === "cleaner") return cleanerSteps(isDesktop);
    return [];
  }, [activeRole, isDesktop]);

  const shouldAutoStart =
    !!activeRole &&
    isEmailVerified &&
    !hasSeenOnboardingTour &&
    !tourExcludedPath(pathname) &&
    steps.length > 0;

  React.useEffect(() => {
    const onRestart = () => {
      if (!activeRole) return;
      setRun(false);
      window.requestAnimationFrame(() => {
        setTourKey((k) => k + 1);
        setRun(true);
      });
    };
    window.addEventListener(PRODUCT_TOUR_RESTART_EVENT, onRestart);
    return () => window.removeEventListener(PRODUCT_TOUR_RESTART_EVENT, onRestart);
  }, [activeRole]);

  React.useEffect(() => {
    if (!shouldAutoStart || autoStartedRef.current) return;
    if (tourExcludedPath(pathname)) return;
    const t = window.setTimeout(() => {
      autoStartedRef.current = true;
      setRun(true);
    }, 700);
    return () => clearTimeout(t);
  }, [shouldAutoStart, pathname]);

  const persistTourSeen = React.useCallback(async () => {
    const res = await markOnboardingTourSeen();
    if (res.ok) {
      router.refresh();
    }
  }, [router]);

  const handleEvent = React.useCallback(
    (data: EventData) => {
      if (data.type === EVENTS.TOUR_END) {
        setRun(false);
        void persistTourSeen();
      }
    },
    [persistTourSeen]
  );

  if (!activeRole || steps.length === 0) {
    return null;
  }

  return (
    <Joyride
      key={tourKey}
      run={run}
      steps={steps}
      continuous
      scrollToFirstStep
      onEvent={handleEvent}
      options={{
        zIndex: 10050,
        primaryColor: "hsl(var(--primary))",
        textColor: "hsl(var(--popover-foreground))",
        backgroundColor: "hsl(var(--popover))",
        arrowColor: "hsl(var(--popover))",
        overlayColor: "rgba(15, 23, 42, 0.55)",
        showProgress: false,
        scrollOffset: 88,
        blockTargetInteraction: false,
        spotlightRadius: 12,
      }}
      styles={{
        overlay: {
          mixBlendMode: "normal",
        },
        floater: { filter: undefined },
      }}
      locale={{ last: "Done", next: "Next", back: "Back" }}
      tooltipComponent={ProductTourTooltip}
    />
  );
}
