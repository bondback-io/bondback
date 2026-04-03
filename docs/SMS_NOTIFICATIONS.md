# SMS notifications (Twilio)

Critical, high-value events are sent via SMS when the user has **Receive SMS notifications** enabled in Settings (`profiles.notification_preferences.sms_enabled`) and a **phone number** in their profile. Rate limit: **max 5 SMS per user per day** (UTC).

## Env vars

- `TWILIO_ACCOUNT_SID` – Twilio Account SID  
- `TWILIO_AUTH_TOKEN` – Twilio Auth Token  
- `TWILIO_PHONE_NUMBER` – Sender number, Australian E.164 preferred (e.g. `+61491570156`)

If these are not set, SMS sending is a no-op (no errors).

## When SMS is sent (only if user has SMS enabled)

| Event | Recipient | Message |
|-------|-----------|--------|
| **1. New job near cleaner** | Cleaners with matching suburb/postcode | "New bond clean job in [suburb] ([postcode]) – $[min]–$[max]. Bid now: https://www.bondback.io/jobs/[id]" |
| **2. Bid accepted / job won** | Cleaner | "Your bid was accepted! Job #[id] – [title]. View: https://www.bondback.io/jobs/[id]" |
| **3. Job approved to start** | Cleaner | "Lister approved – start Job #[id]. Chat: https://www.bondback.io/jobs/[id]" |
| **4. Payment released** | Cleaner (and lister where applicable) | "Payment of $[amount] received for Job #[id]. View earnings: https://www.bondback.io/earnings" |
| **5. Dispute opened** | Other party | "Dispute on Job #[id]. Respond now: https://www.bondback.io/jobs/[id]" |

## SMS send function

**File:** `lib/notifications/sms.ts`

```ts
/** Send one SMS via Twilio. No rate limit; use sendSmsToUser for notifications. */
export async function sendSms(
  to: string,
  message: string
): Promise<{ ok: boolean; error?: string; sid?: string }>;

/** Check + increment daily count. Returns true if under limit. */
export async function checkAndIncrementSmsRateLimit(userId: string): Promise<boolean>;

/** Send SMS to a user with rate limiting (max 5/day). Returns ok, sent (true if actually sent). */
export async function sendSmsToUser(
  userId: string,
  to: string,
  message: string
): Promise<{ ok: boolean; sent?: boolean; error?: string }>;
```

- Australian numbers are normalized to E.164 (+61).
- Rate limit table: `sms_daily_sends` (user_id, date_utc, count). Migration: `supabase/migrations/20250610000000_sms_daily_rate_limit.sql`.

## Rate limit example

```ts
// In notification flow: use sendSmsToUser so limit is applied automatically
const result = await sendSmsToUser(userId, phone, body);
if (result.sent) {
  // SMS was sent (not skipped by limit or missing config)
}

// Raw send (e.g. test): check limit first, then send
const allowed = await checkAndIncrementSmsRateLimit(userId);
if (allowed) {
  await sendSms(phone, message);
}
```

## Settings toggle (JSX)

**File:** `components/settings/settings-forms.tsx`

Stored in `profiles.notification_preferences.sms_enabled`. Toggle is in the notification preferences form:

```tsx
const PREF_KEYS: NotificationPreferenceKey[] = [
  // ...
  "sms_enabled",
];
// NOTIFICATION_LABELS.sms_enabled = "Receive SMS notifications"
```

Saved via `saveNotificationSettings(formData)` in `app/settings/actions.ts`; key `"sms_enabled"` is in `NOTIFICATION_PREF_KEYS`.

**Send test SMS** button (shows "SMS sent" toast on success):

```tsx
function SendTestSmsButton() {
  const [testing, setTesting] = useState(false);
  const { toast } = useToast();
  const handleTest = async () => {
    setTesting(true);
    try {
      const { sendTestSms } = await import("@/lib/actions/sms-notifications");
      const result = await sendTestSms();
      if (result.ok) {
        toast({ title: "SMS sent", description: "Check your phone for the test message." });
      } else {
        toast({ variant: "destructive", title: "SMS failed", description: result.error });
      }
    } finally {
      setTesting(false);
    }
  };
  return (
    <Button type="button" size="sm" variant="outline" className="rounded-full" disabled={testing} onClick={handleTest}>
      {testing ? "Sending…" : "Send test SMS"}
    </Button>
  );
}
```

## Job creation and notifications

- **New listing:** `sendNewListingSmsToNearbyCleaners(listingId)` is called from the new listing form after create; finds cleaners by suburb/postcode, uses `sendSmsToUser` for each with SMS enabled.
- **Bid accepted, job approved to start, payment released, dispute opened:** `createNotification(...)` in `lib/actions/notifications.ts` inserts the in-app notification, then if `prefs.shouldSendSms(type)` and `prefs.phone`, calls `sendSmsToUser(userId, prefs.phone, body)` with the event-specific message body.
- **Job approved to start** is sent from `fulfillJobPaymentFromSession` (lister returns from Stripe) and from the Stripe webhook `checkout.session.completed` when the job is set to in_progress.
