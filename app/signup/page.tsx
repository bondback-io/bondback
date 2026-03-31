"use client";

/**
 * ============================================================================
 * BOND BACK — SINGLE SIGN-UP (Airtasker-style)
 * ============================================================================
 * SUMMARY
 * - One form: email, password, full name, postcode.
 * - With session (instant / dev): upsert minimal profile `roles: []` → `/onboarding/role-choice`.
 * - Email-confirm flow: stash name/postcode in localStorage; after confirm + login,
 *   `PendingProfileSync` on role-choice runs the same minimal upsert.
 *
 * FLOW (high level)
 *   /signup → Supabase signUp → minimal profile (roles []) → /onboarding/role-choice
 *   → saveRoleChoice → /onboarding/{lister|cleaner}/quick-setup → dashboards
 *
 *   [See role-choice + quick-setup pages for ASCII diagram comments.]
 * ============================================================================
 */

import { Suspense, useEffect, useRef, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { upsertMinimalProfileAfterSignup } from "@/lib/actions/onboarding";
import { scheduleRouterAction } from "@/lib/deferred-router";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";
import {
  AccountCreationProgressModal,
  SIGNUP_ACCOUNT_STEPS_EMAIL,
  SIGNUP_ACCOUNT_STEPS_SESSION,
  type AccountCreationProgressPhase,
  type AccountCreationStep,
} from "@/components/auth/account-creation-progress-modal";
import { GoogleSignInButton } from "@/components/auth/google-sign-in-button";
import { useToast } from "@/components/ui/use-toast";
import { PENDING_MINIMAL_PROFILE_KEY } from "@/components/onboarding/onboarding-storage";

const signupSchema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(6, "At least 6 characters"),
  fullName: z.string().min(1, "Name is required").max(120),
  postcode: z
    .string()
    .max(10)
    .optional()
    .or(z.literal("")),
});

type SignupValues = z.infer<typeof signupSchema>;

function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const refParam = searchParams.get("ref")?.trim() || null;

  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [, startSignupTransition] = useTransition();

  const [accountModalOpen, setAccountModalOpen] = useState(false);
  const [accountPhase, setAccountPhase] = useState<AccountCreationProgressPhase>("running");
  const [accountProgress, setAccountProgress] = useState(0);
  const [accountStepId, setAccountStepId] = useState<string>("auth");
  const [accountSteps, setAccountSteps] = useState<readonly AccountCreationStep[]>(SIGNUP_ACCOUNT_STEPS_SESSION);
  const redirectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (redirectTimerRef.current) clearTimeout(redirectTimerRef.current);
    };
  }, []);

  const form = useForm<SignupValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      email: "",
      password: "",
      fullName: "",
      postcode: "",
    },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    setError(null);
    setInfo(null);
    startSignupTransition(() => setSubmitting(true));

    if (redirectTimerRef.current) {
      clearTimeout(redirectTimerRef.current);
      redirectTimerRef.current = null;
    }

    setAccountSteps(SIGNUP_ACCOUNT_STEPS_SESSION);
    setAccountPhase("running");
    setAccountProgress(6);
    setAccountStepId("auth");
    setAccountModalOpen(true);

    const supabase = createBrowserSupabaseClient();
    const postcode = values.postcode?.trim() || null;

    try {
      setAccountProgress(18);
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: values.email.trim(),
        password: values.password,
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
            ? "Too many signup emails were sent recently. Try again in about an hour or use a different email."
            : signUpError.message
        );
        setAccountModalOpen(false);
        setSubmitting(false);
        return;
      }

      const pendingPayload = {
        full_name: values.fullName.trim(),
        postcode,
        referralCode: refParam,
      };

      if (data.session) {
        setAccountStepId("profile");
        setAccountProgress(44);
        const result = await upsertMinimalProfileAfterSignup({
          full_name: pendingPayload.full_name,
          postcode: pendingPayload.postcode,
          referralCode: pendingPayload.referralCode,
        });
        if (!result.ok) {
          setError(result.error);
          setAccountPhase("error");
          setSubmitting(false);
          return;
        }
        setAccountStepId("finalizing");
        setAccountProgress(96);
        setAccountProgress(100);
        setAccountPhase("success");
        redirectTimerRef.current = setTimeout(() => {
          redirectTimerRef.current = null;
          setAccountModalOpen(false);
          setAccountPhase("running");
          scheduleRouterAction(() => router.replace("/onboarding/role-choice"));
        }, 1100);
        return;
      }

      setAccountSteps(SIGNUP_ACCOUNT_STEPS_EMAIL);
      setAccountStepId("email");
      setAccountProgress(52);

      try {
        localStorage.setItem(PENDING_MINIMAL_PROFILE_KEY, JSON.stringify(pendingPayload));
      } catch {
        /* ignore quota */
      }

      setAccountStepId("finalizing");
      setAccountProgress(100);
      const confirmMsg =
        "We sent a confirmation link. After you verify your email and log in, continue to choose Lister or Cleaner.";
      setTimeout(() => {
        setAccountModalOpen(false);
        setAccountPhase("running");
        setInfo(confirmMsg);
        toast({
          title: "Check your email",
          description: confirmMsg,
        });
      }, 450);
    } finally {
      setSubmitting(false);
    }
  });

  return (
    <section className="page-inner flex min-h-[70vh] flex-col items-center justify-center px-3 py-8">
      <AccountCreationProgressModal
        open={accountModalOpen}
        onOpenChange={(next) => {
          if (!next && (accountPhase === "running" || accountPhase === "success")) {
            return;
          }
          setAccountModalOpen(next);
          if (!next) {
            setAccountProgress(0);
            setAccountStepId("auth");
          }
        }}
        phase={accountPhase}
        progress={accountProgress}
        steps={accountSteps}
        activeStepId={accountStepId}
        titleRunning="Creating your Bond Back account…"
        subtitleRunning="Sit tight — we’re setting up your sign-in and profile."
        successTitle="Account ready"
        successSubtitle="Taking you to choose Lister or Cleaner…"
        errorMessage={accountPhase === "error" ? error : null}
        onRetry={() => {
          setAccountPhase("running");
          setError(null);
          setAccountProgress(6);
          setAccountStepId("auth");
          setAccountSteps(SIGNUP_ACCOUNT_STEPS_SESSION);
          void onSubmit();
        }}
      />
      <Card className="relative w-full max-w-md border-border/80 shadow-lg dark:border-gray-800 dark:bg-gray-900">
        <CardHeader className="space-y-1 pb-4 text-center sm:text-left">
          <CardTitle className="text-2xl font-bold tracking-tight sm:text-3xl">
            Create your account
          </CardTitle>
          <CardDescription className="text-base text-muted-foreground">
            One account — choose Lister or Cleaner next. You can unlock the other role later.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <GoogleSignInButton variant="signup" referralCode={refParam} />
          <div className="relative">
            <div className="absolute inset-0 flex items-center" aria-hidden>
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">Or sign up with email</span>
            </div>
          </div>
          <form className="space-y-4" onSubmit={onSubmit}>
            {error && (
              <Alert variant="destructive" className="text-sm">
                {error}
              </Alert>
            )}
            {info && (
              <Alert className="border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-100">
                {info}
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="fullName" className="text-base">
                Full name
              </Label>
              <Input
                id="fullName"
                autoComplete="name"
                className="min-h-12 text-base"
                {...form.register("fullName")}
              />
              {form.formState.errors.fullName && (
                <p className="text-sm text-destructive">{form.formState.errors.fullName.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="email" className="text-base">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                className="min-h-12 text-base"
                {...form.register("email")}
              />
              {form.formState.errors.email && (
                <p className="text-sm text-destructive">{form.formState.errors.email.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-base">
                Password
              </Label>
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                className="min-h-12 text-base"
                {...form.register("password")}
              />
              {form.formState.errors.password && (
                <p className="text-sm text-destructive">{form.formState.errors.password.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="postcode" className="text-base">
                Postcode
              </Label>
              <Input
                id="postcode"
                autoComplete="postal-code"
                inputMode="numeric"
                className="min-h-12 text-base"
                placeholder="e.g. 2000"
                {...form.register("postcode")}
              />
              {form.formState.errors.postcode && (
                <p className="text-sm text-destructive">{form.formState.errors.postcode.message}</p>
              )}
            </div>

            <Button
              type="submit"
              size="lg"
              className="mt-2 w-full min-h-12 text-base font-semibold"
              disabled={submitting}
            >
              {submitting ? "Creating account…" : "Sign up"}
            </Button>

            <p className="text-center text-sm text-muted-foreground">
              Already have an account?{" "}
              <Link href="/login" className="font-medium text-primary underline underline-offset-2">
                Log in
              </Link>
            </p>
            <p className="text-center text-sm text-muted-foreground">
              <Link href="/forgot-password" className="font-medium text-primary underline underline-offset-2">
                Forgot password?
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </section>
  );
}

export default function SignupPage() {
  return (
    <Suspense
      fallback={
        <div className="page-inner flex min-h-[50vh] items-center justify-center text-muted-foreground">
          Loading…
        </div>
      }
    >
      <SignupForm />
    </Suspense>
  );
}
