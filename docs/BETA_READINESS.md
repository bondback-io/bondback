# Bond Back — beta readiness checklist

Use this before inviting external testers or going to production.

## PWA & mobile

- [ ] `/manifest.json` loads; theme colors look correct in browser tab (light/dark).
- [ ] **Install prompt** appears on mobile **after 3 visits** (dismiss persists for the session; `localStorage` visit count).
- [ ] Service worker registers; **offline** job list/detail still readable after visiting jobs online once.
- [ ] **Global offline banner** shows when network is disabled; reconnect restores data (jobs pages refresh + toast where applicable).

## Payments & referrals

- [ ] Stripe **test** and **live** keys / webhooks configured per environment.
- [ ] Escrow: manual capture → release → Connect transfer; **auto-release** cron with `CRON_SECRET`.
- [ ] **Referrals**: `referral_enabled` in Global Settings; profile shows code + **share link** (`/ref/CODE` for OG previews).
- [ ] **First-job nudge** shows for cleaners with **zero** completed jobs while referrals are on; dismiss works (session).

## Trust & safety

- [ ] **Abuse cron** `/api/cron/abuse-detection` scheduled (daily); users with **>3 dispute opens in 30 days** update `high_dispute_opens_30d` and notify **admins** (cooldown 24h).
- [ ] Admin can review flagged users (Users + job/dispute history).

## Comms

- [ ] Email (Resend): welcome, receipts, critical notifications; kill switch `emails_enabled`.
- [ ] SMS / push limits respected (see global settings).

## Legal & copy

- [ ] Terms, privacy, and listing copy reviewed for your jurisdiction (AU focus).
- [ ] Announcement / maintenance banners tested in Global Settings.

## Ops

- [ ] `SUPABASE_SERVICE_ROLE_KEY` set for cron and server-only paths.
- [ ] Env vars documented: `NEXT_PUBLIC_APP_URL`, Stripe, `CRON_SECRET`, Resend.
- [ ] Error monitoring (e.g. Sentry) and logs for API routes (recommended).

## Features to smoke-test (quick)

| Area | What to verify |
|------|----------------|
| Onboarding | Signup with `?ref=` / `/ref/CODE` → `referred_by` set |
| Listing → bid → accept | Job created; chat available |
| Pay & start | Escrow hold; checklist + photos |
| Complete → release | Lister release or auto-release; receipts |
| Dispute | Open, negotiate, resolve paths |
| Profile | Bank connect (cleaner), referral share buttons |
| Admin | Users, jobs, disputes, global settings |

---

*Last updated with beta polish: PWA visit threshold, global offline banner, first-job nudge, referral OG landing, dispute abuse cron.*
