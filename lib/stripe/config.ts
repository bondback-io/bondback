import { getGlobalSettings } from "@/lib/actions/global-settings";

export type StripeMode = "test" | "live";

export type StripeConfig = {
  mode: StripeMode;
  publishableKey: string;
  secretKey: string;
};

let cachedConfig: StripeConfig | null = null;

/** Call after saving global_settings (e.g. toggling Stripe test mode) so the next request uses the new mode. */
export function clearStripeConfigCache(): void {
  cachedConfig = null;
}

export async function getStripeConfig(): Promise<StripeConfig> {
  if (cachedConfig) return cachedConfig;

  const settings = await getGlobalSettings();
  const stripeTestMode = settings?.stripe_test_mode !== false; // default to test
  const mode: StripeMode = stripeTestMode ? "test" : "live";

  const publishableKey = stripeTestMode
    ? process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY_TEST
    : process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY_LIVE;

  const secretKey = stripeTestMode
    ? process.env.STRIPE_SECRET_KEY_TEST
    : process.env.STRIPE_SECRET_KEY_LIVE;

  if (!publishableKey || !secretKey) {
    throw new Error(
      `[Stripe] Missing ${mode.toUpperCase()} keys. Check STRIPE_SECRET_KEY_${mode.toUpperCase()} and NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY_${mode.toUpperCase()}.`
    );
  }

  cachedConfig = { mode, publishableKey, secretKey };

  if (process.env.NODE_ENV !== "production") {
     
    console.log("[Stripe] Mode:", stripeTestMode ? "TEST" : "LIVE");
  }

  return cachedConfig;
}

/**
 * Get Stripe config for a specific mode from env only (no global_settings).
 * Used by webhook handler to match the event's livemode.
 */
export function getStripeConfigForMode(mode: StripeMode): StripeConfig {
  const publishableKey =
    mode === "test"
      ? process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY_TEST
      : process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY_LIVE;
  const secretKey =
    mode === "test" ? process.env.STRIPE_SECRET_KEY_TEST : process.env.STRIPE_SECRET_KEY_LIVE;
  if (!secretKey) {
    throw new Error(
      `[Stripe] Missing ${mode.toUpperCase()} secret. Set STRIPE_SECRET_KEY_${mode === "test" ? "TEST" : "LIVE"}.`
    );
  }
  return {
    mode,
    publishableKey: publishableKey ?? "",
    secretKey,
  };
}

/** Whether the platform is using Stripe test keys (from Admin > Global Settings toggle). */
export async function isStripeTestMode(): Promise<boolean> {
  const config = await getStripeConfig();
  return config.mode === "test";
}

