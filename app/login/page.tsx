"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";
import { checkBanAfterLogin } from "@/lib/actions/admin-users";
import { scheduleRouterAction } from "@/lib/deferred-router";

const loginSchema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
  useMagicLink: z.boolean().default(false)
});

type LoginValues = z.infer<typeof loginSchema>;

/** Internal path + optional query only (avoid open redirects). */
function safeNextDestination(raw: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return "/dashboard";
  return raw;
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createBrowserSupabaseClient();
  const signupHref = searchParams.toString() ? `/signup?${searchParams.toString()}` : "/signup";
  const bannedParam = searchParams.get("banned");
  const bannedReason = searchParams.get("reason") ?? null;
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [bannedMessage, setBannedMessage] = useState<string | null>(
    bannedParam === "1"
      ? `Account banned. ${bannedReason ? `Reason: ${decodeURIComponent(bannedReason)}. ` : ""}Contact support@bondback.com.`
      : null
  );

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
        const { error: signInError } = await supabase.auth.signInWithPassword({
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
          const next = safeNextDestination(searchParams.get("next"));
          // Defer navigation so App Router is initialized (avoids double dispatch with refresh+replace).
          scheduleRouterAction(() => router.replace(next));
          return;
        }
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="page-inner flex justify-center">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle>Log in to Bond Back</CardTitle>
          <p className="text-xs text-muted-foreground">
            One account for listers and cleaners — switch roles anytime after you sign in.
          </p>
        </CardHeader>
        <CardContent>
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
              <Label htmlFor="password">Password</Label>
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

