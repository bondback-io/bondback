"use client";

import * as React from "react";
import Link from "next/link";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import {
  User,
  Users,
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
import { useSupportContactDisplayEmail } from "@/components/providers/support-contact-provider";
import {
  SettingsNotificationsForm,
  SettingsPrivacyForm,
  SettingsPasswordForm,
} from "@/components/settings/settings-forms";
import { SettingsRolesSection } from "@/components/settings/settings-roles-section";
import { LogoutButton } from "@/components/settings/logout-button";
import { ConnectBankAccount } from "@/components/features/connect-bank-account";
import { ConnectPaymentMethod } from "@/components/features/connect-payment-method";
import { PayoutScheduleForm } from "@/components/settings/payout-schedule-form";
import { SettingsPreferencesForm } from "@/components/settings/settings-preferences-form";
import { ProfileForm } from "@/components/features/profile-form";
import type { DistanceUnitPref, ThemePreference } from "@/lib/types";
import type { Database } from "@/types/supabase";
import type { User as SupabaseUser } from "@supabase/supabase-js";

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

const sectionClass =
  "rounded-lg border border-border bg-card/80 p-3 text-card-foreground transition-colors sm:p-5 md:p-4 dark:border-gray-800 dark:bg-gray-950/90 dark:text-gray-100";

const settingsOutlineBtn =
  "rounded-full border-border dark:border-gray-600 dark:text-gray-100 dark:hover:bg-gray-800/90 dark:hover:text-white";

const settingsLinkClass =
  "flex min-h-[44px] items-center gap-2 text-primary underline-offset-4 hover:underline dark:text-blue-300 dark:hover:text-blue-200";

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
      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-muted text-muted-foreground md:h-10 md:w-10 dark:bg-gray-800 dark:text-gray-300">
        <Icon className="h-5 w-5 md:h-4 md:w-4" />
      </div>
      <span className="text-lg font-semibold tracking-tight dark:text-gray-100">{title}</span>
    </div>
  );
}

export type MyAccountSectionsProps = {
  /** When set (e.g. `?tab=`), that section opens; otherwise all collapsed. */
  initialAccordion: string | null;
  profile: ProfileRow;
  user: SupabaseUser;
  roles: string[];
  activeRole: string | null;
  isCleaner: boolean;
  isLister: boolean;
  isListerActive: boolean;
  isCleanerActive: boolean;
  showPaymentsTab: boolean;
  notificationPrefs: Record<string, boolean> | null;
  emailPreferencesLocked: boolean;
  profilePublic: boolean;
  themePreference: ThemePreference;
  distanceUnitPref: DistanceUnitPref;
};

function ensureSection(open: string[], value: string): string[] {
  return open.includes(value) ? open : [...open, value];
}

export function MyAccountSections({
  initialAccordion,
  profile,
  user,
  roles,
  activeRole,
  isCleaner,
  isLister,
  isListerActive,
  isCleanerActive,
  showPaymentsTab,
  notificationPrefs,
  emailPreferencesLocked,
  profilePublic,
  themePreference,
  distanceUnitPref,
}: MyAccountSectionsProps) {
  const supportContactEmail = useSupportContactDisplayEmail();
  const [openSections, setOpenSections] = React.useState<string[]>(() =>
    initialAccordion ? [initialAccordion] : []
  );

  React.useEffect(() => {
    if (typeof window === "undefined") return;

    const focusFieldAfterScroll = (el: HTMLElement) => {
      if (
        el instanceof HTMLInputElement ||
        el instanceof HTMLTextAreaElement ||
        el instanceof HTMLSelectElement ||
        el instanceof HTMLButtonElement
      ) {
        el.focus({ preventScroll: true });
        return;
      }
      const focusable = el.querySelector<HTMLElement>(
        "input:not([type=hidden]), textarea, select, button, [tabindex]:not([tabindex='-1'])"
      );
      focusable?.focus({ preventScroll: true });
    };

    const scrollToId = (id: string, delayMs: number) => {
      window.setTimeout(() => {
        const el = document.getElementById(id);
        el?.scrollIntoView({ behavior: "smooth", block: "center" });
        if (el) focusFieldAfterScroll(el);
      }, delayMs);
    };

    const applyHash = () => {
      const params = new URLSearchParams(window.location.search);
      const payments = params.get("payments");
      if (payments === "success" || payments === "cancelled") {
        setOpenSections((prev) => ensureSection(prev, "payments"));
      }
      const hash = window.location.hash.replace("#", "");
      const personalFieldHashes = new Set([
        "portfolio-photos",
        "profile-photo",
        "phone",
        "date_of_birth",
        "full_name",
        "cleaner_username",
        "email",
        "abn",
        "insurance_policy_number",
        "max_travel_km",
        "years_experience",
        "vehicle_type",
        "bio",
        "business_name",
        "equipment_notes",
        "profile-cleaner-location",
        "profile-lister-location",
      ]);
      if (hash === "section-personal" || hash === "personal") {
        setOpenSections((prev) => ensureSection(prev, "personal"));
        scrollToId("section-personal", 420);
      } else if (personalFieldHashes.has(hash)) {
        setOpenSections((prev) => ensureSection(prev, "personal"));
        scrollToId(hash, 560);
      }
      if (hash === "my-roles") {
        setOpenSections((prev) => ensureSection(prev, "roles"));
        requestAnimationFrame(() => {
          document.getElementById("my-roles")?.scrollIntoView({ behavior: "smooth", block: "start" });
        });
      }
      if (hash === "support") {
        setOpenSections((prev) => ensureSection(prev, "help"));
        requestAnimationFrame(() => {
          document.getElementById("support")?.scrollIntoView({ behavior: "smooth", block: "start" });
        });
      }
    };

    applyHash();
    window.addEventListener("hashchange", applyHash);
    return () => window.removeEventListener("hashchange", applyHash);
  }, []);

  const p = profile;

  return (
    <div className="space-y-3">
      <Accordion
        type="multiple"
        value={openSections}
        onValueChange={setOpenSections}
        className="w-full space-y-1.5"
      >
        {/* 1. Personal info */}
        <AccordionItem value="personal" id="section-personal" className="scroll-mt-24 rounded-xl border border-border bg-card/40 dark:border-gray-800 dark:bg-gray-950/40">
          <AccordionTrigger className="min-h-[52px] px-2 py-3 text-left text-base font-semibold hover:no-underline sm:px-4 dark:text-gray-100">
            <span className="flex items-center gap-3">
              <User className="h-5 w-5 shrink-0 text-muted-foreground dark:text-gray-400" />
              Personal info
            </span>
          </AccordionTrigger>
          <AccordionContent className="px-0 pb-4 pt-0 sm:px-2">
            <div className={cn(sectionClass, "space-y-4")}>
              <p className="text-sm text-muted-foreground dark:text-gray-400">
                Update your details, bio, photos, and travel preferences. Changes save from the forms below.
              </p>
              <ProfileForm profile={p} email={user.email ?? null} />
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* 2. Roles */}
        <AccordionItem value="roles" className="rounded-xl border border-border bg-card/40 dark:border-gray-800 dark:bg-gray-950/40">
          <AccordionTrigger className="min-h-[52px] px-2 py-3 text-left text-base font-semibold hover:no-underline sm:px-4 dark:text-gray-100">
            <span className="flex items-center gap-3">
              <Users className="h-5 w-5 shrink-0 text-muted-foreground dark:text-gray-400" />
              Roles &amp; switching
            </span>
          </AccordionTrigger>
          <AccordionContent className="px-0 pb-4 pt-0 sm:px-2">
            <div className={cn(sectionClass, "space-y-4")}>
              <SettingsRolesSection roles={roles} activeRole={activeRole} />
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* 3. Notifications & preferences */}
        <AccordionItem value="notifications" className="rounded-xl border border-border bg-card/40 dark:border-gray-800 dark:bg-gray-950/40">
          <AccordionTrigger className="min-h-[52px] px-2 py-3 text-left text-base font-semibold hover:no-underline sm:px-4 dark:text-gray-100">
            <span className="flex items-center gap-3">
              <Bell className="h-5 w-5 shrink-0 text-muted-foreground dark:text-gray-400" />
              Notifications &amp; preferences
            </span>
          </AccordionTrigger>
          <AccordionContent className="space-y-6 px-0 pb-4 pt-0 sm:px-2">
            <div className={sectionClass}>
              <SectionHeader icon={Bell} title="Notifications" />
              <SettingsNotificationsForm
                prefs={notificationPrefs}
                locked={emailPreferencesLocked}
                isCleaner={isCleaner}
                isLister={isLister}
              />
            </div>
            <div className={sectionClass}>
              <SectionHeader icon={Settings} title="App preferences" />
              <SettingsPreferencesForm
                themePreference={themePreference}
                distanceUnit={distanceUnitPref}
                roles={roles}
                activeRole={activeRole}
              />
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* 4. Payments */}
        {showPaymentsTab && (
          <AccordionItem value="payments" className="rounded-xl border border-border bg-card/40 dark:border-gray-800 dark:bg-gray-950/40">
            <AccordionTrigger className="min-h-[52px] px-2 py-3 text-left text-base font-semibold hover:no-underline sm:px-4 dark:text-gray-100">
              <span className="flex items-center gap-3">
                <CreditCard className="h-5 w-5 shrink-0 text-muted-foreground dark:text-gray-400" />
                Payments &amp; payouts
              </span>
            </AccordionTrigger>
            <AccordionContent className="px-0 pb-4 pt-0 sm:px-2">
              <div className={sectionClass}>
                {isListerActive && (
                  <>
                    <SectionHeader icon={CreditCard} title="Payment method" />
                    <p className="mb-4 text-sm text-muted-foreground dark:text-gray-400">
                      As a lister, save a card here to pay and start jobs in one click. Funds are held in escrow until you approve release.
                    </p>
                    <ConnectPaymentMethod
                      userId={user.id}
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
                      userId={user.id}
                      stripeConnectId={(p as { stripe_connect_id?: string | null })?.stripe_connect_id ?? null}
                      stripeOnboardingComplete={!!(p as { stripe_onboarding_complete?: boolean })?.stripe_onboarding_complete}
                      isCleaner={true}
                    />
                    <div className="mt-4 border-t border-border pt-4 dark:border-gray-700">
                      <PayoutScheduleForm
                        initial={
                          ((p as { preferred_payout_schedule?: string }).preferred_payout_schedule as
                            | "daily"
                            | "weekly"
                            | "monthly"
                            | "platform_default") ?? "platform_default"
                        }
                      />
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Button size="lg" className="min-h-[48px] rounded-full px-6" asChild>
                        <Link href="/earnings">Transaction history</Link>
                      </Button>
                    </div>
                  </>
                )}
                {!isListerActive && !isCleanerActive && showPaymentsTab && (
                  <p className="text-sm text-muted-foreground dark:text-gray-400">
                    Switch to Lister or Cleaner role in &quot;Roles &amp; switching&quot; to see payment or payout options.
                  </p>
                )}
              </div>
            </AccordionContent>
          </AccordionItem>
        )}

        {/* 5. Security */}
        <AccordionItem value="security" className="rounded-xl border border-border bg-card/40 dark:border-gray-800 dark:bg-gray-950/40">
          <AccordionTrigger className="min-h-[52px] px-2 py-3 text-left text-base font-semibold hover:no-underline sm:px-4 dark:text-gray-100">
            <span className="flex items-center gap-3">
              <Shield className="h-5 w-5 shrink-0 text-muted-foreground dark:text-gray-400" />
              Security
            </span>
          </AccordionTrigger>
          <AccordionContent className="px-0 pb-4 pt-0 sm:px-2">
            <div className={sectionClass}>
              <SectionHeader icon={Shield} title="Password &amp; session" />
              <p className="mb-4 text-sm text-muted-foreground dark:text-gray-400">
                Change your password below. Use your current password to confirm it&apos;s you. Logging out ends this session on this device.
              </p>
              <SettingsPasswordForm />
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* 6. Help & legal */}
        <AccordionItem value="help" className="rounded-xl border border-border bg-card/40 dark:border-gray-800 dark:bg-gray-950/40">
          <AccordionTrigger className="min-h-[52px] px-2 py-3 text-left text-base font-semibold hover:no-underline sm:px-4 dark:text-gray-100">
            <span className="flex items-center gap-3">
              <HelpCircle className="h-5 w-5 shrink-0 text-muted-foreground dark:text-gray-400" />
              Help &amp; legal
            </span>
          </AccordionTrigger>
          <AccordionContent className="space-y-6 px-0 pb-4 pt-0 sm:px-2">
            <div className={sectionClass} id="privacy-settings">
              <SectionHeader icon={Lock} title="Privacy &amp; data" />
              {isCleaner && <SettingsPrivacyForm profilePublic={profilePublic} />}
              <div
                className={cn(
                  "space-y-2",
                  isCleaner && "mt-4 border-t border-border pt-4 dark:border-gray-700"
                )}
              >
                <Button size="lg" variant="outline" className={cn("min-h-[48px] w-full sm:w-auto", settingsOutlineBtn)} asChild>
                  <Link href="/profile?export=1">Download my data</Link>
                </Button>
                <p className="text-xs text-muted-foreground dark:text-gray-500">
                  Stub: export of profile and job history (GDPR-style).
                </p>
                <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50/70 p-3 text-sm dark:border-amber-800/60 dark:bg-amber-900/20 dark:text-amber-100">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <div>
                    <p className="font-medium dark:text-amber-50">Delete my data</p>
                    <p className="text-xs text-muted-foreground dark:text-amber-200/90">
                      Permanently deleting your account and data cannot be undone. Contact support to request account deletion.
                    </p>
                    <Button size="lg" variant="destructive" className="mt-2 min-h-[48px] rounded-full" disabled>
                      Request account deletion
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            <div className={sectionClass} id="support">
              <SectionHeader icon={HelpCircle} title="Help &amp; support" />
              <ul className="space-y-1 text-sm dark:text-gray-200">
                <li>
                  <Link href="/help" className={settingsLinkClass}>
                    FAQ <ExternalLink className="h-3.5 w-3.5 shrink-0 opacity-80" />
                  </Link>
                </li>
                <li>
                  <Link href={`mailto:${supportContactEmail}`} className={settingsLinkClass}>
                    Contact support <ExternalLink className="h-3.5 w-3.5 shrink-0 opacity-80" />
                  </Link>
                </li>
                <li>
                  <Link href="/terms" className={settingsLinkClass}>
                    Terms of service <ExternalLink className="h-3.5 w-3.5 shrink-0 opacity-80" />
                  </Link>
                </li>
                <li>
                  <Link href="/privacy" className={settingsLinkClass}>
                    Privacy policy <ExternalLink className="h-3.5 w-3.5 shrink-0 opacity-80" />
                  </Link>
                </li>
              </ul>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      <div className="flex flex-col gap-3 border-t border-border pt-3 dark:border-gray-700 sm:flex-row sm:flex-wrap sm:items-center">
        <LogoutButton />
        <Button
          variant="destructive"
          size="lg"
          className="h-12 min-h-[48px] w-full rounded-full text-base md:h-10 md:min-h-0 md:w-auto md:text-sm"
          disabled
          title="Contact support to delete account"
        >
          Delete account
        </Button>
      </div>
    </div>
  );
}
