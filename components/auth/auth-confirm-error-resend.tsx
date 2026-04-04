"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Mail } from "lucide-react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import {
  CANONICAL_AUTH_PUBLIC_ORIGIN,
  getClientAuthEmailRedirectOrigin,
} from "@/lib/auth/email-redirect-origin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Absolute URL for `emailRedirectTo` — must work during SSR (no `window`) and in the browser.
 * Empty origin + `new URL("/auth/confirm")` is invalid and breaks Supabase resend validation.
 */
function buildAuthConfirmRedirectUrl(): string {
  let origin = getClientAuthEmailRedirectOrigin();
  if (!origin) {
    const explicit = process.env.NEXT_PUBLIC_APP_URL?.trim();
    if (explicit) {
      try {
        origin = new URL(explicit.replace(/\/$/, "")).origin;
      } catch {
        origin = CANONICAL_AUTH_PUBLIC_ORIGIN;
      }
    } else {
      origin = CANONICAL_AUTH_PUBLIC_ORIGIN;
    }
  }
  const u = new URL(`${origin}/auth/confirm`);
  u.searchParams.set("next", "/dashboard");
  return u.toString();
}

export type AuthConfirmErrorResendProps = {
  /** Optional prefill from `?email=` (decoded). */
  initialEmail?: string;
};

/**
 * One resend per page visit after success (button disabled) so users can get a fresh confirmation
 * link if the first expired or the tab was closed mid-flow.
 */
export function AuthConfirmErrorResend({ initialEmail = "" }: AuthConfirmErrorResendProps) {
  const [email, setEmail] = useState(initialEmail.trim());
  const [loading, setLoading] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const [sentOnce, setSentOnce] = useState(false);

  useEffect(() => {
    setEmail(initialEmail.trim());
  }, [initialEmail]);

  const handleResend = useCallback(async () => {
    const trimmed = email.trim();
    if (!trimmed || sentOnce) return;
    setHint(null);
    setLoading(true);
    try {
      /** Build at click time so `window` + env always produce a valid allowlisted URL for Supabase. */
      const emailRedirectTo = buildAuthConfirmRedirectUrl();
      const supabase = createBrowserSupabaseClient();
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: trimmed,
        options: { emailRedirectTo },
      });
      if (error) {
        setHint(error.message);
        return;
      }
      setSentOnce(true);
      setHint("We sent a new confirmation link. Check your inbox and spam folder, then open the latest email.");
    } catch (e) {
      setHint(e instanceof Error ? e.message : "Something went wrong. Try again in a moment.");
    } finally {
      setLoading(false);
    }
  }, [email, sentOnce]);

  return (
    <div className="space-y-4 rounded-xl border border-primary/25 bg-primary/[0.04] px-4 py-4 dark:border-primary/30 dark:bg-primary/[0.06]">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary dark:bg-sky-500/20 dark:text-sky-300">
          <Mail className="h-5 w-5" aria-hidden />
        </span>
        <div className="min-w-0 space-y-1">
          <p className="text-sm font-semibold text-foreground dark:text-gray-100">Need a fresh link?</p>
          <p className="text-sm leading-relaxed text-muted-foreground dark:text-gray-400">
            Enter the email you used to sign up. We&apos;ll send <span className="font-medium text-foreground/90">one</span>{" "}
            new confirmation email so you can continue onboarding.
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="auth-confirm-resend-email" className="text-sm font-medium">
          Email address
        </Label>
        <Input
          id="auth-confirm-resend-email"
          type="email"
          name="email"
          autoComplete="email"
          inputMode="email"
          placeholder="you@example.com"
          value={email}
          disabled={sentOnce}
          onChange={(e) => setEmail(e.target.value)}
          className="min-h-12 text-base"
        />
      </div>

      <Button
        type="button"
        className="min-h-12 w-full text-base font-semibold"
        size="lg"
        disabled={loading || sentOnce || !email.trim()}
        onClick={() => void handleResend()}
      >
        {loading ? (
          <>
            <Loader2 className="mr-2 h-5 w-5 shrink-0 animate-spin" aria-hidden />
            Sending…
          </>
        ) : sentOnce ? (
          "Confirmation sent"
        ) : (
          "Send new confirmation email"
        )}
      </Button>

      {hint ? (
        <p
          role="status"
          className="text-center text-sm font-medium leading-relaxed text-foreground dark:text-gray-200"
        >
          {hint}
        </p>
      ) : null}
    </div>
  );
}
