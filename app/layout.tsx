import type { ReactNode } from "react";
import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { getSiteUrl } from "@/lib/site";
import "./globals.css";
import { Header } from "@/components/layout/header";
import { SiteFooter } from "@/components/layout/site-footer";
import { ChatPanelProvider } from "@/components/chat/chat-panel-context";
import { LazyFloatingChatPanel } from "@/components/chat/lazy-floating-chat-panel";
import { getSessionWithProfile } from "@/lib/supabase/session";
import { Toaster } from "@/components/ui/toaster";
import { getGlobalSettings } from "@/lib/actions/global-settings";
import { SiteAnnouncementBanner } from "@/components/banners/site-announcement-banner";
import { TestModeBanner } from "@/components/banners/test-mode-banner";
import { PwaInstallPrompt } from "@/components/pwa/pwa-install-prompt";
import { PwaRegisterSw } from "@/components/pwa/pwa-register-sw";
import { GlobalOfflineBanner } from "@/components/layout/global-offline-banner";
import { FirstJobRewardsNudge } from "@/components/banners/first-job-rewards-nudge";
import { getFirstJobRewardsNudgeVisible } from "@/lib/beta-banners";
import { RegisterExpoPushToken } from "@/components/pwa/register-expo-push-token";
import { MobileBottomNav } from "@/components/mobile-bottom-nav";
import { ContextualFab } from "@/components/contextual-fab";
import { SessionSync } from "@/components/auth/session-sync";
import { UserPreferencesHydration } from "@/components/providers/user-preferences-hydration";

const site = getSiteUrl();

/** Header + floating chat read global_settings; avoid caching a stale shell. */
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
  icons: {
    icon: [{ url: "/favicon.ico" }],
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
  const rawFloating = (settings as { floating_chat_enabled?: unknown } | null)?.floating_chat_enabled;
  const floatingChatEnabled =
    settings == null
      ? true
      : !(
          rawFloating === false ||
          rawFloating === "false" ||
          rawFloating === 0
        );
  const stripeTestMode = (settings as { stripe_test_mode?: boolean } | null)?.stripe_test_mode === true;

  const showFirstJobNudge = await getFirstJobRewardsNudgeVisible(session?.user.id ?? null);

  const serverTheme = session?.profile?.theme_preference ?? "";

  return (
    <html lang="en" suppressHydrationWarning data-bb-theme={serverTheme}>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <link rel="preload" href="/manifest.json" as="fetch" />
        <Script
          id="bb-theme-init"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `
  (function() {
    try {
      var stored = window.localStorage.getItem('theme');
      var srv = document.documentElement.getAttribute('data-bb-theme') || '';
      var systemPrefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
      var effective;
      if (stored === 'light' || stored === 'dark' || stored === 'system') {
        effective = stored;
      } else if (srv === 'light' || srv === 'dark' || srv === 'system') {
        effective = srv;
      } else {
        effective = 'system';
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
        {showAnnouncement && settings?.announcement_text?.trim() ? (
          <SiteAnnouncementBanner text={settings.announcement_text} />
        ) : null}
        <TestModeBanner stripeTestMode={stripeTestMode} />
        <PwaRegisterSw />
        <SessionSync />
        {session?.profile ? (
          <UserPreferencesHydration distanceUnit={session.profile.distance_unit} />
        ) : null}
        <RegisterExpoPushToken />
        <Toaster>
          <ChatPanelProvider
            currentUserId={session?.user.id ?? null}
            autoOpenOnNewMessage={true}
          >
            <div className="page-shell">
              <Header
                floatingChatEnabled={floatingChatEnabled}
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
            <LazyFloatingChatPanel enabled={!!floatingChatEnabled} />
            <MobileBottomNav
              initialActiveRole={session?.activeRole ?? null}
              userId={session?.user.id ?? null}
            />
            <ContextualFab activeRole={session?.activeRole ?? null} />
          </ChatPanelProvider>
        </Toaster>
        <PwaInstallPrompt />
      </body>
    </html>
  );
};

export default RootLayout;

