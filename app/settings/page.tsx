import { redirect } from "next/navigation";
import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Database } from "@/types/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  User,
  Bell,
  Shield,
  CreditCard,
  HelpCircle,
  Lock,
  Settings,
  ExternalLink,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  SettingsProfileForm,
  SettingsNotificationsForm,
  SettingsPrivacyForm,
  SettingsPasswordForm,
} from "@/components/settings/settings-forms";
import { SettingsRolesSection } from "@/components/settings/settings-roles-section";
import { LogoutButton } from "@/components/settings/logout-button";
import { ConnectBankAccount } from "@/components/features/connect-bank-account";
import { ConnectPaymentMethod } from "@/components/features/connect-payment-method";
import { PayoutScheduleForm } from "@/components/settings/payout-schedule-form";
import { SettingsPaymentReturnHandler } from "@/components/settings/settings-payment-return-handler";

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

const sectionClass =
  "rounded-lg border border-border bg-card/80 p-4 transition-all dark:border-gray-800 dark:bg-gray-900 dark:text-gray-100";

function SectionHeader({
  icon: Icon,
  title,
  className,
}: {
  icon: React.ElementType;
  title: string;
  className?: string;
}) {
  return (
    <div className={cn("mb-3 flex items-center gap-2", className)}>
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-muted-foreground dark:bg-gray-800 dark:text-gray-300">
        <Icon className="h-4 w-4" />
      </div>
      <CardTitle className="text-base md:text-lg !mb-0 dark:text-gray-100">
        {title}
      </CardTitle>
    </div>
  );
}

type SettingsSearchParams = {
  tab?: string;
  payments?: string;
  export?: string;
};

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: SettingsSearchParams;
}) {
  const supabase = await createServerSupabaseClient();

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", session.user.id)
    .maybeSingle();

  if (!profile) {
    redirect("/onboarding/role-choice");
  }

  const p = profile as ProfileRow;
  const roles = ((p.roles as string[] | null) ?? []) as string[];
  const activeRole = (p as { active_role?: string | null })?.active_role ?? roles[0] ?? null;
  const isCleaner = roles.includes("cleaner");
  const isLister = roles.includes("lister");
  const showPaymentsTab = isLister || isCleaner;
  const isListerActive = activeRole === "lister";
  const isCleanerActive = activeRole === "cleaner";
  const notificationPrefs = (p as { notification_preferences?: Record<string, boolean> | null })
    ?.notification_preferences ?? null;
  const emailPreferencesLocked = (p as { email_preferences_locked?: boolean })?.email_preferences_locked ?? false;
  const profilePublic = (p as { profile_public?: boolean })?.profile_public ?? false;

  const tabFromQuery = (searchParams.tab as string | undefined)?.toLowerCase();
  const allowedTabs = new Set(["profile", "notifications", "security", "payments", "privacy", "preferences", "help"]);
  const initialTab = tabFromQuery && allowedTabs.has(tabFromQuery) ? tabFromQuery : "profile";

  return (
    <section className="page-inner space-y-6">
      <SettingsPaymentReturnHandler />
      <div>
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl dark:text-gray-100">
          Settings
        </h1>
        <p className="text-sm text-muted-foreground dark:text-gray-400">
          Manage your profile, notifications, security and preferences.
        </p>
      </div>

      <Card className="border-border bg-card/80 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <CardContent className="p-3 sm:p-4">
          {/* Desktop: Tabs */}
          <div className="hidden md:block">
            <Tabs defaultValue={initialTab} className="space-y-4">
              <TabsList className="flex flex-wrap gap-1 bg-muted/80 dark:bg-gray-800">
                <TabsTrigger value="profile" className="gap-1.5 data-[state=active]:bg-background dark:data-[state=active]:bg-gray-900">
                  <User className="h-3.5 w-3.5" />
                  Profile
                </TabsTrigger>
                <TabsTrigger value="notifications" className="gap-1.5">
                  <Bell className="h-3.5 w-3.5" />
                  Notifications
                </TabsTrigger>
                <TabsTrigger value="security" className="gap-1.5">
                  <Shield className="h-3.5 w-3.5" />
                  Security
                </TabsTrigger>
                {showPaymentsTab && (
                  <TabsTrigger value="payments" className="gap-1.5">
                    <CreditCard className="h-3.5 w-3.5" />
                    Payments
                  </TabsTrigger>
                )}
                <TabsTrigger value="privacy" className="gap-1.5">
                  <Lock className="h-3.5 w-3.5" />
                  Privacy
                </TabsTrigger>
                <TabsTrigger value="preferences" className="gap-1.5">
                  <Settings className="h-3.5 w-3.5" />
                  Preferences
                </TabsTrigger>
                <TabsTrigger value="help" className="gap-1.5">
                  <HelpCircle className="h-3.5 w-3.5" />
                  Help
                </TabsTrigger>
              </TabsList>

              <TabsContent value="profile" className="mt-4 transition-opacity duration-200 data-[state=inactive]:hidden">
                <div className={sectionClass}>
                  <SectionHeader icon={User} title="Profile" />
                  <div className="mb-4 border-b border-border pb-4 dark:border-gray-700">
                    <SettingsRolesSection roles={roles} />
                  </div>
                  <SettingsProfileForm profile={{ ...p, isCleaner }} />
                </div>
              </TabsContent>

              <TabsContent value="notifications" className="mt-4 transition-opacity duration-200 data-[state=inactive]:hidden">
                <div className={sectionClass}>
                  <SectionHeader icon={Bell} title="Notifications" />
                  <SettingsNotificationsForm
                    prefs={notificationPrefs}
                    locked={emailPreferencesLocked}
                    isCleaner={isCleaner}
                  />
                </div>
              </TabsContent>

              <TabsContent value="security" className="mt-4 transition-opacity duration-200 data-[state=inactive]:hidden">
                <div className={sectionClass}>
                  <SectionHeader icon={Shield} title="Security & password" />
                  <p className="mb-4 text-sm text-muted-foreground dark:text-gray-400">
                    Change your password below. Use your current password to confirm it’s you.
                  </p>
                  <SettingsPasswordForm />
                </div>
              </TabsContent>

              {showPaymentsTab && session && (
                <TabsContent value="payments" className="mt-4 transition-opacity duration-200 data-[state=inactive]:hidden">
                  <div className={sectionClass}>
                    {isListerActive && (
                      <>
                        <SectionHeader icon={CreditCard} title="Payment method" />
                        <p className="mb-4 text-sm text-muted-foreground dark:text-gray-400">
                          As a lister, save a card here to pay and start jobs in one click. Funds are held in escrow until you approve release.
                        </p>
                        <ConnectPaymentMethod
                          userId={session.user.id}
                          stripePaymentMethodId={(p as { stripe_payment_method_id?: string | null })?.stripe_payment_method_id ?? null}
                          isLister={true}
                        />
                      </>
                    )}
                    {isCleanerActive && (
                      <>
                        <SectionHeader icon={CreditCard} title="Payouts" />
                        <p className="mb-4 text-sm text-muted-foreground dark:text-gray-400">
                          As a cleaner, connect your Stripe account to receive payouts when listers approve & release funds.
                        </p>
                        <ConnectBankAccount
                          userId={session.user.id}
                          stripeConnectId={(p as { stripe_connect_id?: string | null })?.stripe_connect_id ?? null}
                          stripeOnboardingComplete={!!(p as { stripe_onboarding_complete?: boolean })?.stripe_onboarding_complete}
                          isCleaner={true}
                        />
                        <div className="mt-4 pt-4 border-t border-border dark:border-gray-700">
                          <PayoutScheduleForm
                            initial={((p as { preferred_payout_schedule?: string })?.preferred_payout_schedule as "daily" | "weekly" | "monthly" | "platform_default") ?? "platform_default"}
                          />
                        </div>
                        <div className="mt-4 flex flex-wrap gap-2">
                          <Button size="sm" className="rounded-full" asChild>
                            <Link href="/earnings">Transaction history</Link>
                          </Button>
                        </div>
                      </>
                    )}
                    {!isListerActive && !isCleanerActive && showPaymentsTab && (
                      <p className="text-sm text-muted-foreground dark:text-gray-400">
                        Switch to Lister or Cleaner role above to see payment or payout options.
                      </p>
                    )}
                  </div>
                </TabsContent>
              )}

              <TabsContent value="privacy" className="mt-4 transition-opacity duration-200 data-[state=inactive]:hidden">
                <div className={sectionClass}>
                  <SectionHeader icon={Lock} title="Privacy & data" />
                  <SettingsPrivacyForm profilePublic={profilePublic} />
                  <div className="mt-4 space-y-2 border-t border-border pt-4 dark:border-gray-700">
                    <Button size="sm" variant="outline" className="rounded-full" asChild>
                      <Link href="/settings?export=1">Download my data</Link>
                    </Button>
                    <p className="text-xs text-muted-foreground dark:text-gray-500">
                      Stub: export of profile and job history (GDPR-style).
                    </p>
                    <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50/70 p-3 text-sm dark:border-amber-800/60 dark:bg-amber-900/20 dark:text-amber-100">
                      <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-medium">Delete my data</p>
                        <p className="text-xs text-muted-foreground dark:text-amber-200/80">
                          Permanently deleting your account and data cannot be undone. Contact support to request account deletion.
                        </p>
                        <Button size="sm" variant="destructive" className="mt-2 rounded-full" disabled>
                          Request account deletion
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="preferences" className="mt-4 transition-opacity duration-200 data-[state=inactive]:hidden">
                <div className={sectionClass}>
                  <SectionHeader icon={Settings} title="Preferences" />
                  <p className="text-sm text-muted-foreground dark:text-gray-400">
                    Theme (light / dark / system) and default role are available in the header and dashboard. Distance unit (km / miles) can be added here later.
                  </p>
                </div>
              </TabsContent>

              <TabsContent value="help" className="mt-4 transition-opacity duration-200 data-[state=inactive]:hidden">
                <div className={sectionClass}>
                  <SectionHeader icon={HelpCircle} title="Help & support" />
                  <ul className="space-y-2 text-sm dark:text-gray-200">
                    <li>
                      <Link href="/help" className="flex items-center gap-2 text-primary underline-offset-4 hover:underline">
                        FAQ <ExternalLink className="h-3 w-3" />
                      </Link>
                    </li>
                    <li>
                      <Link href="mailto:support@bondback.com" className="flex items-center gap-2 text-primary underline-offset-4 hover:underline">
                        Contact support <ExternalLink className="h-3 w-3" />
                      </Link>
                    </li>
                    <li>
                      <Link href="/terms" className="flex items-center gap-2 text-primary underline-offset-4 hover:underline">
                        Terms of service <ExternalLink className="h-3 w-3" />
                      </Link>
                    </li>
                    <li>
                      <Link href="/privacy" className="flex items-center gap-2 text-primary underline-offset-4 hover:underline">
                        Privacy policy <ExternalLink className="h-3 w-3" />
                      </Link>
                    </li>
                  </ul>
                </div>
              </TabsContent>
            </Tabs>
          </div>

          {/* Mobile: Accordion */}
          <div className="md:hidden">
            <Accordion type="single" collapsible defaultValue={initialTab} className="w-full">
              <AccordionItem value="profile">
                <AccordionTrigger className="flex items-center gap-2 py-3 text-left">
                  <User className="h-4 w-4 text-muted-foreground" />
                  Profile
                </AccordionTrigger>
                <AccordionContent>
                  <div className={sectionClass}>
                    <div className="mb-4 border-b border-border pb-4 dark:border-gray-700">
                      <SettingsRolesSection roles={roles} />
                    </div>
                    <SettingsProfileForm profile={{ ...p, isCleaner }} />
                  </div>
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="notifications">
                <AccordionTrigger className="flex items-center gap-2 py-3 text-left">
                  <Bell className="h-4 w-4 text-muted-foreground" />
                  Notifications
                </AccordionTrigger>
                <AccordionContent>
                  <div className={sectionClass}>
                    <SettingsNotificationsForm
                      prefs={notificationPrefs}
                      locked={emailPreferencesLocked}
                      isCleaner={isCleaner}
                    />
                  </div>
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="security">
                <AccordionTrigger className="flex items-center gap-2 py-3 text-left">
                  <Shield className="h-4 w-4 text-muted-foreground" />
                  Security
                </AccordionTrigger>
                <AccordionContent>
                  <div className={sectionClass}>
                    <SectionHeader icon={Shield} title="Security & password" />
                    <p className="mb-4 text-sm text-muted-foreground dark:text-gray-400">
                      Change your password below. Use your current password to confirm it’s you.
                    </p>
                    <SettingsPasswordForm />
                  </div>
                </AccordionContent>
              </AccordionItem>
              {showPaymentsTab && session && (
                <AccordionItem value="payments">
                  <AccordionTrigger className="flex items-center gap-2 py-3 text-left">
                    <CreditCard className="h-4 w-4 text-muted-foreground" />
                    Payments
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className={sectionClass}>
                      {isListerActive && (
                        <>
                          <SectionHeader icon={CreditCard} title="Payment method" />
                          <p className="mb-4 text-sm text-muted-foreground dark:text-gray-400">
                            As a lister, save a card to pay and start jobs. Funds are held in escrow until you approve release.
                          </p>
                          <ConnectPaymentMethod
                            userId={session.user.id}
                            stripePaymentMethodId={(p as { stripe_payment_method_id?: string | null })?.stripe_payment_method_id ?? null}
                            isLister={true}
                          />
                        </>
                      )}
                      {isCleanerActive && (
                        <>
                          <SectionHeader icon={CreditCard} title="Payouts" />
                          <p className="mb-4 text-sm text-muted-foreground dark:text-gray-400">
                            As a cleaner, connect your Stripe account to receive payouts when listers approve & release funds.
                          </p>
                          <ConnectBankAccount
                            userId={session.user.id}
                            stripeConnectId={(p as { stripe_connect_id?: string | null })?.stripe_connect_id ?? null}
                            stripeOnboardingComplete={!!(p as { stripe_onboarding_complete?: boolean })?.stripe_onboarding_complete}
                            isCleaner={true}
                          />
                          <div className="mt-4 pt-4 border-t border-border dark:border-gray-700">
                            <PayoutScheduleForm
                              initial={((p as { preferred_payout_schedule?: string })?.preferred_payout_schedule as "daily" | "weekly" | "monthly" | "platform_default") ?? "platform_default"}
                            />
                          </div>
                          <div className="mt-4 flex flex-wrap gap-2">
                            <Button size="sm" className="rounded-full" asChild>
                              <Link href="/earnings">Transaction history</Link>
                            </Button>
                          </div>
                        </>
                      )}
                      {!isListerActive && !isCleanerActive && showPaymentsTab && (
                        <p className="text-sm text-muted-foreground dark:text-gray-400">
                          Switch to Lister or Cleaner role above to see payment or payout options.
                        </p>
                      )}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              )}
              <AccordionItem value="privacy">
                <AccordionTrigger className="flex items-center gap-2 py-3 text-left">
                  <Lock className="h-4 w-4 text-muted-foreground" />
                  Privacy & data
                </AccordionTrigger>
                <AccordionContent>
                  <div className={sectionClass}>
                    <SettingsPrivacyForm profilePublic={profilePublic} />
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" className="rounded-full" asChild>
                        <Link href="/settings?export=1">Download my data</Link>
                      </Button>
                      <p className="text-xs text-muted-foreground dark:text-gray-500 w-full">
                        Delete my data: contact support. Request account deletion (stub) below.
                      </p>
                      <Button size="sm" variant="destructive" className="rounded-full" disabled>
                        Request account deletion
                      </Button>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="preferences">
                <AccordionTrigger className="flex items-center gap-2 py-3 text-left">
                  <Settings className="h-4 w-4 text-muted-foreground" />
                  Preferences
                </AccordionTrigger>
                <AccordionContent>
                  <div className={sectionClass}>
                    <p className="text-sm text-muted-foreground dark:text-gray-400">
                      Theme and default role are in the header. Distance unit (km/miles) coming later.
                    </p>
                  </div>
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="help">
                <AccordionTrigger className="flex items-center gap-2 py-3 text-left">
                  <HelpCircle className="h-4 w-4 text-muted-foreground" />
                  Help & support
                </AccordionTrigger>
                <AccordionContent>
                  <div className={sectionClass}>
                    <ul className="space-y-2 text-sm dark:text-gray-200">
                      <li><Link href="/help" className="text-primary underline-offset-4 hover:underline">FAQ</Link></li>
                      <li><Link href="/support" className="text-primary underline-offset-4 hover:underline">Contact support</Link></li>
                      <li><Link href="/terms" className="text-primary underline-offset-4 hover:underline">Terms of service</Link></li>
                      <li><Link href="/privacy" className="text-primary underline-offset-4 hover:underline">Privacy policy</Link></li>
                    </ul>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>

          {/* Account actions (bottom) */}
          <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-border pt-4 dark:border-gray-700">
            <LogoutButton />
            <Button variant="destructive" size="sm" className="rounded-full" disabled title="Contact support to delete account">
              Delete account
            </Button>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
