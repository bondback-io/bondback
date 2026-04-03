# Geolocation-based SMS alerts for new jobs

Cleaners receive SMS when a new bond cleaning listing is created **near their location**, if they have opted in.

## Summary

- **Trigger:** When a new listing is created with `status = 'live'` (after insert in the new-listing flow).
- **Who gets SMS:** Cleaners whose profile is within their `max_travel_km` of the listing (by haversine if lat/lon in `suburbs` table, else postcode approximation), and who have:
  - `profiles.notification_preferences.sms_new_job = true`
  - A valid `profiles.phone`
- **Message:**  
  `"New bond clean job in [suburb] ([postcode]) – $[min]–$[max]. Bid now: https://www.bondback.io/jobs/[listingId]"`
- **Rate limit:** Max 5 SMS per cleaner per day (UTC). Admin can override in **Admin → Global settings** (optional "Max SMS per user per day").
- **Kill switch:** Admin can disable all new-job SMS via **Admin → Global settings** → "Enable SMS Alerts for New Jobs".

## Distance calculation

### Haversine (when lat/lon available)

If the listing’s postcode (and optionally the cleaner’s) can be resolved to lat/lon via the `suburbs` table, distance is computed with the haversine formula (km):

```ts
// lib/geo/haversine.ts
const EARTH_RADIUS_KM = 6371;

export function haversineDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
}
```

### Postcode fallback

When lat/lon is missing (listing or cleaner), distance is approximated by postcode:

- Same postcode → 0 km (always within radius).
- Adjacent postcode (e.g. 2000 vs 2001) → 10 km.
- Small difference (≤10) → 15 km.
- Larger difference → 25 km.

Cleaners are included only if `distanceKm <= profile.max_travel_km` (default 50 km when not set).

## SMS trigger logic

1. **Listing created (status = 'live')**  
   `components/features/new-listing-form.tsx` calls `sendNewListingSmsToNearbyCleaners(listingId)` after a successful insert (and optional photo upload).

2. **Server action** `sendNewListingSmsToNearbyCleaners` (`lib/actions/sms-notifications.ts`):
   - Reads **global_settings**: if `enable_sms_alerts_new_jobs === false`, returns without sending.
   - Loads listing (suburb, postcode, reserve_cents, buy_now_cents, current_lowest_bid_cents).
   - Resolves listing lat/lon via `getSuburbLatLon(admin, listingPostcode)` from `suburbs`.
   - Loads all profiles with `phone` set and `roles` containing `"cleaner"`.
   - For each cleaner:
     - Resolves cleaner lat/lon from `suburbs` by postcode (if available).
     - Computes `distanceKm` (haversine if both have lat/lon, else `postcodeDistanceKm`).
     - If `distanceKm <= max_travel_km`, calls `sendNewJobAlert(cleanerId, listingId, suburb, postcode, minCents, maxCents)`.

3. **sendNewJobAlert** (`lib/notifications/sms.ts`):
   - Loads `getNotificationPrefs(cleanerId)`; if no phone or `shouldSendSmsNewJob()` is false, exits without sending.
   - Builds the message string and calls `sendSmsToUser(cleanerId, phone, message)` (rate-limited, respects admin “max SMS per user per day” if set).

## Settings toggle (user)

**Path:** `/settings` → Notifications.

- **Key:** `profiles.notification_preferences.sms_new_job`
- **Label:** "Receive SMS for new jobs near me"
- **Component:** shadcn `Switch` in the notification preferences form.
- **Success toast:** When the user saves and `sms_new_job` is on:  
  **"SMS alerts enabled for new jobs in your area."**

Relevant JSX (conceptually):

```tsx
// In settings form, PREF_KEYS includes "sms_new_job".
// NOTIFICATION_LABELS["sms_new_job"] = "Receive SMS for new jobs near me"

{ PREF_KEYS.map((key) => (
  <div key={key} className="flex items-center justify-between gap-4">
    <Label htmlFor={key}>{NOTIFICATION_LABELS[key]}</Label>
    <Switch
      id={key}
      checked={values[key]}
      onCheckedChange={(checked) =>
        setValues((prev) => ({ ...prev, [key]: checked }))
      }
    />
  </div>
)) }

// On save success, if sms_new_job was toggled on:
toast({
  title: "Notification preferences updated",
  description: "SMS alerts enabled for new jobs in your area.",
});
```

## Admin global settings

**Path:** `/admin/global-settings`.

- **Enable SMS Alerts for New Jobs**  
  Toggle `global_settings.enable_sms_alerts_new_jobs`. When off, no new-job SMS are sent (user preference and rate limit still apply when on).

- **Max SMS per user per day (optional)**  
  `global_settings.max_sms_per_user_per_day` (integer, nullable). Leave blank to use app default (5). Used by `lib/notifications/sms.ts` in `checkAndIncrementSmsRateLimit`.

## Env / Twilio

- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER` in `.env.local` (or env where server runs).
- See `docs/SMS_NOTIFICATIONS.md` for full SMS and rate-limit details.

## Files

| File | Role |
|------|------|
| `lib/geo/haversine.ts` | Haversine distance + postcode approximation. |
| `lib/geo/suburb-lat-lon.ts` | Look up lat/lon for a postcode from `suburbs`. |
| `lib/notifications/sms.ts` | `sendSms`, `sendSmsToUser`, `sendNewJobAlert`; rate limit and global max/day. |
| `lib/actions/sms-notifications.ts` | `sendNewListingSmsToNearbyCleaners`, global kill switch, distance filtering. |
| `lib/supabase/admin.ts` | `shouldSendSmsNewJob()` on notification prefs. |
| `lib/notification-preferences.ts` | `sms_new_job` key and label. |
| `components/settings/settings-forms.tsx` | Toggle + success toast. |
| `app/settings/actions.ts` | Persist `sms_new_job` in notification_preferences. |
| `app/admin/global-settings/page.tsx` | Pass `enableSmsAlertsNewJobs` and `maxSmsPerUserPerDay` to form. |
| `components/admin/admin-global-settings-form.tsx` | Admin toggles and optional max SMS/day. |
| `supabase/migrations/20250611000000_global_settings_sms_alerts_new_jobs.sql` | Columns for kill switch and max SMS/day. |
