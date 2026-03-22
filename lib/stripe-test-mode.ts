/**
 * Stripe test mode: re-exports from config (driven by Admin > Global Settings toggle).
 * Use await isStripeTestMode() in server code. Client receives isStripeTestMode from the page.
 */
export { isStripeTestMode } from "@/lib/stripe/config";
