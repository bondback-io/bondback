# New job alerts (SMS + push)

## Behaviour

1. **Trigger**: When a lister publishes a listing (`status = 'live'`) from the new listing flow, `notifyNearbyCleanersOfNewListing` / `sendNewListingSmsToNearbyCleaners` runs (see `components/features/new-listing-form.tsx` after photos + cover are saved). **Requires `SUPABASE_SERVICE_ROLE_KEY` on the server** — inserts and recipient email lookup use the service role.

2. **Admin “Send listing reminders now”** (Global Settings): Runs `notifyAllLiveListingsNearbyCleaners` for every live listing (same logic as publish), then the daily browse-jobs nudge. Also requires the service role.

3. **Global kill switch**: `global_settings.enable_sms_alerts_new_jobs` — when `false`, **no** new-job SMS or Expo push is sent (despite the column name, it gates **both** channels).

4. **Audience**: Only profiles whose `roles` include **`cleaner`** (including `text[]`, JSON string, or comma-separated legacy formats — see `normalizeProfileRoles` in `lib/profile-roles.ts`).

5. **Radius**: For each cleaner, `max_travel_km` (default 50) is compared to distance from the listing:
   - Listing + cleaner coordinates from **suburb/postcode** lookup (`getSuburbLatLon`) → **haversine** km.
   - If either side lacks coordinates → **postcode distance** (`postcodeDistanceKm`).

6. **SMS** (Twilio): `lib/notifications/sms.ts` — `sendNewJobAlert` → `sendSmsToUser` (rate limit `sms_daily_sends`).

7. **Push** (Expo): `lib/notifications/push.ts` — `sendNewJobPushAlert` → `sendPushToUser` (rate limit `push_daily_sends`).

8. **Email + in-app**: `createNotification` with type `new_job_in_area` — React Email template `GenericNotification` via `lib/notifications/email.ts`. Channels are gated by Admin global toggles (`new_listing_in_radius_*`, `new_listing_outside_*`).

9. **Message shape**  
   - SMS: `New bond clean job in [suburb] ([postcode]) – $min–$max. Bid now: {NEXT_PUBLIC_APP_URL}/jobs/{listingId}`  
   - Push: same copy in body + `data.listingId` / deep link target.

10. **Per-user prefs** (cleaners only in `/settings`):
   - `notification_preferences.sms_new_job` — **SMS for new jobs**
   - `notification_preferences.push_new_job` — **Push for new jobs**  
   Other push types still use `push_enabled`.

11. **Rate limits**: Default **5 SMS** and **5 push** per cleaner per UTC day; optional overrides `global_settings.max_sms_per_user_per_day` and `max_push_per_user_per_day`.

## Env

- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`
- `EXPO_ACCESS_TOKEN` (optional)
- `NEXT_PUBLIC_APP_URL` (e.g. `https://www.bondback.io`)

## DB

- `sms_daily_sends`, `push_daily_sends` (user_id, date_utc, count)
- Migration: `20260309120000_global_settings_new_job_push_limit.sql` (`max_push_per_user_per_day`)
