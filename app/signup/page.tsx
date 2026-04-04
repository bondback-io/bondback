"use client";

/**
 * ============================================================================
 * BOND BACK — SINGLE SIGN-UP (Airtasker-style)
 * ============================================================================
 * SUMMARY
 * - One form: email, password, confirm password, full name, suburb, postcode (suburb/postcode prefilled from cache or location when possible).
 * - With session (instant / dev): upsert minimal profile `roles: []` → `/onboarding/role-choice`.
 * - Email-confirm flow: stash name/suburb/postcode in localStorage; after confirm + login,
 *   `PendingProfileSync` on role-choice runs the same minimal upsert.
 *
 * FLOW (high level)
 *   /signup → Supabase signUp → minimal profile (roles []) → /onboarding/role-choice
 *   → saveRoleChoice → /onboarding/{lister|cleaner}/quick-setup → dashboards
 *
 *   [See role-choice + quick-setup pages for ASCII diagram comments.]
 * ============================================================================
 */

import { Suspense, useCallback, useEffect, useRef, useState, useTransition } from "react";
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
import { AuthPageBackLink } from "@/components/auth/auth-page-back-link";
import { GoogleSignInButton } from "@/components/auth/google-sign-in-button";
import { RegistrationCheckEmailModal } from "@/components/auth/registration-check-email-modal";
import { PENDING_MINIMAL_PROFILE_KEY } from "@/components/onboarding/onboarding-storage";
import { getClientAuthEmailRedirectOrigin } from "@/lib/auth/email-redirect-origin";
import {
  loadCachedSignupLocation,
  reverseGeocodeAuForSignupPrefill,
  saveCachedSignupLocation,
} from "@/lib/location/signup-location-prefill";
import { SuburbPostcodeAutocomplete } from "@/components/features/suburb-postcode-autocomplete";

/** Email confirmation links open `/auth/confirm` (GET route verifies token and redirects). */
function buildAuthConfirmUrl(origin: string, ref: string | null): string {
  const u = new URL(`${origin}/auth/confirm`);
  u.searchParams.set("next", "/dashboard");
  if (ref) u.searchParams.set("ref", ref);
  return u.toString();
}

const signupSchema = z
  .object({
    email: z.string().email("Enter a valid email"),
    password: z.string().min(6, "At least 6 characters"),
    confirmPassword: z.string().min(1, "Confirm your password"),
    fullName: z.string().min(1, "Name is required").max(120),
    suburb: z.string().max(120).optional().or(z.literal("")),
    postcode: z
      .string()
      .max(10)
      .optional()
      .or(z.literal("")),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type SignupValues = z.infer<typeof signupSchema>;

function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const refParam = searchParams.get("ref")?.trim() || null;

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [, startSignupTransition] = useTransition();

  const [accountModalOpen, setAccountModalOpen] = useState(false);
  const [accountPhase, setAccountPhase] = useState<AccountCreationProgressPhase>("running");
  const [accountProgress, setAccountProgress] = useState(0);
  const [accountStepId, setAccountStepId] = useState<string>("auth");
  const [accountSteps, setAccountSteps] = useState<readonly AccountCreationStep[]>(SIGNUP_ACCOUNT_STEPS_SESSION);
  const redirectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [checkEmailOpen, setCheckEmailOpen] = useState(false);
  const [pendingConfirmEmail, setPendingConfirmEmail] = useState("");
  const [authConfirmRedirectUrl, setAuthConfirmRedirectUrl] = useState("");

  const handleCheckEmailOpenChange = useCallback(
    (next: boolean) => {
      setCheckEmailOpen(next);
      if (!next) {
        scheduleRouterAction(() => router.replace("/login"));
      }
    },
    [router]
  );

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
      confirmPassword: "",
      fullName: "",
      suburb: "",
      postcode: "",
    },
  });

  const formRef = useRef(form);
  formRef.current = form;

  useEffect(() => {
    let cancelled = false;
    const opts = { shouldDirty: false, shouldTouch: false } as const;

    const sync = async () => {
      const { setValue, getValues } = formRef.current;

      const cached = loadCachedSignupLocation();
      if (cached?.postcode?.trim()) {
        setValue("postcode", cached.postcode.trim(), opts);
      }
      if (cached?.suburb?.trim()) {
        setValue("suburb", cached.suburb.trim(), opts);
      }

      const needPostcode = !getValues("postcode")?.trim();
      const needSuburb = !getValues("suburb")?.trim();
      if (!needPostcode && !needSuburb) return;

      const geo = await reverseGeocodeAuForSignupPrefill();
      if (cancelled || !geo) return;

      if (geo.postcode && !getValues("postcode")?.trim()) {
        setValue("postcode", geo.postcode, opts);
      }
      if (geo.suburb && !getValues("suburb")?.trim()) {
        setValue("suburb", geo.suburb, opts);
      }
    };

    void sync();
    return () => {
      cancelled = true;
    };
  }, []);

  const onSubmit = form.handleSubmit(async (values) => {
    setError(null);
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
    const suburb = values.suburb?.trim() || null;
    const confirmUrl = buildAuthConfirmUrl(getClientAuthEmailRedirectOrigin(), refParam);

    try {
      setAccountProgress(18);
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: values.email.trim(),
        password: values.password,
        options: {
          emailRedirectTo: confirmUrl,
          data: {
            full_name: values.fullName.trim(),
            suburb: suburb ?? "",
            postcode: postcode ?? "",
          },
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
        suburb,
        postcode,
        referralCode: refParam,
      };

      if (data.session) {
        setAccountStepId("profile");
        setAccountProgress(44);
        const result = await upsertMinimalProfileAfterSignup({
          full_name: pendingPayload.full_name,
          suburb: pendingPayload.suburb,
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

      saveCachedSignupLocation(values.postcode ?? "", values.suburb ?? "");

      setAccountStepId("finalizing");
      setAccountProgress(100);
      setPendingConfirmEmail(values.email.trim());
      setAuthConfirmRedirectUrl(confirmUrl);
      setTimeout(() => {
        setAccountModalOpen(false);
        setAccountPhase("running");
        setCheckEmailOpen(true);
      }, 450);
    } finally {
      setSubmitting(false);
    }
  });

  return (
    <section className="page-inner flex min-h-[70vh] flex-col items-center justify-center px-3 py-8">
      <div className="mb-4 w-full max-w-md self-center">
        <AuthPageBackLink />
      </div>
      <RegistrationCheckEmailModal
        open={checkEmailOpen}
        onOpenChange={handleCheckEmailOpenChange}
        email={pendingConfirmEmail}
        emailRedirectTo={authConfirmRedirectUrl}
      />
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
      <Card className="relative w-full max-w-md overflow-visible border-border/80 shadow-lg dark:border-gray-800 dark:bg-gray-900">
        <CardHeader className="space-y-1 pb-4 text-center sm:text-left">
          <CardTitle className="text-2xl font-bold tracking-tight sm:text-3xl">
            Create your account
          </CardTitle>
          <CardDescription className="text-base text-muted-foreground">
            One account — choose Lister or Cleaner next. You can unlock the other role later.
          </CardDescription>
          <Link
            href="/signup/combined"
            className="mt-4 flex min-h-[3rem] w-full items-center justify-center rounded-xl border border-primary/40 bg-primary/[0.07] px-4 py-3 text-center text-sm font-semibold text-primary transition-colors hover:bg-primary/10 dark:border-primary/35 dark:bg-primary/10"
          >
            Recommended: sign up + choose role in one smooth flow
          </Link>
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
              <Label htmlFor="confirmPassword" className="text-base">
                Confirm password
              </Label>
              <Input
                id="confirmPassword"
                type="password"
                autoComplete="new-password"
                className="min-h-12 text-base"
                {...form.register("confirmPassword")}
              />
              {form.formState.errors.confirmPassword && (
                <p className="text-sm text-destructive">{form.formState.errors.confirmPassword.message}</p>
              )}
            </div>

            <div className="relative z-10 overflow-visible">
              <SuburbPostcodeAutocomplete
                hideStateSelect
                stateValue=""
                onStateChange={() => {}}
                suburbValue={form.watch("suburb") ?? ""}
                postcodeValue={form.watch("postcode") ?? ""}
                onSuburbPostcodeChange={(suburb, postcode) => {
                  form.setValue("suburb", suburb, {
                    shouldValidate: true,
                    shouldDirty: true,
                  });
                  form.setValue("postcode", postcode, {
                    shouldValidate: true,
                    shouldDirty: true,
                  });
                }}
                id="signup-suburb"
                label="Where are you based?"
                suburbPlaceholder="Type suburb or postcode (e.g. 2000 or Surry)"
                error={
                  form.formState.errors.suburb?.message ||
                  form.formState.errors.postcode?.message ||
                  undefined
                }
              />
              <p className="mt-2 text-xs text-muted-foreground">
                Choose a suggestion to set suburb and postcode, or type manually. We may prefill from your
                location; last values are remembered on this device.
              </p>
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
