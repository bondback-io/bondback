# Stripe escrow, release & payout (Bond Back)

## Summary

1. **Pay & Start Job** — Server action `createJobCheckoutSession` builds Stripe Checkout with `payment_intent_data.capture_method = "manual"` (see `lib/stripe.ts`). The lister is charged **job price + platform fee %**; funds stay on the platform balance as an **uncaptured** PaymentIntent (escrow hold).
2. **Checkout return** — Client calls `fulfillJobPaymentFromSession(session_id)`; webhook `checkout.session.completed` also sets `payment_intent_id` and `status: in_progress` if the browser never returns (`app/api/stripe/webhook/route.ts`).
3. **Cleaner completes** — `markJobChecklistFinished` sets `completed_pending_approval`, `auto_release_at` / `auto_release_at_original` to **now + `global_settings.auto_release_hours`** (default 48).
4. **Lister approves** — `finalizeJobPayment` → `releaseJobFunds`: **capture** PI, **`transfers.create`** to the winner’s Connect account id stored as **`profiles.stripe_connect_id`** (same as Stripe’s connected account id / `acct_*`). Transfer amount = **agreed job price** (platform fee was already included in the lister’s total charge).
5. **Auto-release** — `processAutoRelease` / `runAutoReleaseCheck` (cron: `GET|POST /api/cron/auto-release`) uses the **Supabase service role** client so RLS does not block unauthenticated cron. It selects due jobs, calls `releaseJobFunds(jobId, { supabase: admin })`, completes the job, sends notifications and receipt emails.

## Code map

| Concern | Location |
|--------|----------|
| Manual capture Checkout / PI | `lib/stripe.ts` — `createJobCheckoutSessionUrl`, `createJobPaymentIntentWithSavedMethod` |
| Pay & fulfill actions | `lib/actions/jobs.ts` — `createJobCheckoutSession`, `fulfillJobPaymentFromSession` |
| Capture + Connect transfer | `lib/actions/jobs.ts` — `releaseJobFunds` (aliases: `captureAndRelease`, `captureAndTransfer`) |
| Lister release | `lib/actions/jobs.ts` — `finalizeJobPayment` |
| Timer baseline | `lib/actions/jobs.ts` — `markJobChecklistFinished` (`auto_release_at`) |
| Cron | `app/api/cron/auto-release/route.ts` → `processAutoRelease` |
| Fee breakdown UI | `components/features/job-payment-breakdown.tsx`, used in `job-detail.tsx` |

## Environment

- `SUPABASE_SERVICE_ROLE_KEY` — required for reliable cron auto-release DB access.
- `CRON_SECRET` — optional; when set, cron requests must send the secret.
- Stripe Connect: cleaners onboard to Express/Standard; **`stripe_connect_id`** on `profiles` is the Connect **account** id used as `destination` on transfers.
