import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AuthConfirmErrorResend } from "@/components/auth/auth-confirm-error-resend";
import { AuthConfirmErrorActions } from "@/components/auth/auth-confirm-error-actions";
import { MailWarning } from "lucide-react";

function firstMessage(
  sp: Record<string, string | string[] | undefined>
): string {
  const v = sp.message;
  if (v === undefined) {
    return "We couldn’t confirm your email. The link may be expired or invalid.";
  }
  const s = Array.isArray(v) ? v[0] : v;
  return typeof s === "string" && s.trim() ? s : "We couldn’t confirm your email. The link may be expired or invalid.";
}

function firstReason(sp: Record<string, string | string[] | undefined>): string | null {
  const v = sp.reason;
  if (v === undefined) return null;
  const s = Array.isArray(v) ? v[0] : v;
  return typeof s === "string" && s.trim() ? s.trim() : null;
}

function firstOptionalEmail(sp: Record<string, string | string[] | undefined>): string | undefined {
  const v = sp.email;
  if (v === undefined) return undefined;
  const s = Array.isArray(v) ? v[0] : v;
  if (typeof s !== "string" || !s.trim()) return undefined;
  try {
    return decodeURIComponent(s.trim());
  } catch {
    return s.trim();
  }
}

function firstRetryUrl(sp: Record<string, string | string[] | undefined>): string | null {
  const v = sp.retry;
  if (v === undefined) return null;
  const s = Array.isArray(v) ? v[0] : v;
  if (typeof s !== "string" || !s.trim()) return null;
  try {
    const decoded = decodeURIComponent(s.trim());
    new URL(decoded);
    return decoded;
  } catch {
    return null;
  }
}

function friendlyHeadline(reason: string | null, isAlreadyUsed: boolean): string {
  if (isAlreadyUsed) return "This link was already used";
  if (reason === "pkce_in_app_browser" || reason === "pkce_verifier_missing") {
    return "Your mail app couldn’t finish sign-in";
  }
  if (reason === "missing_token") return "This link looks incomplete";
  if (reason === "oauth_error") return "Sign-in couldn’t be completed";
  return "We couldn’t confirm your email";
}

function friendlySubhead(
  reason: string | null,
  isAlreadyUsed: boolean,
  isMissingToken: boolean
): string {
  if (isAlreadyUsed) {
    return "That usually means your email is already verified — you can log in with your password.";
  }
  if (reason === "pkce_in_app_browser" || reason === "pkce_verifier_missing") {
    return "That’s common in Mail or Gmail’s in-app browser. The same link usually works in Safari or Chrome.";
  }
  if (isMissingToken) {
    return "The confirmation address may have been shortened or opened in the wrong app.";
  }
  return "Don’t worry — you can fix this in a minute.";
}

function shouldShowBrowserHints(reason: string | null): boolean {
  if (!reason) return false;
  return (
    reason === "pkce_in_app_browser" ||
    reason === "pkce_verifier_missing" ||
    reason === "oauth_error" ||
    reason === "exchange_failed"
  );
}

export default async function AuthConfirmErrorPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const message = firstMessage(sp);
  const reason = firstReason(sp);
  const optionalEmail = firstOptionalEmail(sp);
  const retryUrl = firstRetryUrl(sp);
  const isMissingToken = reason === "missing_token";
  const isAlreadyUsed = reason === "already_used";
  const showResendConfirmation = !isAlreadyUsed;
  const showBrowserHints = shouldShowBrowserHints(reason) && Boolean(retryUrl);

  return (
    <section className="page-inner flex min-h-[75vh] flex-col items-center justify-center px-4 py-10 sm:py-14">
      <Card className="w-full max-w-lg border-border/70 shadow-xl dark:border-gray-800 dark:bg-gray-900/95">
        <CardHeader className="space-y-3 border-b border-border/50 pb-6 text-center dark:border-gray-800">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-700 dark:bg-amber-500/10 dark:text-amber-200">
            <MailWarning className="h-7 w-7" aria-hidden />
          </div>
          <CardTitle className="text-balance text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            {friendlyHeadline(reason, isAlreadyUsed)}
          </CardTitle>
          <CardDescription className="text-base leading-relaxed text-muted-foreground">
            {friendlySubhead(reason, isAlreadyUsed, isMissingToken)}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-6 pt-6">
          <div className="rounded-2xl border border-border/60 bg-muted/30 px-4 py-4 text-center text-[0.9375rem] leading-relaxed text-foreground dark:border-gray-700/80 dark:bg-gray-950/50 dark:text-gray-200">
            {message}
          </div>

          {showBrowserHints ? (
            <AuthConfirmErrorActions retryUrl={retryUrl} showOpenInBrowserHints />
          ) : null}

          {isMissingToken ? (
            <ul className="list-inside list-disc space-y-2 rounded-2xl border border-amber-500/25 bg-amber-500/[0.07] px-4 py-3 text-sm leading-relaxed text-foreground/95 dark:border-amber-500/20 dark:bg-amber-950/25 dark:text-gray-200">
              <li>Open the latest email from Bond Back (not an older one).</li>
              <li>Long-press the link → <strong>Copy</strong>, then paste into Safari or Chrome.</li>
              <li>Or request a new confirmation email below using the same address you signed up with.</li>
            </ul>
          ) : null}

          {isAlreadyUsed ? (
            <p className="text-center text-sm leading-relaxed text-muted-foreground">
              Use <strong className="text-foreground">Log in</strong> with the email and password you registered with.
            </p>
          ) : null}

          {showResendConfirmation ? (
            <AuthConfirmErrorResend initialEmail={optionalEmail ?? ""} />
          ) : null}

          <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Button asChild className="min-h-12 w-full text-base font-semibold sm:flex-1" size="lg">
              <Link href="/signup">Back to sign up</Link>
            </Button>
            <Button asChild variant="outline" className="min-h-12 w-full text-base sm:flex-1" size="lg">
              <Link href="/login">Log in</Link>
            </Button>
          </div>

          <p className="text-center text-sm leading-relaxed text-muted-foreground">
            Already confirmed? Try <Link href="/login" className="font-medium text-primary underline underline-offset-2">Log in</Link>{" "}
            with your email and password.
          </p>
        </CardContent>
      </Card>
    </section>
  );
}
