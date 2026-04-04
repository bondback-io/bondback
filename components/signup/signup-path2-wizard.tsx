"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, type DefaultValues } from "react-hook-form";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Check } from "lucide-react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { finalizePath2Signup } from "@/lib/actions/onboarding";
import { scheduleRouterAction } from "@/lib/deferred-router";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";
import { AuthPageBackLink } from "@/components/auth/auth-page-back-link";
import { GoogleSignInButton } from "@/components/auth/google-sign-in-button";
import { getResolvedAuthEmailRedirectOrigin } from "@/lib/auth/email-redirect-origin";

const signupSchema = z
  .object({
    fullName: z.string().min(1, "Name is required").max(120),
    email: z.string().email("Enter a valid email"),
    password: z.string().min(6, "At least 6 characters"),
    confirmPassword: z.string().min(1, "Confirm your password"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type SignupValues = z.infer<typeof signupSchema>;

const EASE_FLOW = [0.25, 0.1, 0.25, 1] as const;

export function SignupPath2Wizard() {
  const reduceMotion = useReducedMotion();
  const router = useRouter();
  const searchParams = useSearchParams();
  const refParam = searchParams.get("ref")?.trim() || null;

  const [phase, setPhase] = useState<"form" | "success">("form");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [, startTransition] = useTransition();
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
      confirmPassword: "",
      fullName: "",
    } satisfies DefaultValues<SignupValues>,
  });

  const confirmRedirectUrl = `${getResolvedAuthEmailRedirectOrigin()}/auth/confirm`;

  const handleSignup = useCallback(
    async (values: SignupValues) => {
      setError(null);
      startTransition(() => setSubmitting(true));

      const supabase = createBrowserSupabaseClient();

      try {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: values.email.trim(),
          password: values.password,
          options: {
            emailRedirectTo: confirmRedirectUrl,
            data: {
              full_name: values.fullName.trim(),
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
          return;
        }

        const user = data.user;
        if (!user?.id) {
          setError("We could not create your account. Please try again.");
          return;
        }

        const emailForVerify = user.email?.trim() ?? values.email.trim();

        const fin = await finalizePath2Signup({
          userId: user.id,
          email: emailForVerify,
          role: "lister",
          full_name: values.fullName.trim(),
          state: null,
          suburb: null,
          postcode: null,
          referralCode: refParam,
          abn: null,
        });

        if (!fin.ok) {
          setError(fin.error);
          return;
        }

        setPhase("success");

        if (data.session) {
          redirectTimerRef.current = setTimeout(() => {
            redirectTimerRef.current = null;
            scheduleRouterAction(() => router.replace("/dashboard"));
          }, 1100);
        }
      } finally {
        setSubmitting(false);
      }
    },
    [confirmRedirectUrl, refParam, router, startTransition]
  );

  const onSubmit = form.handleSubmit(handleSignup);

  const flowDur = reduceMotion ? 0 : 0.32;

  return (
    <section className="page-inner relative flex min-h-[70vh] flex-col items-center justify-center px-3 py-8">
      <div className="mb-4 w-full max-w-2xl self-center">
        <AuthPageBackLink />
      </div>

      <div className="w-full max-w-2xl space-y-6 transition-[max-width] duration-300 ease-out">
        {phase === "form" && (
          <div className="flex items-center justify-between gap-3 text-sm font-medium">
            <span className="text-muted-foreground">Sign up</span>
            <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold tracking-wide text-primary">
              Bond Back
            </span>
          </div>
        )}

        <AnimatePresence mode="wait">
          {phase === "success" ? (
            <motion.div
              key="success"
              role="status"
              aria-live="polite"
              initial={reduceMotion ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: reduceMotion ? 0 : 0.22, ease: EASE_FLOW }}
              className="flex flex-col items-center gap-6 rounded-2xl border border-border/80 bg-card px-6 py-10 text-center shadow-lg dark:border-gray-800 dark:bg-gray-900"
            >
              <motion.div
                initial={reduceMotion ? false : { opacity: 0, scale: 0.88 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: flowDur, ease: EASE_FLOW }}
                className="flex h-24 w-24 items-center justify-center rounded-full bg-emerald-500/15 ring-4 ring-emerald-500/20"
              >
                <Check className="h-12 w-12 text-emerald-600 dark:text-emerald-400" strokeWidth={2.5} />
              </motion.div>
              <motion.div
                initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: reduceMotion ? 0 : 0.28,
                  delay: reduceMotion ? 0 : 0.1,
                  ease: EASE_FLOW,
                }}
                className="space-y-2"
              >
                <h1 className="text-balance text-2xl font-bold tracking-tight sm:text-3xl">
                  Check your email
                </h1>
                <motion.p
                  initial={reduceMotion ? false : { opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{
                    duration: reduceMotion ? 0 : 0.28,
                    delay: reduceMotion ? 0 : 0.2,
                    ease: EASE_FLOW,
                  }}
                  className="text-pretty text-base text-muted-foreground sm:text-lg"
                >
                  We sent a confirmation link. Open it to verify your email and sign in.
                </motion.p>
              </motion.div>
              <motion.div
                initial={reduceMotion ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{
                  duration: reduceMotion ? 0 : 0.26,
                  delay: reduceMotion ? 0 : 0.28,
                  ease: EASE_FLOW,
                }}
              >
                <Button asChild size="lg" className="min-h-12 w-full max-w-xs text-base font-semibold">
                  <Link href="/login">Back to log in</Link>
                </Button>
              </motion.div>
            </motion.div>
          ) : (
            <motion.div
              key="form"
              initial={reduceMotion ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -6 }}
              transition={{ duration: flowDur, ease: EASE_FLOW }}
            >
              <Card className="relative w-full overflow-visible border-border/80 shadow-lg dark:border-gray-800 dark:bg-gray-900">
                <CardHeader className="space-y-1 pb-4 text-center sm:text-left">
                  <CardTitle className="text-2xl font-bold tracking-tight sm:text-3xl">
                    Create your account
                  </CardTitle>
                  <CardDescription className="text-base text-muted-foreground">
                    Enter your details. We&apos;ll email you a link to confirm your account.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <GoogleSignInButton
                    variant="signup"
                    nextPath="/onboarding/google-complete"
                    referralCode={refParam}
                  />
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center" aria-hidden>
                      <span className="w-full border-t border-border" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-card px-2 text-muted-foreground">Or sign up with email</span>
                    </div>
                  </div>

                  <form className="space-y-6" onSubmit={onSubmit} noValidate>
                    {error && (
                      <Alert variant="destructive" className="text-sm">
                        {error}
                      </Alert>
                    )}

                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="su-fullName" className="text-base">
                          Full name
                        </Label>
                        <Input
                          id="su-fullName"
                          autoComplete="name"
                          className="min-h-12 text-base"
                          {...form.register("fullName")}
                        />
                        {form.formState.errors.fullName && (
                          <p className="text-sm text-destructive">{form.formState.errors.fullName.message}</p>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="su-email" className="text-base">
                          Email
                        </Label>
                        <Input
                          id="su-email"
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
                        <Label htmlFor="su-password" className="text-base">
                          Password
                        </Label>
                        <Input
                          id="su-password"
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
                        <Label htmlFor="su-confirmPassword" className="text-base">
                          Confirm password
                        </Label>
                        <Input
                          id="su-confirmPassword"
                          type="password"
                          autoComplete="new-password"
                          className="min-h-12 text-base"
                          {...form.register("confirmPassword")}
                        />
                        {form.formState.errors.confirmPassword && (
                          <p className="text-sm text-destructive">
                            {form.formState.errors.confirmPassword.message}
                          </p>
                        )}
                      </div>
                    </div>

                    <Button
                      type="submit"
                      className="min-h-12 w-full text-base font-semibold"
                      size="lg"
                      disabled={submitting}
                    >
                      {submitting ? "Creating account…" : "Create account"}
                    </Button>

                    <p className="text-center text-sm text-muted-foreground">
                      <Link href="/forgot-password" className="font-medium text-primary underline underline-offset-2">
                        Forgot password?
                      </Link>
                    </p>
                  </form>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </section>
  );
}
