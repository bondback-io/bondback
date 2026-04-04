# Supabase “Confirm signup” email — copy for the dashboard

Supabase sends confirmation emails from **Authentication → Email Templates** (not from this repo). Use your production **Site URL** / redirect so links hit `https://www.bondback.io/auth/confirm?...`.

## Required note at the top (add above the main button)

Plain text or HTML paragraph:

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

## Extra paragraph (below the confirmation button)

```text
If sign-in doesn’t finish, long-press the link, tap Copy, then paste it into Safari or Chrome’s address bar.
```

## Short variant (narrow templates)

```text
Best in Safari or Chrome — not Mail preview or private mode. Copy the link if needed.
```

After saving, send a test email and confirm the link still includes `redirect_to` / your Site URL and lands on `/auth/confirm`.
