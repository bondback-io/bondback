# Referral auto-credit

## Summary

- **`profiles.referred_by`** — UUID of the referrer’s profile, set at signup when a valid **`profiles.referral_code`** is supplied (via `/onboarding/role-choice?ref=CODE` or `/onboarding/signup?ref=CODE`, stored in `localStorage` until signup).
- **`profiles.referral_code`** — Unique 8-character code; generated when the user visits **`/profile`** while **`global_settings.referral_enabled`** is true (`ensureReferralCodeForUser`).
- **`profiles.account_credit_cents`** — Balance in cents (AUD); incremented when rewards apply.
- **`referral_rewards`** — One row per job, idempotent on **`job_id`**, audit trail for credits granted.

## Award logic (`applyReferralRewardsForCompletedJob`)

Runs after a job is **completed** with **payment released** (Stripe capture + transfer path), from:

- `finalizeJobPayment`
- `processAutoRelease` / cron
- `admin` force release
- `acceptResolution` (mutual dispute resolution after `releaseJobFunds`)

Checks:

1. `referral_enabled` and amounts / limits from **`global_settings`** (`referral_referrer_amount`, `referral_referred_amount`, `referral_min_job_amount`, `referral_max_per_user_month`).
2. Job: `status === 'completed'`, `payment_released_at` set, **`winner_id`** present (cleaner = referred user for this product).
3. Cleaner has **`referred_by`** set; not self-referral.
4. **`agreed_amount_cents` ≥ min job** (settings in dollars → cents).
5. **First completed job** for that cleaner: count of jobs with `winner_id`, `status = completed`, `payment_released_at` not null **equals 1**.
6. Referrer **monthly cap**: count of `referral_rewards` for `referrer_id` in the current UTC month \< max (if max \> 0).

Then: insert **`referral_rewards`**, increment **`account_credit_cents`** for referred user and referrer, **in-app notifications** (`type: referral_reward`), **email** via Resend (respects `payment_released` email preference mapping).

## Profile UI

`ProfileReferralSection` on **`/profile`** when `referral_enabled`: shows **account credit**, **code**, **share link** (`…/onboarding/role-choice?ref=CODE`), and optional **`referral_terms_text`**.

## Notifications

- Type **`referral_reward`** added to `NotificationType` and email preference mapping (same bucket as **`payment_released`**).
