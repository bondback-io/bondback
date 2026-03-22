# Push Notifications (Expo)

Bond Back sends **Expo Push Notifications** for critical, high-value events. The **Next.js backend** uses `expo-server-sdk` to send pushes; tokens are stored in `profiles.expo_push_token` and registered by the **Bond Back mobile app** (Expo/React Native).

## Events that trigger push

- **New job near you** (cleaners within `max_travel_km` or postcode radius)
- **New bid** (lister)
- **Job accepted** (cleaner)
- **Job approved to start** (cleaner)
- **Job marked complete** (lister)
- **Payment released** (cleaner)
- **Dispute opened** (both parties)

Rate limit: **max 5 push per user per day** (UTC).

## Backend (Next.js)

### Env (optional)

- `EXPO_ACCESS_TOKEN` – Expo access token for higher rate limits (optional).
- No token required for basic usage.

### DB

- **`profiles.expo_push_token`** (text, nullable) – set when user enables push in the mobile app.
- **`push_daily_sends`** – `(user_id, date_utc, count)` for daily rate limiting.

### Settings

- **/settings** – Toggle **“Receive push notifications”** (`notification_preferences.push_enabled`). Users turn this on here; the mobile app registers the device and saves the token.

### Token registration (for mobile app)

**POST /api/profile/push-token**

- Auth: required (session cookie).
- Body: `{ "token": "ExponentPushToken[xxx]" }` or `{ "token": null }` to clear.
- Updates `profiles.expo_push_token` for the current user.

### Send function

- **`lib/notifications/push.ts`**
  - `sendPushToUser(userId, pushToken, { title, body, data })` – rate-limited send.
  - `buildPushPayload(type, jobId, options)` – title/body/data by event type.
  - `sendNewJobPushAlert(cleanerId, pushToken, listingId, suburb, postcode, minCents, maxCents)` – “New job near you”.

Payload `data` for deep linking:

- `{ jobId, type: 'new_job' }` → open `/jobs/[id]`.
- Other types: `{ jobId, type }` (e.g. `payment_released`, `dispute_opened`).

## Expo mobile app setup

Bond Back is a **web app**; push tokens are obtained in an **Expo (React Native) app**. When you add a Bond Back Expo app, use the following.

### 1. app.json (Expo)

```json
{
  "expo": {
    "name": "Bond Back",
    "slug": "bond-back",
    "version": "1.0.0",
    "plugins": [
      [
        "expo-notifications",
        {
          "icon": "./assets/notification-icon.png",
          "sounds": []
        }
      ]
    ],
    "extra": {
      "apiUrl": "https://your-next-app.vercel.app"
    }
  }
}
```

### 2. Request permission and get token (client)

```ts
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";

async function registerForPushNotificationsAsync(): Promise<string | null> {
  if (!Device.isDevice) return null;
  const { status: existing } = await Notifications.getPermissionsAsync();
  let final = existing;
  if (existing !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    final = status;
  }
  if (final !== "granted") return null;
  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  return token;
}
```

### 3. Save token to Bond Back API

After login, call the Next.js API so the backend can send pushes to this device:

```ts
const token = await registerForPushNotificationsAsync();
if (token) {
  await fetch(`${API_URL}/api/profile/push-token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ token }),
  });
}
```

Use the same session (e.g. Supabase auth cookie or Bearer token) that the web app uses so `POST /api/profile/push-token` identifies the user.

### 4. Handle tap / deep link

In the Expo app, handle notification response and open the correct screen (e.g. `/jobs/[id]` from `data.jobId` and `data.type`).

## Summary

| Item | Location |
|------|----------|
| Toggle "Receive push notifications" | /settings (web) |
| Store token | POST /api/profile/push-token (from mobile app) |
| Send push (server) | `lib/notifications/push.ts` → `sendPushToUser`, `sendNewJobPushAlert` |
| New job near you | `lib/actions/sms-notifications.ts` (SMS + push to nearby cleaners) |
| Other events | `lib/actions/notifications.ts` → `createNotification` (email + SMS + push) |
| Rate limit | 5 per user per day; table `push_daily_sends` |
