"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";
import { checkBanAfterLogin } from "@/lib/actions/admin-users";
import { scheduleRouterAction } from "@/lib/deferred-router";
import { GoogleSignInButton } from "@/components/auth/google-sign-in-button";
import { sanitizeInternalNextPath } from "@/lib/safe-redirect";
import {
  fetchPostLoginDestination,
  shouldUseRoleBasedPostLogin,
  waitForSupabaseSessionReady,
} from "@/lib/auth/client-post-login";

const loginSchema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
  useMagicLink: z.boolean().default(false)
});

type LoginValues = z.infer<typeof loginSchema>;

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createBrowserSupabaseClient();
  const signupHref = searchParams.toString() ? `/signup?${searchParams.toString()}` : "/signup";
  const bannedParam = searchParams.get("banned");
  const bannedReason = searchParams.get("reason") ?? null;
  const messageParam = searchParams.get("message");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [bannedMessage, setBannedMessage] = useState<string | null>(
    bannedParam === "1"
      ? `Account banned. ${bannedReason ? `Reason: ${decodeURIComponent(bannedReason)}. ` : ""}Contact support@bondback.com.`
      : null
  );
  const [isRedirecting, setIsRedirecting] = useState(false);

  const sanitizedNext = sanitizeInternalNextPath(searchParams.get("next"));
  /** OAuth callback applies `getPostLoginDashboardPath` when `next` is `/dashboard`; avoid `next=/login` loops. */
  const googleOAuthNext = shouldUseRoleBasedPostLogin(sanitizedNext) ? "/dashboard" : sanitizedNext;

  /** Already signed in (e.g. back button, bookmark) — send to role dashboard or preserved `next`. */
  useEffect(() => {
    let cancelled = false;
    const sb = createBrowserSupabaseClient();

    async function run() {
      const {
        data: { session },
      } = await sb.auth.getSession();
      if (cancelled || !session?.user) return;

      setIsRedirecting(true);
      try {
        const path = await fetchPostLoginDestination(sb, session.user.id);
        const next = sanitizeInternalNextPath(searchParams.get("next"));
        const dest = shouldUseRoleBasedPostLogin(next) ? path : next;
        await sb.auth.getSession();
        window.location.assign(dest);
      } catch {
        if (!cancelled) setIsRedirecting(false);
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [searchParams]);

  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
      useMagicLink: false
    }
  });

  const onSubmit = async (values: LoginValues) => {
    setError(null);
    setMessage(null);
    setIsSubmitting(true);

    const email = values.email.trim();
    const password = values.password;

    let didRedirect = false;

    try {
      if (values.useMagicLink) {
        const { error: otpError } = await supabase.auth.signInWithOtp({
          email,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback`
          }
        });

        if (otpError) {
          setError(otpError.message);
        } else {
          setMessage(
            "Check your email for a magic link to log in. You'll be taken back to your dashboard."
          );
        }
      } else {
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password
        });

        if (signInError) {
          setError(signInError.message);
        } else {
          const banCheck = await checkBanAfterLogin();
          if (banCheck.banned) {
            await supabase.auth.signOut();
            const reason = banCheck.reason ? encodeURIComponent(banCheck.reason) : "";
            scheduleRouterAction(() =>
              router.replace(`/login?banned=1${reason ? `&reason=${reason}` : ""}`)
            );
            setBannedMessage(
              `Account banned. ${banCheck.reason ? `Reason: ${banCheck.reason}. ` : ""}Contact support@bondback.com.`
            );
            return;
          }

          didRedirect = true;
          setIsRedirecting(true);

          if (!signInData.session) {
            try {
              await waitForSupabaseSessionReady(supabase);
            } catch {
              setError("Could not establish a session. Please try again.");
              setIsRedirecting(false);
              didRedirect = false;
              return;
            }
          }

          const {
            data: { session: established },
          } = await supabase.auth.getSession();
          const userId = established?.user?.id;
          if (!userId) {
            setError("Could not establish a session. Please try again.");
            setIsRedirecting(false);
            didRedirect = false;
            return;
          }

          const path = await fetchPostLoginDestination(supabase, userId);
          const dest = shouldUseRoleBasedPostLogin(sanitizedNext) ? path : sanitizedNext;

          /**
           * Ensure SSR-readable cookies are flushed before the next document load. Client-only
           * `router.replace` can race the first RSC request and surface a broken shell on Vercel.
           */
          await supabase.auth.getSession();
          window.location.assign(dest);
          return;
        }
      }
    } finally {
      if (!didRedirect) {
        setIsSubmitting(false);
      }
    }
  };

  if (isRedirecting) {
    return (
      <section className="page-inner flex justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center justify-center gap-4 py-16">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" aria-hidden />
            <p className="text-sm text-muted-foreground">Signing you in…</p>
          </CardContent>
        </Card>
      </section>
    );
  }

  return (
    <section className="page-inner flex justify-center">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle>Log in to Bond Back</CardTitle>
          <p className="text-xs text-muted-foreground">
            One account for listers and cleaners — switch roles anytime after you sign in.
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          <GoogleSignInButton
            nextPath={googleOAuthNext}
          />
          <div className="relative">
            <div className="absolute inset-0 flex items-center" aria-hidden>
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">Or</span>
            </div>
          </div>
          <form
            className="space-y-5"
            onSubmit={form.handleSubmit(onSubmit)}
            noValidate
          >
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                {...form.register("email")}
              />
              {form.formState.errors.email && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.email.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="password">Password</Label>
                <Link
                  href="/forgot-password"
                  className="text-xs font-medium text-primary underline underline-offset-2"
                >
                  Forgot password?
                </Link>
              </div>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                {...form.register("password")}
              />
              {form.formState.errors.password && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.password.message}
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                Or tick &quot;Use magic link&quot; below to log in via email
                only.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <input
                id="useMagicLink"
                type="checkbox"
                className="h-4 w-4 rounded border border-input"
                {...form.register("useMagicLink")}
              />
              <Label htmlFor="useMagicLink">Use magic link instead</Label>
            </div>

            {bannedMessage && (
              <Alert variant="destructive" className="text-xs">
                {bannedMessage}
              </Alert>
            )}
            {messageParam === "password-reset" && (
              <Alert variant="success" className="text-xs">
                Password updated. Log in with your new password.
              </Alert>
            )}
            {error && <p className="text-xs text-destructive">{error}</p>}
            {message && (
              <p className="text-xs text-muted-foreground">{message}</p>
            )}

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? "Logging in..." : "Log in"}
            </Button>

            <p className="text-center text-sm text-muted-foreground">
              Don&apos;t have an account?{" "}
              <Link href={signupHref} className="text-primary underline underline-offset-2">
                Sign up
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </section>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<section className="page-inner flex justify-center"><div className="text-muted-foreground">Loading...</div></section>}>
      <LoginForm />
    </Suspense>
  );
}

