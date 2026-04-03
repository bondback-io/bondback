# Bond Back – Email flow setup and configuration

This guide covers configuring the full email flow (Resend), env vars, global toggle, and how to test from signup through listings and bids.

---

## 1. Overview

- **Provider:** [Resend](https://resend.com) (API key + optional custom domain).
- **Templates:** React Email components in `emails/` (Welcome, TutorialLister, TutorialCleaner, NewBid, NewMessage, JobCreated, …).
- **Flow:** In-app notifications are written to `notifications`; for each notification we optionally send an email based on user preferences and global settings.

### When emails are sent

| Event | Recipient | Email type | Notes |
|-------|-----------|------------|--------|
| **Sign up complete** | New user | Welcome (React Email) | “Welcome to Bond Back – Let's Get Started!”; respects `email_welcome` preference |
| **24h after signup** | New user | Tutorial (React Email) | “Your Quick Start Guide as a [Lister/Cleaner]”; triggered by cron; respects `email_tutorial` |
| **New bid on listing** | Lister | `new_bid` | Link to listing; respects “New bid on my listing” preference |
| **New message in job** | Other party | `new_message` | Skipped if recipient viewed job in last 5 min; rate limit 1/job/hour |
| **Job created (cleaner accepted)** | Lister + Cleaner | `job_created` | “Your job has been accepted” |
| **Lister approves job** | Cleaner | `job_accepted` | “Time to clean!” |
| **Cleaner marks complete** | Lister | `job_completed` | “Review & approve” |
| **Payment released** | Lister + Cleaner | `payment_released` | Amount in subject when available |
| **Funds ready to release** | Lister | `funds_ready` | Ready to release funds |
| **Dispute opened** | Other party | `dispute_opened` | Critical |
| **Dispute resolved** | Both | `dispute_resolved` | Critical |

User preferences (Settings → Notifications) and Admin “Allow all email notifications” (Global settings) control whether each user gets emails. Critical types (dispute, payment_released) are on by default. When the global switch is **off**, no transactional emails are sent (emergency "disable all emails").

### Transactional events → preference keys

| Event | Recipient | Notification type | Preference key (Settings) |
|-------|-----------|-------------------|----------------------------|
| New bid on listing | Lister | `new_bid` | New bid on my listing |
| New message in job chat | Other party | `new_message` | New message in a job |
| Job accepted / approved to start | Cleaner (+ lister for job_created) | `job_accepted` / `job_created` | Job accepted / approved to start |
| Job marked complete | Lister | `job_completed` | Job marked complete (ready for review) |
| Dispute opened / updated / resolved | Both | `dispute_opened` / `dispute_resolved` | Dispute opened / updated / resolved |
| Payment released | Cleaner (+ lister when relevant) | `payment_released` | Payment released / payout received |

Emails are sent only if: (1) Admin "Allow all email notifications" is on, (2) user's preference for that type is not false (defaults true), (3) user does not have `email_force_disabled`.

---

## 2. Environment variables

Add to `.env.local` (and production env):

```bash
# Resend (required for sending)
RESEND_API_KEY=re_xxxxxxxxxxxx
# From — production (verify bondback.io in Resend):
RESEND_FROM=Bond Back <noreply@bondback.io>

# Base URL for links in emails (optional; default https://www.bondback.io)
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Optional: secret for cron endpoint (tutorial emails 24h after signup)
CRON_SECRET=your-secret-here
```

- **RESEND_API_KEY:** From [Resend Dashboard](https://resend.com/api-keys). Without it, `sendEmail` no-ops (no error; emails simply don’t send).
- **RESEND_FROM:** Production uses `Bond Back <noreply@bondback.io>` after verifying `bondback.io` in Resend. For local dev without a verified domain, use `Bond Back <onboarding@resend.dev>`.
- **NEXT_PUBLIC_APP_URL:** Used in email links (e.g. “View listing”, “View Job”). Use your real app URL in production.

---

## 3. Resend setup

1. **Sign up:** [resend.com](https://resend.com).
2. **API key:** Create an API key in the dashboard and set `RESEND_API_KEY` in `.env.local`.
3. **Domain:** Verify **`bondback.io`** in Resend to send from `noreply@bondback.io`. Until then, use the Resend sandbox sender in `.env.local` (e.g. `Bond Back <onboarding@resend.dev>`).
4. **Testing:** Resend free tier is fine for development; use a real inbox for signup so you receive the welcome and notification emails.

---

## 3b. Supabase “Confirm email” link (signup) + Resend for local testing

The **“Confirm your email”** message new users get is sent by **Supabase Auth**, not by your app. The link in that email is built by Supabase. To have that email sent **via Resend** and to have the link work when testing locally:

### A. Resend SMTP in Supabase (optional but recommended)

So the confirmation email is delivered through Resend (better deliverability, same API key you already use):

1. In [Supabase Dashboard](https://supabase.com/dashboard) → your project → **Authentication** → **SMTP Settings** (or **Email** under Providers).
2. Enable **Custom SMTP** and use Resend’s SMTP:
   - **Host:** `smtp.resend.com`
   - **Port:** `465`
   - **Username:** `resend`
   - **Password:** your Resend API key (same as `RESEND_API_KEY` in `.env.local`)
3. Set **Sender email** and **Sender name** (e.g. `Bond Back <noreply@bondback.io>` once `bondback.io` is verified in Resend).
4. Save.

### B. Redirect URL for local testing

So the “Confirm your email” link sends users back to your app on localhost:

1. In Supabase Dashboard → **Authentication** → **URL Configuration**:
   - **Site URL:** set to `http://localhost:3000` when testing locally (use your production URL in production).
   - **Redirect URLs:** add `http://localhost:3000/**` so Supabase allows redirects to your local app.
2. The app already passes `emailRedirectTo: ${window.location.origin}/auth/callback` on signup, so the confirmation link will redirect to your app (e.g. `http://localhost:3000/auth/callback`) after the user confirms.

### C. “Email rate limit exceeded” when signing up

Supabase Auth limits how many **auth emails** (signup confirmation, password reset, etc.) can be sent per hour. With the **built-in** Supabase mailer the default is **4 per hour**. If you hit this, signup returns “Email rate limit exceeded” (or `over_email_send_rate_limit`).

- **Use Custom SMTP (Resend):** Once you configure Supabase to use Resend SMTP (see A above), you get Resend’s higher limits and can often raise the auth email limit in Supabase (Dashboard → Authentication → Rate Limits / SMTP, if available for your plan).
- **Short-term:** Wait about an hour, or try signing up with a different email. The app now shows a friendly message when this limit is hit.
- **Local testing only:** In Supabase Dashboard → Authentication → Providers → Email, you can temporarily disable “Confirm email” so signups don’t send a confirmation email and you don’t hit the limit (users are signed in immediately). Re-enable it for production.

### D. Quick local-test checklist

- [ ] `RESEND_API_KEY` in `.env.local` (you already use this for app emails).
- [ ] Supabase → Authentication → URL Configuration: **Site URL** = `http://localhost:3000`, **Redirect URLs** includes `http://localhost:3000/**`.
- [ ] (Optional) Supabase → Authentication → SMTP: Custom SMTP with Resend credentials so the confirm email is sent via Resend and rate limits are more generous.
- [ ] Sign up a new user → open the confirmation email → click the link → you should land on `http://localhost:3000/auth/callback` and then be redirected into the app.

---

## 4. Global toggle (Admin)

- **Admin → Global settings → “Allow all email notifications”**
- When this is **off**, no notification emails are sent and no welcome email is sent after signup. In-app notifications are still created.
- When **on**, emails are sent according to each user’s notification preferences and Resend config.

---

## 5. Database (for full flow)

Email flow uses:

- **profiles:** `notification_preferences` (jsonb), `email_force_disabled`, `email_preferences_locked`  
  → Migration: `supabase/migrations/20250308000000_notification_preferences_and_email_logs.sql`
- **notifications:** In-app notification rows (inserted before we decide to send email)  
  → Standard Supabase schema.
- **email_logs:** Optional; logs sent emails for admin (same migration as above).
- **notification_email_rate_limit:** 1 email per job per hour (for job-related notifications).  
  → `docs/EMAIL_CHAT_DISPUTE_MIGRATION.sql` (run in Supabase SQL editor if not already applied).
- **last_job_view:** Used to skip “new message” email when recipient is currently viewing the job.  
  → Same migration file; ensure RLS and triggers/updates are in place if you use that feature.

Run the migrations (or apply the SQL from the docs) so these tables/columns exist.

---

## 6. Testing the full flow

### 6.1 Sign up and welcome email

1. Ensure **Admin → Global settings → “Allow all email notifications”** is **on**.
2. Sign up a new user (e.g. go to Sign up → choose role → details → create account).
3. Check the inbox: you should get a **Welcome to Bond Back** email (role-specific subject).
4. If nothing arrives: check `RESEND_API_KEY` and `RESEND_FROM`; check Resend dashboard for logs/errors.

### 6.2 Tutorial email (24h after signup)

The **tutorial email** (“Your Quick Start Guide as a [Lister/Cleaner]”) is sent to users who signed up **24–48 hours ago**, once per user. It is triggered by a **cron job** that calls `GET /api/cron/send-tutorial-emails` with `Authorization: Bearer <CRON_SECRET>`.

- **Vercel:** Add a cron in `vercel.json` (e.g. daily at 10:00) that hits this URL with `CRON_SECRET` in the `Authorization` header.
- **Manual test:** Call `GET /api/cron/send-tutorial-emails` with the same header, or set `CRON_SECRET` in env and omit the header for local testing (or use a small script).
- **Preferences:** Users can opt out via Settings → Notifications (“Quick start guide email (24h after signup)”). The cron respects `email_tutorial` and `email_force_disabled`.

### 6.3 New bid on listing

1. Log in as **lister**, create a listing and put it live (or use an existing live listing).
2. Log in as **cleaner** (different account), open that listing and **place a bid**.
3. **Lister** should receive:
   - In-app notification (bell icon).
   - Email “New bid on your listing – Bond Back” with link to the **listing** (we now pass `listingId` so the link is `/listings/{id}`).
4. In **Settings → Notifications**, lister can turn off “New bid on my listing” to stop these emails (in-app still works).

### 6.4 Job and messages

1. As **lister**, accept a bid so a **job** is created.
2. Both lister and cleaner should get **job_created** emails (if preferences allow).
3. Send a **message** in the job as one user; the other should get **new_message** email (unless they were viewing the job in the last 5 minutes, or rate limit hit).
4. Continue the flow: **approve job** → cleaner gets **job_accepted**; **mark complete** → lister gets **job_completed**; **release payment** → both get **payment_released**.

### 6.5 Quick checklist

- [ ] `RESEND_API_KEY` set in `.env.local`
- [ ] `RESEND_FROM` set (or using Resend default)
- [ ] `NEXT_PUBLIC_APP_URL` set for link domain (e.g. `http://localhost:3000` in dev)
- [ ] Admin → Global settings → “Allow all email notifications” **on**
- [ ] Migrations applied (`notification_preferences`, `email_logs`, `notification_email_rate_limit`, `last_job_view` if used)
- [ ] Sign up → welcome email received
- [ ] Create listing → place bid as cleaner → lister gets “New bid” email and correct listing link
- [ ] Create job → send message → other user gets “New message” email (subject to rate limit and “viewing” skip)

---

## 7. Troubleshooting

- **No emails at all:**  
  Check `RESEND_API_KEY`; if missing, `sendEmail` logs `[email:resend]` with `outcome: failed` and error `Resend not configured (missing RESEND_API_KEY)`.  
  Check Admin → Global settings → “Allow all email notifications” is on (when off, logs show `skipped` with `global_settings.emails_enabled=false`).

- **Transactional emails (bid, message, job, payment) never arrive, but you see `[email:resend-env] hasResendApiKey: true`:**  
  Ensure **`SUPABASE_SERVICE_ROLE_KEY`** is set on the server (same as in Supabase Dashboard → Settings → API → `service_role`). The app uses the Admin API to read **each recipient’s** login email from Auth. Without it, `getNotificationPrefs` cannot resolve other users’ addresses and those emails are skipped. You’ll see a **one-time** console warning: `[getNotificationPrefs] SUPABASE_SERVICE_ROLE_KEY is missing or invalid`.  
  After fixing env, redeploy / restart the dev server.

- **Welcome email missing:**  
  The welcome email is sent in **`completeOnboardingFromSignup`** (after role + profile details on the onboarding flow), **not** on the raw Supabase sign-up click alone. It needs: global emails on, `RESEND_API_KEY`, and user preference `email_welcome` not turned off.  
  Onboarding profile creation also requires **`SUPABASE_SERVICE_ROLE_KEY`**; if that key is missing, onboarding returns “Server configuration error” before any welcome send.

- **New-bid email link wrong:**  
  We now pass `listingId` into the new_bid email so the CTA goes to `/listings/{id}`. Ensure you’re on the latest code.

- **Too many “new message” emails:**  
  Rate limit is 1 per job per hour. “Recipient viewed job recently” skips new-message email if they had the job page open in the last 5 minutes (requires `last_job_view` table and your job page recording the view).

- **User never gets any email:**  
  Check **Settings → Notifications** (user preferences) and Admin **email_force_disabled** for that user (Admin → Users).

- **Resend errors:**  
  Check Resend dashboard for bounces, complaints, or API errors. Verify domain if using custom `RESEND_FROM`.

- **Confirmation email after sign-up (Supabase):**  
  That message is sent by **Supabase Auth**, not by the app’s `sendEmail` / Resend integration. If it never arrives, check Supabase → Authentication → email templates and rate limits; optionally enable **Custom SMTP** with Resend (see §3b). The app’s `RESEND_API_KEY` does **not** automatically power Supabase confirmation until SMTP is configured in the Supabase Dashboard.

### Server logs (Vercel / local)

Search runtime logs for:

| Prefix | Meaning |
|--------|--------|
| `[email:resend-env]` | Logged once per server instance: whether `RESEND_API_KEY` is set, `RESEND_FROM`, `RESEND_REPLY_TO` |
| `[email:resend]` | Every `sendEmail` call: `outcome` sent / failed / skipped, masked `to`, `subject`, `kind`, errors |
| `[email:welcome]` | Welcome email after `completeOnboardingFromSignup` (not on raw sign-up alone) |
| `[email:tutorial-cron]` | Daily cron: tutorial batch start/end and counts |
| `[email:tutorial]` | Per-user tutorial send failure |
| `[email:notification]` | Transactional emails from `createNotification` |
| `[email:payment_receipt]` | Payment / payout receipts |
| `[email:cron]` | HTTP hit on `/api/cron/send-tutorial-emails` |

### Preference check code

Before any transactional email is sent, the flow is:

1. **Global switch** (`lib/actions/notifications.ts`): `getGlobalSettings()` → if `emails_enabled === false`, return without sending.
2. **User prefs** (`lib/supabase/admin.ts`): `getNotificationPrefs(userId)` loads `profiles.notification_preferences` and `email_force_disabled`. It exposes `shouldSendEmail(type)` which uses `shouldSendEmailForType(prefs, type, emailForceDisabled)` from `lib/notification-preferences.ts`.
3. **Logic** (`lib/notification-preferences.ts`): `shouldSendEmailForType(prefs, type, emailForceDisabled)` returns false if `emailForceDisabled`; else maps `type` (e.g. `new_bid`) to a preference key (`new_bid`); if the key is explicitly `false`, don't send; if critical (dispute, payment_released) use explicit or default; otherwise if `receive_all_non_critical` is true, send; else use explicit or default.

So email is sent only when the user has not turned off that type (and global emails are on, and not force-disabled).

### Where events trigger emails (server actions)

- **New bid:** `lib/actions/bids.ts` → `createNotification(lister_id, "new_bid", null, message, { listingId })`
- **New message:** `lib/actions/job-messages.ts` → `createNotification(recipientId, "new_message", jobId, body, { senderName })`
- **Job created:** `lib/actions/jobs.ts` → `createNotification(lister_id, "job_created", jobId, …)` and same for winner_id
- **Job accepted (lister approved):** `lib/actions/jobs.ts` → `createNotification(winner_id, "job_accepted", jobId, …)`
- **Job marked complete:** `lib/actions/jobs.ts` → `createNotification(lister_id, "job_completed", jobId, …)`
- **Payment released:** `lib/actions/jobs.ts` and `lib/actions/admin-jobs.ts` → `createNotification(…, "payment_released", jobId, msg)`
- **Dispute opened / resolved:** `lib/actions/jobs.ts` and `lib/actions/admin-jobs.ts` → `createNotification(…, "dispute_opened" | "dispute_resolved", jobId, msg)`

All go through `createNotification`, which inserts the in-app notification then runs the preference check and sends email via Resend if allowed.

### Example email template (Job accepted)

Templates live in `emails/` and use React Email + `EmailLayout` (Bond Back header, "View Job" button, footer). Example for **Job accepted / approved to start** (`emails/JobApproved.tsx`):

- **Subject:** "Lister approved – time to clean! – Bond Back"
- **Body:** Title "Lister approved – time to clean!", message text, subtext "Head to the job to see the checklist and get started."
- **CTA:** "View Job" → `{APP_URL}/jobs/{jobId}`
