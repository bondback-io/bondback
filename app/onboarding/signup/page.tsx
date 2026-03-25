"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { completeOnboardingFromSignup, type OnboardingDetailsInput } from "@/lib/actions/onboarding";
import {
  getOnboardingRole,
  getOnboardingDetails,
  clearOnboarding,
  getPendingReferralCode,
  setPendingReferralCode,
} from "@/components/onboarding/onboarding-storage";

function OnboardingSignupInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const ref = searchParams.get("ref");
    if (ref?.trim()) setPendingReferralCode(ref);
  }, [searchParams]);

  const [status, setStatus] = useState<"loading" | "form" | "completing">("loading");

  useEffect(() => {
    if (!mounted) return;
    const role = getOnboardingRole();
    const details = getOnboardingDetails();
    if (!role || !details?.full_name?.trim()) {
      router.replace("/onboarding/role-choice");
      return;
    }
    const supabase = createBrowserSupabaseClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setStatus("completing");
        completeOnboardingFromSignup(role, details as OnboardingDetailsInput, {
          referralCode: getPendingReferralCode(),
        }).then((result) => {
          if (result.ok) {
            clearOnboarding();
            router.replace("/dashboard");
          } else {
            setError(result.error);
            setStatus("form");
          }
        });
      } else {
        setStatus("form");
      }
    });
  }, [mounted, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    const role = getOnboardingRole();
    const details = getOnboardingDetails();
    if (!role || !details) {
      setError("Missing onboarding details. Please start from role choice.");
      return;
    }
    if (!email.trim()) {
      setError("Email is required.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);
    const supabase = createBrowserSupabaseClient();

    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (signUpError) {
        const isEmailRateLimit =
          signUpError.message?.toLowerCase().includes("rate limit") ||
          (signUpError as { code?: string }).code === "over_email_send_rate_limit";
        setError(
          isEmailRateLimit
            ? "Too many signup emails were sent recently. Please try again in about an hour, or use a different email address."
            : signUpError.message
        );
        setLoading(false);
        return;
      }

      if (data.session) {
        const result = await completeOnboardingFromSignup(role, details as OnboardingDetailsInput, {
          referralCode: getPendingReferralCode(),
        });
        clearOnboarding();
        if (result.ok) {
          router.replace("/dashboard");
          return;
        }
        setError(result.error);
        setLoading(false);
        return;
      }

      setMessage(
        "Check your email to confirm your account. After confirming, you'll be signed in and taken to your dashboard."
      );
    } finally {
      setLoading(false);
    }
  };

  if (!mounted || status === "loading" || status === "completing") {
    return (
      <section className="page-inner flex justify-center">
        <div className="text-muted-foreground dark:text-gray-400">
          {status === "completing" ? "Completing your profile…" : "Loading…"}
        </div>
      </section>
    );
  }

  return (
    <section className="page-inner flex justify-center">
      <Card className="w-full max-w-md border-border dark:border-gray-800 dark:bg-gray-900">
        <CardHeader className="space-y-1">
          <CardTitle className="text-xl dark:text-gray-100">Create your account</CardTitle>
          <CardDescription className="text-sm dark:text-gray-400">
            Enter your email and password. Your details are already saved.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="dark:text-gray-200">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="dark:text-gray-200">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 6 characters"
                minLength={6}
                className="dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100"
              />
            </div>
            {error && (
              <p className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive dark:border-red-800 dark:bg-red-950/40 dark:text-red-200">
                {error}
              </p>
            )}
            {message && (
              <p className="text-sm text-muted-foreground dark:text-gray-400">{message}</p>
            )}
            <Button type="submit" className="w-full dark:bg-gray-800 dark:hover:bg-gray-700" disabled={loading}>
              {loading ? "Creating account…" : "Create account"}
            </Button>
          </form>
          <p className="mt-4 text-center text-sm text-muted-foreground dark:text-gray-400">
            Already have an account?{" "}
            <Link href="/login" className="font-medium text-primary underline underline-offset-2">
              Log in
            </Link>
          </p>
          <p className="mt-2 text-center text-sm text-muted-foreground dark:text-gray-400">
            <Link href="/forgot-password" className="font-medium text-primary underline underline-offset-2">
              Forgot password?
            </Link>
          </p>
        </CardContent>
      </Card>
    </section>
  );
}

export default function OnboardingSignupPage() {
  return (
    <Suspense
      fallback={
        <section className="page-inner flex justify-center">
          <div className="text-muted-foreground dark:text-gray-400">Loading…</div>
        </section>
      }
    >
      <OnboardingSignupInner />
    </Suspense>
  );
}
