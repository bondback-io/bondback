# Email notifications (Resend) – env vars

Add these to `.env.local` (and `.env.example` for your team):

```bash
# Resend (resend.com – create free account, get API key from dashboard)
RESEND_API_KEY=re_xxxxxxxxxxxx

# From address — production: verify bondback.io in Resend, then e.g.:
RESEND_FROM="Bond Back <noreply@bondback.io>"
# Local dev without verified domain: RESEND_FROM="Bond Back <onboarding@resend.dev>"

# Optional: app URL for job links in emails (default: https://www.bondback.io)
NEXT_PUBLIC_APP_URL=https://www.bondback.io

# Required for sending: resolve user email by id (Supabase Dashboard → Settings → API → service_role)
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

- **RESEND_API_KEY**: Get from [resend.com](https://resend.com) → API Keys. Free tier: 100 emails/day.
- **SUPABASE_SERVICE_ROLE_KEY**: Needed so the app can look up user email from `auth.users` and `profiles.email_notifications`. Keep secret; server-side only.
