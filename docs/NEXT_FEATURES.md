# Suggested next features

## 1. Full radius search (Google Maps API)

- **What:** Filter `/jobs` by real distance from the cleaner’s suburb/postcode instead of a stub.
- **How:** Use Google Maps Geocoding API to resolve postcodes/suburbs to lat/lng; compute Haversine (or PostGIS) distance; filter listings where `distance(listing.postcode, cleaner.suburb) <= max_travel_km`.
- **Env:** `GOOGLE_MAPS_API_KEY` (or use a free tier / server-side only).
- **DB:** Optionally add `lat`, `lng` to `listings` and `profiles` for faster queries; or compute on the fly with a small cache.

## 2. Proxy bidding

- **What:** Lister sets a “max bid” and the system automatically places bids on their behalf up to that limit (or cleaner sets “min job price” and system auto-bids down to that).
- **How:** Store proxy rules (e.g. `listings.max_auto_bid_cents` or a `proxy_bids` table). When a new bid arrives, a server function or cron checks if any proxy should outbid; if so, place the next lower bid. Use Supabase Realtime or a short-interval job to react quickly.

## 3. Admin dashboard

- **What:** Internal dashboard for support/fraud: list users, listings, bids, payouts, flag disputes.
- **How:** New route e.g. `/admin` (protected by role `profile.role === 'admin'` or a separate auth). Tables: list `profiles`, `listings`, `bids`, Stripe payouts. Add RLS so only admin users can read sensitive data, or use service role in a server-only admin API.

## 4. Real ABN lookup

- **What:** Validate Australian Business Number (ABN) via the Australian Business Register (ABR) API when a cleaner enters their ABN at onboarding or in profile.
- **How:** Call ABR web services (e.g. GUID required for production). Validate format (11 digits, weighted checksum) and optionally company name match. Store “ABN verified at” timestamp; show a “Verified” badge for cleaners with verified ABN.

---

**Already stubbed in codebase**

- Stripe: Buy-Now checkout + escrow/PaymentIntent hold (12% platform fee comment).
- Notifications: `lib/notifications.ts` (console.log; swap for Resend/Twilio).
- Job completion: before/after photo upload requirement and flow in `docs/JOB_COMPLETION_PHOTOS.md`.
