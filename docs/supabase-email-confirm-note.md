# Supabase “Confirm signup” email — copy for the dashboard

Supabase sends confirmation emails from **Authentication → Email Templates** (not from this repo). Use your production **Site URL** `https://www.bondback.io` so redirects stay on the canonical host.

## URL configuration (must match production)

In **Authentication → URL Configuration**:

| Setting | Required value |
|--------|----------------|
| **Site URL** | `https://www.bondback.io` |
| **Redirect URLs** | Include at least: `https://www.bondback.io/**` and `https://www.bondback.io/auth/confirm` (the wildcard usually covers the path; add the explicit path if your project requires it). |
| **Additional redirects** | `http://localhost:3000/**` for local dev. |

If **Site URL** or **Redirect URLs** omit `www`, confirmation links that use `https://bondback.io` or an unlisted host can fail or redirect incorrectly (especially on mobile).

## Confirm link (required format)

Use this as the **confirmation URL** (Confirm sign up template). `token_hash` and `type` must be present for the legacy OTP path:

```text
https://www.bondback.io/auth/confirm?token_hash={{ .TokenHash }}&type=signup
```

If your template uses `{{ .ConfirmationURL }}` instead, ensure Supabase’s URL still resolves to the path above (same query params).

## Note at the top (above the button)

```text
For best results, open this link in Safari or Chrome (not in the Mail app preview or private mode).
```

HTML example:

```html
<p style="margin:0 0 16px 0; font-size: 14px; line-height: 1.5; color: #334155;">
  <strong>Tip:</strong> For best results, open this link in <strong>Safari</strong> or <strong>Chrome</strong>
  (not in the Mail app preview or private / incognito mode).
</p>
```

## If sign-in doesn’t finish (below the button)

```text
If sign-in doesn’t finish, long-press the link, tap Copy, then paste it into Safari’s address bar.
```

After saving, send a test email and confirm the opened URL includes `token_hash` and `type=signup` (or PKCE `code=`).
