# Supabase “Confirm signup” email — add this note

Supabase sends confirmation emails from the **Auth → Email Templates** editor (not from this repo). Add the following so users open links in a real browser (avoids Mail/Gmail in-app PKCE issues).

## Suggested paragraph (plain text or HTML)

Place **below** the main confirmation button / link:

```text
Tip: For the best experience, open this email in Safari or Chrome and tap the link there. If sign-in doesn’t complete, long-press the link, choose Copy, then paste it into Safari or Chrome’s address bar.
```

## Short variant (fits narrow templates)

```text
Best opened in Safari or Chrome. If it doesn’t work, copy the link and paste it into your browser’s address bar.
```

After saving the template in Supabase, send a test email and confirm the link still includes your `redirect_to` / `Site URL` parameters.
