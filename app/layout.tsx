import type { ReactNode } from "react";
import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { getSiteUrl } from "@/lib/site";
import "./globals.css";
import { Header } from "@/components/layout/header";
import { SiteFooter } from "@/components/layout/site-footer";
import { getSessionWithProfile } from "@/lib/supabase/session";
import { Toaster } from "@/components/ui/toaster";
import { getGlobalSettings } from "@/lib/actions/global-settings";
import { parseDefaultSiteThemeFromSettings } from "@/lib/global-settings-default-theme";
import { SiteAnnouncementBanner } from "@/components/banners/site-announcement-banner";
import { TestModeBanner } from "@/components/banners/test-mode-banner";
import { PwaInstallPrompt } from "@/components/pwa/pwa-install-prompt";
import { PwaRegisterSw } from "@/components/pwa/pwa-register-sw";
import { GlobalOfflineBanner } from "@/components/layout/global-offline-banner";
import { FirstJobRewardsNudge } from "@/components/banners/first-job-rewards-nudge";
import { getFirstJobRewardsNudgeVisible } from "@/lib/beta-banners";
import { RegisterExpoPushToken } from "@/components/pwa/register-expo-push-token";
import { PushPermissionBanner } from "@/components/pwa/push-permission-banner";
import { ExpoPushDeepLinkHandler } from "@/components/pwa/expo-push-deep-link";
import { MobileBottomNav } from "@/components/mobile-bottom-nav";
import { ContextualFab } from "@/components/contextual-fab";
import { UserPreferencesHydration } from "@/components/providers/user-preferences-hydration";
import { QueryClientProviderWrapper } from "@/components/providers/query-client-provider";
import { NotificationsRealtimeSync } from "@/components/notifications/notifications-realtime-sync";
import { NotificationAudioUnlock } from "@/components/notifications/notification-audio-unlock";
import { NavigationRouteProgress } from "@/components/navigation/navigation-route-progress";
import { SessionSync } from "@/components/auth/session-sync";
import { SupportContactProvider } from "@/components/providers/support-contact-provider";
import { getSupportContactEmail } from "@/lib/support-contact-email";
import { LoggedInRoutePrefetch } from "@/components/performance/logged-in-route-prefetch";
import { ProductTour } from "@/components/onboarding/ProductTour";
import { CreateListingPickerProvider } from "@/components/listing/create-listing-picker-context";

const site = getSiteUrl();

/** Header reads global_settings; avoid caching a stale shell. */
export const dynamic = "force-dynamic";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#3b82f6" },
    { media: "(prefers-color-scheme: dark)", color: "#1e3a5f" },
  ],
};

export const metadata: Metadata = {
  metadataBase: site,
  title: {
    default:
      "Bond Back — Bond cleaning & end of lease cleaning (Australia)",
    template: "%s · Bond Back",
  },
  description:
    "Australian marketplace for bond cleaning and end of lease cleaning. Listers post jobs, cleaners bid in a reverse auction, and you get your bond back with transparent pricing.",
  applicationName: "Bond Back",
  keywords: [
    "bond cleaning Sunshine Coast",
    "end of lease cleaning Sunshine Coast",
    "bond clean Sunshine Coast",
    "bond cleaning",
    "end of lease cleaning",
    "bond back",
    "bond clean Australia",
    "vacate cleaning",
    "reverse auction cleaning",
    "rental bond",
  ],
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "en_AU",
    url: "/",
    siteName: "Bond Back",
    title: "Bond Back — Bond cleaning & end of lease cleaning",
    description:
      "Australian bond cleaning and end of lease cleaning marketplace. Fair pricing through competitive bids — get your bond back.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Bond Back — Bond cleaning & end of lease cleaning",
    description:
      "Australian marketplace for bond cleaning and end of lease cleaning. List, bid, and release payment securely.",
  },
};

export type RootLayoutProps = {
  children: ReactNode;
};

const RootLayout = async ({ children }: RootLayoutProps) => {
  let session: Awaited<ReturnType<typeof getSessionWithProfile>> = null;
  let settings: Awaited<ReturnType<typeof getGlobalSettings>> = null;
  try {
    [session, settings] = await Promise.all([
      getSessionWithProfile(),
      getGlobalSettings(),
    ]);
  } catch (e) {
    if (process.env.NODE_ENV !== "production") {
      console.error("[RootLayout] session or settings failed:", e);
    }
  }
  const showAnnouncement =
    !!settings?.announcement_active &&
    !!settings?.announcement_text &&
    (settings.announcement_text?.trim().length ?? 0) > 0;
  // When settings row is missing (error), default on. When row exists: off only if explicitly false.
  // Use !== false (not === true) so undefined/null column and legacy rows default to "on", and
  // strict boolean from PostgREST still works.
  const stripeTestMode = (settings as { stripe_test_mode?: boolean } | null)?.stripe_test_mode === true;

  const showFirstJobNudge = await getFirstJobRewardsNudgeVisible(session?.user.id ?? null);

  const serverTheme = session?.profile?.theme_preference ?? "";
  const siteDefaultTheme = parseDefaultSiteThemeFromSettings(settings);

  return (
    <html
      lang="en"
      suppressHydrationWarning
      data-bb-theme={serverTheme}
      data-bb-site-default-theme={siteDefaultTheme}
    >
      <head>
        <link rel="manifest" href="/manifest.json" />
        <Script
          id="bb-theme-init"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `
  (function() {
    try {
      var stored = window.localStorage.getItem('theme');
      var srv = document.documentElement.getAttribute('data-bb-theme') || '';
      var siteDef = document.documentElement.getAttribute('data-bb-site-default-theme') || 'dark';
      if (siteDef !== 'light' && siteDef !== 'dark') siteDef = 'dark';
      var systemPrefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
      var effective;
      if (stored === 'light' || stored === 'dark' || stored === 'system') {
        effective = stored;
      } else if (srv === 'light' || srv === 'dark' || srv === 'system') {
        effective = srv;
      } else {
        effective = siteDef;
      }
      var isDark = effective === 'dark' || (effective === 'system' && systemPrefersDark);
      if (isDark) document.documentElement.classList.add('dark');
      else document.documentElement.classList.remove('dark');
    } catch (e) {}
  })();
          `,
          }}
        />
      </head>
      <body>
        <SupportContactProvider email={getSupportContactEmail()}>
        <QueryClientProviderWrapper>
        <CreateListingPickerProvider>
        {showAnnouncement && settings?.announcement_text?.trim() ? (
          <SiteAnnouncementBanner text={settings.announcement_text} />
        ) : null}
        <TestModeBanner stripeTestMode={stripeTestMode} />
        <PwaRegisterSw />
        <NotificationAudioUnlock />
        <NavigationRouteProgress />
        <SessionSync />
        {session?.profile ? (
          <UserPreferencesHydration distanceUnit={session.profile.distance_unit} />
        ) : null}
        {session?.user?.id ? (
          <>
            <LoggedInRoutePrefetch />
            <NotificationsRealtimeSync userId={session.user.id} />
            {session.profile ? (
              <ProductTour
                activeRole={session.activeRole}
                isEmailVerified={session.profile.is_email_verified === true}
                hasSeenOnboardingTour={session.profile.hasSeenOnboardingTour === true}
              />
            ) : null}
          </>
        ) : null}
        <RegisterExpoPushToken userId={session?.user.id ?? null} />
        <ExpoPushDeepLinkHandler />
        <Toaster>
          <div className="page-shell">
            {session?.user?.id ? <PushPermissionBanner userId={session.user.id} /> : null}
            <Header
              key={session?.user?.id ?? "guest"}
              stripeTestMode={stripeTestMode}
            />
            <GlobalOfflineBanner />
            <main className="page-main pt-4 pb-[max(4.75rem,env(safe-area-inset-bottom))] md:pb-4">
              <div className="container mx-auto px-4 pt-2">
                <FirstJobRewardsNudge visible={showFirstJobNudge} />
              </div>
              {children}
            </main>
            <SiteFooter />
          </div>
          <MobileBottomNav
            initialActiveRole={session?.activeRole ?? null}
            userId={session?.user.id ?? null}
          />
          <ContextualFab activeRole={session?.activeRole ?? null} />
        </Toaster>
        <PwaInstallPrompt />
        </CreateListingPickerProvider>
        </QueryClientProviderWrapper>
        </SupportContactProvider>
      </body>
    </html>
  );
};

export default RootLayout;

