"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";

const forgotSchema = z.object({
  email: z.string().email("Enter a valid email"),
});

type ForgotValues = z.infer<typeof forgotSchema>;

function ForgotPasswordForm() {
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<ForgotValues>({
    resolver: zodResolver(forgotSchema),
    defaultValues: { email: "" },
  });

  useEffect(() => {
    const q = searchParams.get("email")?.trim();
    if (q) form.setValue("email", q);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run when query changes
  }, [searchParams]);

  const onSubmit = async (values: ForgotValues) => {
    setError(null);
    setInfo(null);
    setIsSubmitting(true);
    const supabase = createBrowserSupabaseClient();
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        values.email.trim(),
        {
          redirectTo: `${origin}/auth/callback?next=/reset-password`,
        }
      );
      if (resetError) {
        setError(resetError.message);
      } else {
        setInfo(
          "If an account exists for that email, we sent a link to reset your password. Check your inbox and spam folder."
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="page-inner flex justify-center px-3 py-8">
      <Card className="w-full max-w-md border-border dark:border-gray-800 dark:bg-gray-900">
        <CardHeader className="space-y-1">
          <CardTitle className="text-xl dark:text-gray-100">Forgot password</CardTitle>
          <p className="text-sm text-muted-foreground dark:text-gray-400">
            Enter your email and we&apos;ll send you a link to set a new password.
          </p>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)} noValidate>
            {error && (
              <Alert variant="destructive" className="text-sm">
                {error}
              </Alert>
            )}
            {info && (
              <Alert variant="info" className="text-sm">
                {info}
              </Alert>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                {...form.register("email")}
              />
              {form.formState.errors.email && (
                <p className="text-xs text-destructive">{form.formState.errors.email.message}</p>
              )}
            </div>
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? "Sending…" : "Send reset link"}
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              <Link href="/login" className="text-primary underline underline-offset-2">
                Back to log in
              </Link>
              {" · "}
              <Link href="/signup" className="text-primary underline underline-offset-2">
                Sign up
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </section>
  );
}

export default function ForgotPasswordPage() {
  return (
    <Suspense
      fallback={
        <section className="page-inner flex justify-center px-3 py-8">
          <div className="text-muted-foreground">Loading…</div>
        </section>
      }
    >
      <ForgotPasswordForm />
    </Suspense>
  );
}
