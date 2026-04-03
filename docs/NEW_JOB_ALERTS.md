# New job alerts (SMS + push)

## Behaviour

1. **Trigger**: When a lister publishes a listing (`status = 'live'`) from the new listing flow, `notifyNearbyCleanersOfNewListing` / `sendNewListingSmsToNearbyCleaners` runs (see `components/features/new-listing-form.tsx` after photos + cover are saved).

2. **Global kill switch**: `global_settings.enable_sms_alerts_new_jobs` — when `false`, **no** new-job SMS or Expo push is sent (despite the column name, it gates **both** channels).

3. **Audience**: Only profiles whose `roles` include **`cleaner`**.

4. **Radius**: For each cleaner, `max_travel_km` (default 50) is compared to distance from the listing:
   - Listing + cleaner coordinates from **suburb/postcode** lookup (`getSuburbLatLon`) → **haversine** km.
   - If either side lacks coordinates → **postcode distance** (`postcodeDistanceKm`).

5. **SMS** (Twilio): `lib/notifications/sms.ts` — `sendNewJobAlert` → `sendSmsToUser` (rate limit `sms_daily_sends`).

6. **Push** (Expo): `lib/notifications/push.ts` — `sendNewJobPushAlert` → `sendPushToUser` (rate limit `push_daily_sends`).

7. **Message shape**  
   - SMS: `New bond clean job in [suburb] ([postcode]) – $min–$max. Bid now: {NEXT_PUBLIC_APP_URL}/jobs/{listingId}`  
   - Push: same copy in body + `data.listingId` / deep link target.

8. **Per-user prefs** (cleaners only in `/settings`):
   - `notification_preferences.sms_new_job` — **SMS for new jobs**
   - `notification_preferences.push_new_job` — **Push for new jobs**  
   Other push types still use `push_enabled`.

9. **Rate limits**: Default **5 SMS** and **5 push** per cleaner per UTC day; optional overrides `global_settings.max_sms_per_user_per_day` and `max_push_per_user_per_day`.

## Env

- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`
- `EXPO_ACCESS_TOKEN` (optional)
- `NEXT_PUBLIC_APP_URL` (e.g. `https://www.bondback.io`)

## DB

- `sms_daily_sends`, `push_daily_sends` (user_id, date_utc, count)
- Migration: `20260309120000_global_settings_new_job_push_limit.sql` (`max_push_per_user_per_day`)
