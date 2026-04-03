"use server";

import type Stripe from "stripe";
import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getEffectivePayoutSchedule, type PayoutScheduleInterval } from "@/lib/payout-schedule";
import { getStripeServer } from "@/lib/stripe";
import { getAppBaseUrl } from "@/lib/site";

/**
 * Ensure a Connect account can receive Transfers from the platform balance (separate charge + transfer flow).
 * Requests `transfers` if missing (legacy accounts), and returns a clear error if still pending or blocked.
 */
export async function ensureConnectAccountCanReceiveTransfers(
  stripe: Stripe,
  connectAccountId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  let account = await stripe.accounts.retrieve(connectAccountId);
  let transfers = account.capabilities?.transfers;

  if (transfers === "active") {
    return { ok: true };
  }

  if (transfers === "pending") {
    return {
      ok: false,
      error:
        "The cleaner's payout account is still being verified by Stripe. They should open Settings → Payouts and complete any remaining steps, then try again after verification finishes (often within a few minutes).",
    };
  }

  // `inactive` usually means capability was never requested; request it for older accounts.
  try {
    await stripe.accounts.update(connectAccountId, {
      capabilities: {
        transfers: { requested: true },
      },
    });
    account = await stripe.accounts.retrieve(connectAccountId);
    transfers = account.capabilities?.transfers;
  } catch (e) {
    const err = e as Error;
    return {
      ok: false,
      error: `Could not enable transfers on the cleaner's payout account: ${err.message ?? "Unknown error"}`,
    };
  }

  if (transfers === "active") {
    return { ok: true };
  }

  if (transfers === "pending") {
    return {
      ok: false,
      error:
        "Transfers were just requested on the cleaner's Stripe account. Wait a few minutes for Stripe to finish verification, then try releasing funds again.",
    };
  }

  return {
    ok: false,
    error:
      "The cleaner's Stripe account cannot receive payouts yet. They must complete Connect onboarding (Profile / Settings → Payouts). If they already did, they should reopen the Stripe link and finish any missing identity or bank details.",
  };
}

/**
 * Set payout schedule on a Stripe Connect Express account.
 * Uses Accounts API v1 settings.payouts.schedule (interval, weekly_anchor, monthly_anchor).
 */
export async function applyPayoutScheduleToStripeAccount(
  connectAccountId: string,
  interval: PayoutScheduleInterval
): Promise<{ ok: true } | { ok: false; error: string }> {
  let stripe;
  try {
    stripe = await getStripeServer();
  } catch {
    return { ok: false, error: "Stripe is not configured." };
  }
  try {
    const schedule: Stripe.AccountUpdateParams.Settings.Payouts.Schedule = {
      interval,
      ...(interval === "weekly" && { weekly_anchor: "monday" }),
      ...(interval === "monthly" && { monthly_anchor: 1 }),
    };
    await stripe.accounts.update(connectAccountId, {
      settings: {
        payouts: {
          schedule,
        },
      },
    });
    return { ok: true };
  } catch (e) {
    const err = e as Error;
    console.error("[applyPayoutScheduleToStripeAccount]", err);
    return { ok: false, error: err.message ?? "Failed to update payout schedule." };
  }
}

export type CreateConnectAccountResult =
  | { ok: true; onboardingUrl: string }
  | { ok: false; error: string };

export type CreateConnectAccountOptions = {
  /** Return URLs include ?popup=1 so /stripe/connect/success can postMessage to opener and close. */
  popupReturn?: boolean;
};

/**
 * Create or reuse a Stripe Connect Express account for the user and return the onboarding link.
 * Caller must be the user (cleaner). Stores stripe_connect_id in profiles via admin client.
 */
export async function createConnectAccount(
  userId: string,
  options?: CreateConnectAccountOptions
): Promise<CreateConnectAccountResult> {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session || session.user.id !== userId) {
      return { ok: false, error: "You must be logged in." };
    }

    let stripe;
    try {
      stripe = await getStripeServer();
    } catch {
      return { ok: false, error: "Stripe is not configured." };
    }

    // Use session-scoped client to read profile. Try full columns first; fallback to minimal if roles/active_role missing.
    type ConnectProfileRow = {
      id: string;
      stripe_connect_id?: string | null;
      roles?: string[] | string | null;
      active_role?: string | null;
    };
    let profile: ConnectProfileRow | null = null;
    let profileError: { code?: string; message?: string } | null = null;

    const fullRes = await supabase
      .from("profiles")
      .select("id, stripe_connect_id, full_name, roles, active_role")
      .eq("id", userId)
      .maybeSingle();

    if (fullRes.error) {
      profileError = fullRes.error;
      const minimalRes = await supabase
        .from("profiles")
        .select("id, stripe_connect_id")
        .eq("id", userId)
        .maybeSingle();
      if (minimalRes.error) {
        console.error("[createConnectAccount] profile fetch", fullRes.error.code, fullRes.error.message);
        return {
          ok: false,
          error: `Could not load your profile. ${fullRes.error.message ?? fullRes.error.code ?? "Unknown error"}. Check that you are logged in and the profiles table exists.`,
        };
      }
      profile = minimalRes.data as ConnectProfileRow | null;
      if (profile) {
        profile.roles = ["cleaner"];
        profile.active_role = "cleaner";
      }
    } else {
      profile = fullRes.data as ConnectProfileRow | null;
    }

    if (!profile) {
      return { ok: false, error: "No profile found for your account. Please complete your profile first." };
    }

    const profileRow = profile;

    let roles: string[] = [];
    if (profileRow?.roles != null) {
      if (Array.isArray(profileRow.roles)) {
        roles = profileRow.roles.filter((r) => r === "lister" || r === "cleaner");
      } else if (typeof profileRow.roles === "string") {
        try {
          const parsed = JSON.parse(profileRow.roles) as unknown;
          roles = Array.isArray(parsed)
            ? (parsed as string[]).filter((r) => r === "lister" || r === "cleaner")
            : [];
        } catch {
          const pgArray = profileRow.roles.replace(/^\{|\}$/g, "").split(",").map((s) => s.trim().replace(/^"|"$/g, ""));
          roles = pgArray.filter((r) => r === "lister" || r === "cleaner");
        }
      }
    }
    const activeRole = profileRow?.active_role === "lister" || profileRow?.active_role === "cleaner"
      ? profileRow.active_role
      : roles[0] ?? null;
    const canConnectPayouts = roles.includes("cleaner") || activeRole === "cleaner";
    if (!canConnectPayouts) {
      return { ok: false, error: "Only cleaners can connect a bank account for payouts. Switch to the Cleaner role in Settings if you have it." };
    }

    const appUrl = getAppBaseUrl();
    const popup = options?.popupReturn === true;
    const returnUrl = popup
      ? `${appUrl}/stripe/connect/success?popup=1`
      : `${appUrl}/stripe/connect/success`;
    const refreshUrl = popup
      ? `${appUrl}/stripe/connect/success?popup=1&refresh=1`
      : `${appUrl}/stripe/connect/success?refresh=1`;

    let accountId = (profileRow?.stripe_connect_id ?? "").trim() || null;

    if (accountId) {
      try {
        await stripe.accounts.retrieve(accountId);
        const link = await stripe.accountLinks.create({
          account: accountId,
          return_url: returnUrl,
          refresh_url: refreshUrl,
          type: "account_onboarding",
        });
        return { ok: true, onboardingUrl: link.url };
      } catch (e) {
        const err = e as Error;
        if (err.message?.includes("No such account")) {
          accountId = null;
        } else {
          console.error("[createConnectAccount] retrieve/link", err);
          return { ok: false, error: err.message ?? "Failed to create onboarding link." };
        }
      }
    }

    if (!accountId) {
      const admin = createSupabaseAdminClient();
      if (!admin) {
        return { ok: false, error: "Server configuration error. Add SUPABASE_SERVICE_ROLE_KEY and NEXT_PUBLIC_SUPABASE_URL." };
      }
      try {
        const account = await stripe.accounts.create({
          type: "express",
          country: "AU",
          email: session.user.email ?? undefined,
          capabilities: {
            transfers: { requested: true },
          },
        });
        accountId = account.id;

        const { error: updateError } = await admin
          .from("profiles")
          .update({
            stripe_connect_id: accountId,
            updated_at: new Date().toISOString(),
          } as never)
          .eq("id", userId);

        if (updateError) {
          console.error("[createConnectAccount] profile update", updateError);
          return { ok: false, error: updateError.message };
        }

        try {
          const effective = await getEffectivePayoutScheduleForUser(admin, userId);
          await applyPayoutScheduleToStripeAccount(accountId, effective);
        } catch (scheduleErr) {
          console.warn("[createConnectAccount] payout schedule (non-fatal)", scheduleErr);
        }
      } catch (e) {
        const err = e as Error;
        console.error("[createConnectAccount] create account", err);
        return { ok: false, error: err.message ?? "Failed to create Stripe account." };
      }
    }

    const link = await stripe.accountLinks.create({
      account: accountId!,
      return_url: returnUrl,
      refresh_url: refreshUrl,
      type: "account_onboarding",
    });
    return { ok: true, onboardingUrl: link.url };
  } catch (e) {
    const err = e as Error;
    console.error("[createConnectAccount] unexpected", err);
    return { ok: false, error: err?.message ?? "Something went wrong. Please try again." };
  }
}

/** Alias for createConnectAccount (Stripe Connect Express onboarding). */
export const createStripeConnectAccount = createConnectAccount;

export type DisconnectStripeConnectResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Clear Connect payout linkage so the cleaner can connect a different Stripe account.
 * Attempts to delete the Connect account in Stripe (best-effort); always clears profile fields.
 */
export async function disconnectStripeConnect(): Promise<DisconnectStripeConnectResult> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.user?.id) {
    return { ok: false, error: "You must be logged in." };
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return { ok: false, error: "Server configuration error." };
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("stripe_connect_id, roles")
    .eq("id", session.user.id)
    .maybeSingle();

  const row = profile as { stripe_connect_id?: string | null; roles?: unknown } | null;
  const roles = Array.isArray(row?.roles)
    ? (row!.roles as string[]).filter((r) => r === "lister" || r === "cleaner")
    : [];
  if (!roles.includes("cleaner")) {
    return { ok: false, error: "Only cleaners can disconnect payout settings." };
  }

  const connectId = row?.stripe_connect_id?.trim();
  if (connectId) {
    try {
      const stripe = await getStripeServer();
      await stripe.accounts.del(connectId);
    } catch (e) {
      console.warn("[disconnectStripeConnect] Stripe accounts.del (non-fatal)", e);
    }
  }

  const { error } = await admin
    .from("profiles")
    .update({
      stripe_connect_id: null,
      stripe_onboarding_complete: false,
      updated_at: new Date().toISOString(),
    } as never)
    .eq("id", session.user.id);

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath("/profile");
  revalidatePath("/settings");
  revalidatePath("/earnings");
  return { ok: true };
}

export type HandleConnectSuccessResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Call after Stripe redirects to /stripe/connect/success. Sets stripe_onboarding_complete = true
 * for the current user (cleaner). Optionally verifies account.details_submitted via Stripe API.
 */
export async function handleConnectSuccess(
  userId: string
): Promise<HandleConnectSuccessResult> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session || session.user.id !== userId) {
    return { ok: false, error: "You must be logged in." };
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return { ok: false, error: "Server configuration error." };
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("id, stripe_connect_id, roles")
    .eq("id", userId)
    .maybeSingle();

  const row = profile as { stripe_connect_id?: string | null; roles?: string[] | null } | null;
  if (!row?.stripe_connect_id?.trim()) {
    return { ok: true }; // no Connect account; nothing to update
  }

  // Stripe redirects to return_url only when onboarding is complete, so we mark complete when they hit this page
  const { error } = await admin
    .from("profiles")
    .update({
      stripe_onboarding_complete: true,
      updated_at: new Date().toISOString(),
    } as never)
    .eq("id", userId);

  if (error) {
    return { ok: false, error: error.message };
  }

  try {
    const effective = await getEffectivePayoutScheduleForUser(admin, userId);
    await applyPayoutScheduleToStripeAccount(row.stripe_connect_id, effective);
  } catch (scheduleErr) {
    console.warn("[handleConnectSuccess] payout schedule (non-fatal)", scheduleErr);
  }

  return { ok: true };
}

/** Instant payout fee: 1% of amount, minimum $1 AUD (100 cents). */
const INSTANT_PAYOUT_FEE_PERCENT = 1;
const INSTANT_PAYOUT_FEE_MIN_CENTS_AUD = 100;

export type GetConnectBalanceResult =
  | { ok: true; availableCents: number; currency: string }
  | { ok: false; error: string };

/**
 * Get available balance for the cleaner's Stripe Connect account (for instant payout UI).
 * Caller must be the authenticated cleaner (userId matches session).
 */
export async function getConnectBalance(
  userId: string
): Promise<GetConnectBalanceResult> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session || session.user.id !== userId) {
    return { ok: false, error: "You must be logged in." };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, stripe_connect_id, roles")
    .eq("id", userId)
    .maybeSingle();

  const p = profile as { stripe_connect_id?: string | null; roles?: string[] | null } | null;
  if (!p?.stripe_connect_id?.trim()) {
    return { ok: false, error: "Connect your Stripe account first." };
  }
  const roles = (p?.roles ?? []) as string[];
  if (!roles.includes("cleaner")) {
    return { ok: false, error: "Only cleaners can withdraw." };
  }

  let stripe;
  try {
    stripe = await getStripeServer();
  } catch {
    return { ok: false, error: "Stripe is not configured." };
  }

  try {
    const balance = await stripe.balance.retrieve(
      {},
      { stripeAccount: p.stripe_connect_id.trim() }
    );
    const available = balance.available ?? [];
    const aud = available.find((b: { currency: string }) => b.currency === "aud");
    const amount = aud?.amount ?? 0;
    return {
      ok: true,
      availableCents: amount,
      currency: aud?.currency ?? "aud",
    };
  } catch (e) {
    const err = e as Error;
    return { ok: false, error: err.message ?? "Failed to load balance." };
  }
}

export type CreateInstantPayoutResult =
  | { ok: true; payoutId?: string }
  | { ok: false; error: string };

/**
 * Create an instant payout for the cleaner's Connect account. Cleaner pays Stripe's fee (1% min $1 AUD).
 * Caller must be the authenticated cleaner.
 */
export async function createInstantPayout(
  userId: string
): Promise<CreateInstantPayoutResult> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session || session.user.id !== userId) {
    return { ok: false, error: "You must be logged in." };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, stripe_connect_id, roles")
    .eq("id", userId)
    .maybeSingle();

  const p = profile as { stripe_connect_id?: string | null; roles?: string[] | null } | null;
  if (!p?.stripe_connect_id?.trim()) {
    return { ok: false, error: "Connect your Stripe account first." };
  }
  const roles = (p?.roles ?? []) as string[];
  if (!roles.includes("cleaner")) {
    return { ok: false, error: "Only cleaners can request instant payout." };
  }

  let stripe;
  try {
    stripe = await getStripeServer();
  } catch {
    return { ok: false, error: "Stripe is not configured." };
  }

  const connectId = p.stripe_connect_id.trim();

  try {
    const balance = await stripe.balance.retrieve(
      {},
      { stripeAccount: connectId }
    );
    const available = balance.available ?? [];
    const aud = available.find((b: { currency: string }) => b.currency === "aud");
    const amountCents = aud?.amount ?? 0;
    if (amountCents < INSTANT_PAYOUT_FEE_MIN_CENTS_AUD) {
      return {
        ok: false,
        error: `Available balance is too low for instant payout (minimum after fee is $1 AUD).`,
      };
    }

    const payout = await stripe.payouts.create(
      {
        amount: amountCents,
        currency: "aud",
        method: "instant",
      },
      { stripeAccount: connectId }
    );

    return { ok: true, payoutId: payout.id };
  } catch (e) {
    const err = e as Error;
    return { ok: false, error: err.message ?? "Instant payout failed." };
  }
}

/** Resolve effective payout interval for a user from profile + global_settings. */
async function getEffectivePayoutScheduleForUser(
  admin: NonNullable<ReturnType<typeof createSupabaseAdminClient>>,
  userId: string
): Promise<PayoutScheduleInterval> {
  try {
    const [profileRes, globalRes] = await Promise.all([
      admin.from("profiles").select("preferred_payout_schedule").eq("id", userId).maybeSingle(),
      admin.from("global_settings").select("payout_schedule").eq("id", 1).maybeSingle(),
    ]);
    const preferred = (profileRes.data as { preferred_payout_schedule?: string | null } | null)?.preferred_payout_schedule ?? "platform_default";
    const platformDefault = (globalRes.data as { payout_schedule?: string | null } | null)?.payout_schedule ?? "weekly";
    return getEffectivePayoutSchedule(
      preferred as "daily" | "weekly" | "monthly" | "platform_default",
      platformDefault as PayoutScheduleInterval
    );
  } catch {
    return "weekly";
  }
}
