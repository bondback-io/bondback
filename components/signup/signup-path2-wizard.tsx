"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, type DefaultValues } from "react-hook-form";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Check, ChevronLeft } from "lucide-react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { finalizePath2Signup } from "@/lib/actions/onboarding";
import { scheduleRouterAction } from "@/lib/deferred-router";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";
import { AuthPageBackLink } from "@/components/auth/auth-page-back-link";
import { getClientAuthEmailRedirectOrigin } from "@/lib/auth/email-redirect-origin";
import {
  loadCachedSignupLocation,
  reverseGeocodeAuForSignupPrefill,
  saveCachedSignupLocation,
} from "@/lib/location/signup-location-prefill";
import { SuburbPostcodeAutocomplete } from "@/components/features/suburb-postcode-autocomplete";
import { Path2RoleSelection } from "@/components/signup/path2-role-selection";
import { cn } from "@/lib/utils";

function buildPath2AuthConfirmUrl(origin: string, ref: string | null): string {
  const u = new URL(`${origin}/auth/confirm`);
  u.searchParams.set("next", "/dashboard");
  u.searchParams.set("flow", "path2");
  if (ref) u.searchParams.set("ref", ref);
  return u.toString();
}

const path2Schema = z
  .object({
    email: z.string().email("Enter a valid email"),
    password: z.string().min(6, "At least 6 characters"),
    confirmPassword: z.string().min(1, "Confirm your password"),
    fullName: z.string().min(1, "Name is required").max(120),
    suburb: z.string().max(120).optional().or(z.literal("")),
    postcode: z.string().max(10).optional().or(z.literal("")),
    role: z.enum(["lister", "cleaner"], {
      errorMap: () => ({ message: "Choose how you want to use Bond Back" }),
    }),
    abn: z.string().optional().or(z.literal("")),
    maxTravelKm: z.number().min(5).max(200),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  })
  .superRefine((data, ctx) => {
    if (data.role !== "cleaner") return;
    const digits = (data.abn ?? "").replace(/\D/g, "");
    if (digits.length > 0 && digits.length !== 11) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "ABN must be 11 digits if provided",
        path: ["abn"],
      });
    }
  });

type Path2Values = z.infer<typeof path2Schema>;

const step1Fields = [
  "email",
  "password",
  "confirmPassword",
  "fullName",
  "suburb",
  "postcode",
] as const satisfies readonly (keyof Path2Values)[];

const btnTouch =
  "touch-manipulation min-h-[3.25rem] w-full text-base font-semibold transition-transform duration-150 active:scale-[0.98] sm:min-h-12";

const EASE_FLOW = [0.25, 0.1, 0.25, 1] as const;

export function SignupPath2Wizard() {
  const reduceMotion = useReducedMotion();
  const router = useRouter();
  const searchParams = useSearchParams();
  const refParam = searchParams.get("ref")?.trim() || null;

  const [phase, setPhase] = useState<"step1" | "step2" | "success">("step1");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [, startTransition] = useTransition();
  const redirectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (redirectTimerRef.current) clearTimeout(redirectTimerRef.current);
    };
  }, []);

  const form = useForm<Path2Values>({
    resolver: zodResolver(path2Schema),
    defaultValues: {
      email: "",
      password: "",
      confirmPassword: "",
      fullName: "",
      suburb: "",
      postcode: "",
      abn: "",
      maxTravelKm: 30,
    } as DefaultValues<Path2Values>,
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

  const role = form.watch("role");
  const maxTravelKm = form.watch("maxTravelKm");

  const goStep2 = useCallback(() => {
    setError(null);
    void form.trigger([...step1Fields]).then((ok) => {
      if (ok) setPhase("step2");
    });
  }, [form]);

  const backToStep1 = useCallback(() => {
    setPhase("step1");
    setError(null);
  }, []);

  const handlePath2Signup = useCallback(
    async (values: Path2Values) => {
      setError(null);
      startTransition(() => setSubmitting(true));

      const supabase = createBrowserSupabaseClient();
      const postcode = values.postcode?.trim() || null;
      const suburb = values.suburb?.trim() || null;
      const confirmUrl = buildPath2AuthConfirmUrl(getClientAuthEmailRedirectOrigin(), refParam);

      try {
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
          role: values.role,
          full_name: values.fullName.trim(),
          suburb,
          postcode,
          referralCode: refParam,
          abn: values.role === "cleaner" ? values.abn : null,
          max_travel_km: values.role === "cleaner" ? values.maxTravelKm : undefined,
        });

        if (!fin.ok) {
          setError(fin.error);
          return;
        }

        saveCachedSignupLocation(values.postcode ?? "", values.suburb ?? "");

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
    [refParam, router, startTransition]
  );

  const onCreateAccount = form.handleSubmit(handlePath2Signup);

  const handleStartAsLister = useCallback(() => {
    form.setValue("role", "lister", { shouldValidate: true });
    queueMicrotask(() => {
      void form.handleSubmit(handlePath2Signup)();
    });
  }, [form, handlePath2Signup]);

  const handleChooseCleaner = useCallback(() => {
    form.setValue("role", "cleaner", { shouldValidate: true });
  }, [form]);

  const flowDur = reduceMotion ? 0 : 0.32;

  return (
    <section className="page-inner relative flex min-h-[70vh] flex-col items-center justify-center px-3 py-8">
      <div className="mb-4 w-full max-w-2xl self-center">
        <AuthPageBackLink />
      </div>

      <div
        className={cn(
          "w-full space-y-6 transition-[max-width] duration-300 ease-out",
          phase === "step2" ? "max-w-2xl" : "max-w-lg"
        )}
      >
        {phase !== "success" && (
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3 text-sm font-medium">
              <span className="text-muted-foreground">
                Step {phase === "step1" ? 1 : 2} of 2
              </span>
              <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold tracking-wide text-primary">
                Bond Back
              </span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-muted">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-sky-500 via-teal-500 to-emerald-500"
                initial={false}
                animate={{ width: phase === "step1" ? "50%" : "100%" }}
                transition={
                  reduceMotion
                    ? { duration: 0 }
                    : { type: "tween", duration: 0.36, ease: EASE_FLOW }
                }
              />
            </div>
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
                  Account created!
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
                  Confirmation email sent. Open the link to verify your email and jump straight to your
                  dashboard.
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
              key={phase}
              initial={reduceMotion ? false : { opacity: 0, x: phase === "step2" ? 14 : -14 }}
              animate={{ opacity: 1, x: 0 }}
              exit={reduceMotion ? { opacity: 0 } : { opacity: 0, x: phase === "step2" ? -8 : 8 }}
              transition={{ duration: flowDur, ease: EASE_FLOW }}
            >
              <Card className="relative w-full overflow-visible border-border/80 shadow-lg dark:border-gray-800 dark:bg-gray-900">
                <CardHeader className="space-y-1 pb-4 text-center sm:text-left">
                  <CardTitle className="text-2xl font-bold tracking-tight sm:text-3xl">
                    {phase === "step1" ? "Your details" : "How will you use Bond Back?"}
                  </CardTitle>
                  <CardDescription className="text-base text-muted-foreground">
                    {phase === "step1"
                      ? "We’ll ask for Lister or Cleaner next — one smooth flow."
                      : "Pick a role to start. You can unlock the other anytime in Settings."}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {error && (
                    <Alert variant="destructive" className="text-sm">
                      {error}
                    </Alert>
                  )}

                  {phase === "step1" && (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="p2-fullName" className="text-base">
                          Full name
                        </Label>
                        <Input
                          id="p2-fullName"
                          autoComplete="name"
                          className="min-h-12 text-base"
                          {...form.register("fullName")}
                        />
                        {form.formState.errors.fullName && (
                          <p className="text-sm text-destructive">{form.formState.errors.fullName.message}</p>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="p2-email" className="text-base">
                          Email
                        </Label>
                        <Input
                          id="p2-email"
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
                        <Label htmlFor="p2-password" className="text-base">
                          Password
                        </Label>
                        <Input
                          id="p2-password"
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
                        <Label htmlFor="p2-confirmPassword" className="text-base">
                          Confirm password
                        </Label>
                        <Input
                          id="p2-confirmPassword"
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

                      <div className="relative z-10 overflow-visible">
                        <SuburbPostcodeAutocomplete
                          hideStateSelect
                          stateValue=""
                          onStateChange={() => {}}
                          suburbValue={form.watch("suburb") ?? ""}
                          postcodeValue={form.watch("postcode") ?? ""}
                          onSuburbPostcodeChange={(s, p) => {
                            form.setValue("suburb", s, { shouldValidate: true, shouldDirty: true });
                            form.setValue("postcode", p, { shouldValidate: true, shouldDirty: true });
                          }}
                          id="p2-suburb"
                          label="Where are you based?"
                          suburbPlaceholder="Type suburb or postcode (e.g. 2000 or Surry)"
                          error={
                            form.formState.errors.suburb?.message ||
                            form.formState.errors.postcode?.message ||
                            undefined
                          }
                        />
                      </div>

                      <motion.div
                        whileTap={
                          reduceMotion ? undefined : { scale: 0.98, transition: { duration: 0.2, ease: EASE_FLOW } }
                        }
                        className="mt-2 w-full"
                      >
                        <Button type="button" size="lg" className={cn(btnTouch, "w-full")} onClick={goStep2}>
                          Continue
                        </Button>
                      </motion.div>
                    </div>
                  )}

                  {phase === "step2" && (
                    <Path2RoleSelection
                      role={role}
                      onStartAsLister={handleStartAsLister}
                      onChooseCleaner={handleChooseCleaner}
                      maxTravelKm={maxTravelKm}
                      onMaxTravelChange={(n) =>
                        form.setValue("maxTravelKm", n, { shouldValidate: true })
                      }
                      abnInputProps={form.register("abn")}
                      abnError={form.formState.errors.abn?.message}
                      roleError={form.formState.errors.role?.message}
                      submitting={submitting}
                      onSubmit={onCreateAccount}
                      backButton={
                        <button
                          type="button"
                          onClick={backToStep1}
                          className="inline-flex min-h-11 items-center gap-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                        >
                          <ChevronLeft className="h-4 w-4" aria-hidden />
                          Back
                        </button>
                      }
                    />
                  )}
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {phase === "step1" && (
          <p className="text-center text-sm text-muted-foreground">
            Prefer the classic flow?{" "}
            <Link href="/signup" className="font-medium text-primary underline underline-offset-2">
              Standard sign-up
            </Link>
          </p>
        )}
      </div>
    </section>
  );
}
