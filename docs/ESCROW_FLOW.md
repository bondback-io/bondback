# Stripe Connect escrow + payout flow

Platform holds funds in escrow and releases to the cleaner on lister approval (minus 12% Service Fee). Uses Stripe Connect Express (hosted dashboard) for cleaner payouts.

---

## Summary

1. **Lister** clicks **Pay & Start Job** → Stripe Checkout → PaymentIntent created with `capture_method: "manual"` (funds held, not captured).
2. Funds remain in escrow on the platform.
3. **Cleaner** completes the job (checklist + after-photos, marks complete).
4. **Lister** clicks **Approve & Release Funds** → backend captures the PaymentIntent and transfers the job amount to the cleaner’s Stripe Connect account (platform keeps the fee).
5. **Stripe Connect Express**: cleaners onboard via hosted Connect; payouts use Transfers to connected accounts.
6. **Fee breakdown** on the job payment section: *Job: $X | Fee: $Y | Total: $Z* (with 12% fee from global settings).
7. **Test mode**: when Admin > Global Settings has Stripe test mode on, a dismissible banner is shown and test keys are used.

---

## Flow diagram (text)

```
[Lister] Accept bid / Secure at price
    → Job created (status: accepted)

[Lister] Clicks "Pay & Start Job"
    → createPaymentIntent(jobId) / createJobCheckoutSession(jobId)
    → Redirect to Stripe Checkout (line items: Job + Service Fee, total = job + 12%)
    → PaymentIntent created with capture_method=manual (authorized only)

[Stripe] Customer completes payment
    → checkout.session.completed webhook
    → Job: payment_intent_id set, status → in_progress

[Cleaner] Completes checklist + after-photos, marks "Job complete"

[Lister] Clicks "Approve & Release Funds"
    → finalizeJobPayment(jobId) → captureAndTransfer(jobId) / releaseJobFunds(jobId)
    → Stripe: PaymentIntent.capture
    → Stripe: Transfer to cleaner's Connect account (amount = agreed_amount_cents)
    → Job: payment_released_at set, status → completed
```

---

## Button labels

| Context | Label |
|--------|--------|
| Lister, job accepted, no payment yet | **Pay & Start Job** |
| Lister, payment held, not started | **Start Job** (optional if webhook already set in_progress) |
| Lister, job in progress, can release | **Approve & Release Funds** |
| Loading states | "Redirecting to payment…", "Releasing…", "Starting…" |

---

## Server actions

| Action | File | Purpose |
|--------|------|--------|
| **createPaymentIntent** | `lib/actions/jobs.ts` | Alias for `createJobCheckoutSession`. Returns Stripe Checkout URL for Pay & Start Job (PaymentIntent with manual capture). |
| **createJobCheckoutSession** | `lib/actions/jobs.ts` | Same as above; creates checkout URL (job + fee line items). |
| **captureAndTransfer** | `lib/actions/jobs.ts` | Alias for `releaseJobFunds`. Captures PaymentIntent and transfers to cleaner’s Connect account. |
| **releaseJobFunds** | `lib/actions/jobs.ts` | Capture PI + create Transfer to `winner_id`’s `stripe_connect_id`. |
| **finalizeJobPayment** | `lib/actions/jobs.ts` | Called from UI. Checks lister, cleaner_confirmed_complete, then calls `releaseJobFunds` and sets job status to completed. |

Stripe helpers:

- **createJobCheckoutSessionUrl** – `lib/stripe.ts`: builds Checkout Session with `payment_intent_data: { capture_method: "manual" }`, job + fee line items.

---

## Webhook: `checkout.session.completed`

**Route:** `app/api/stripe/webhook/route.ts`  
**Event:** `checkout.session.completed`

**Stub (job payment path):**

- Read `session.metadata.job_id`.
- Retrieve session with `expand: ["payment_intent"]` if needed.
- Get `payment_intent.id` from the session.
- If `metadata.job_id` present:
  - Update `jobs`: set `payment_intent_id = payment_intent.id`, `status = 'in_progress'`, `updated_at = now`.
- Return `NextResponse.json({ received: true })`.

**Current implementation:** The handler already does this: for `mode === "payment"` and `metadata.job_id`, it updates the job with `payment_intent_id` and `status: "in_progress"` (see `app/api/stripe/webhook/route.ts` around the `checkout.session.completed` case).

---

## Pages and settings

- **`/jobs/[id]`** – Job detail: Pay & Start Job, Start Job, Approve & Release Funds, payment breakdown (Job | Fee | Total), test-mode hint when enabled.
- **Settings > Payments** – Role-specific:
  - **Lister**: Connect payment method (card for Pay & Start Job).
  - **Cleaner**: Connect Stripe account (Express), payout schedule, link to Transaction history.

Test mode banner is rendered in the root layout when `stripe_test_mode` is true in global settings.
