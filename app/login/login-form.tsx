"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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
});

type LoginValues = z.infer<typeof loginSchema>;

export type LoginFormSearchProps = {
  /** Full query string (no leading `?`) for signup link preservation */
  queryString: string;
  nextParam: string | null;
  bannedParam: string | null;
  bannedReason: string | null;
  messageParam: string | null;
};

export function LoginForm({
  queryString,
  nextParam,
  bannedParam,
  bannedReason,
  messageParam,
}: LoginFormSearchProps) {
  const router = useRouter();
  const supabase = createBrowserSupabaseClient();
  const signupHref = queryString ? `/signup?${queryString}` : "/signup";
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [bannedMessage, setBannedMessage] = useState<string | null>(
    bannedParam === "1"
      ? `Account banned. ${bannedReason ? `Reason: ${decodeURIComponent(bannedReason)}. ` : ""}Contact support@bondback.com.`
      : null
  );
  const [isRedirecting, setIsRedirecting] = useState(false);

  const sanitizedNext = sanitizeInternalNextPath(nextParam);
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
        const next = sanitizeInternalNextPath(nextParam);
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
  }, [nextParam]);

  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const onSubmit = async (values: LoginValues) => {
    setError(null);
    setIsSubmitting(true);

    const email = values.email.trim();
    const password = values.password;

    let didRedirect = false;

    try {
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
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
    } finally {
      if (!didRedirect) {
        setIsSubmitting(false);
      }
    }
  };

  if (isRedirecting) {
    return (
      <section className="page-inner flex min-h-[50vh] flex-col justify-center px-4">
        <Card className="mx-auto w-full max-w-md">
          <CardContent className="flex flex-col items-center justify-center gap-4 py-16">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" aria-hidden />
            <p className="text-sm text-muted-foreground">Signing you in…</p>
          </CardContent>
        </Card>
      </section>
    );
  }

  return (
    <section className="page-inner flex min-h-[70vh] flex-col justify-center px-4 py-8 sm:min-h-[60vh] sm:py-12">
      <Card className="mx-auto w-full max-w-md shadow-sm">
        <CardHeader className="space-y-1 pb-2 sm:pb-4">
          <CardTitle className="text-xl sm:text-2xl">Log in to Bond Back</CardTitle>
          <p className="text-xs text-muted-foreground sm:text-sm">
            One account for listers and cleaners — switch roles anytime after you sign in.
          </p>
        </CardHeader>
        <CardContent className="space-y-6 pt-0">
          <GoogleSignInButton nextPath={googleOAuthNext} />
          <div className="relative">
            <div className="absolute inset-0 flex items-center" aria-hidden>
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase tracking-wide">
              <span className="bg-card px-2 text-muted-foreground">Or continue with email</span>
            </div>
          </div>
          <form className="space-y-4 sm:space-y-5" onSubmit={form.handleSubmit(onSubmit)} noValidate>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                inputMode="email"
                className="min-h-11"
                {...form.register("email")}
              />
              {form.formState.errors.email && (
                <p className="text-xs text-destructive">{form.formState.errors.email.message}</p>
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
                className="min-h-11"
                {...form.register("password")}
              />
              {form.formState.errors.password && (
                <p className="text-xs text-destructive">{form.formState.errors.password.message}</p>
              )}
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

            <Button type="submit" className="min-h-11 w-full" disabled={isSubmitting}>
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
