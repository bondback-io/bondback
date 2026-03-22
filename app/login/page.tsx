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
  const role = searchParams.get("role");
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
            router.replace(`/login?banned=1${reason ? `&reason=${reason}` : ""}`);
            setBannedMessage(
              `Account banned. ${banCheck.reason ? `Reason: ${banCheck.reason}. ` : ""}Contact support@bondback.com.`
            );
            return;
          }
          const next = searchParams.get("next") ?? "/dashboard";
          router.replace(next);
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
          {role === "cleaner" ? (
            <>
              <CardTitle className="text-lg font-semibold text-emerald-700">
                Cleaner Login
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Not a cleaner?{" "}
                <Link
                  href="/login?role=lister"
                  className="font-medium text-sky-700 underline underline-offset-2"
                >
                  Lister login
                </Link>
              </p>
            </>
          ) : role === "lister" ? (
            <>
              <CardTitle className="text-lg font-semibold text-sky-700">
                Lister Login
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Not a lister?{" "}
                <Link
                  href="/login?role=cleaner"
                  className="font-medium text-emerald-700 underline underline-offset-2"
                >
                  Cleaner login
                </Link>
              </p>
            </>
          ) : (
            <CardTitle>Log in to Bond Back</CardTitle>
          )}
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

