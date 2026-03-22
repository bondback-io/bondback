# GitHub setup (Bond Back)

## What was fixed

- **Remote URL** was broken (`yourusername` URL merged with the real repo). It is now:
  `https://github.com/bondback-io/bondback.git`
- **`.gitignore` added** so `node_modules/`, `.next/`, `.env`, `.env.local`, `.vercel/`, etc. are not committed.
- **Initial commit** created on branch `main` (426 source files).

## Push to GitHub (you run this)

From `BondBack`:

```powershell
cd C:\Users\redfoxxx\Documents\BondBack
& "${env:ProgramFiles}\Git\bin\git.exe" push -u origin main
```

If Git asks to sign in:

1. **GitHub CLI** (easiest): install [GitHub CLI](https://cli.github.com/), then `gh auth login`, then push again.
2. **HTTPS + PAT**: use a [Personal Access Token](https://github.com/settings/tokens) as the password (not your GitHub password).
3. **SSH**: add a deploy key or your SSH key, then:
   `git remote set-url origin git@github.com:bondback-io/bondback.git`

## Add `git` to your PATH (optional)

If `git` is not recognized in PowerShell, add:
`C:\Program Files\Git\bin`
to **System Environment Variables → Path**, then reopen the terminal.

## Commit author (optional)

This repo uses local config:

- `user.name` = `bondback-io`
- `user.email` = `bondback-io@users.noreply.github.com`

To use your own name/email for future commits:

```powershell
git config --local user.name "Your Name"
git config --local user.email "your-email@example.com"
```

