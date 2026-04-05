"use client";

import { useState } from "react";
import Link from "next/link";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";
import { AuthPageBackLink } from "@/components/auth/auth-page-back-link";
import { requestSignupConfirmationEmail } from "@/lib/actions/resend-signup-confirmation";

const schema = z.object({
  email: z.string().email("Enter a valid email"),
});

type Values = z.infer<typeof schema>;

export function ResendConfirmationForm() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [alreadyConfirmed, setAlreadyConfirmed] = useState(false);
  const [bannerError, setBannerError] = useState<string | null>(null);

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { email: "" },
  });

  const onSubmit = async (values: Values) => {
    setIsSubmitting(true);
    setBannerError(null);
    setAlreadyConfirmed(false);
    setSuccessMessage(null);
    try {
      const result = await requestSignupConfirmationEmail(values.email.trim());
      if (result.ok) {
        setSuccessMessage(result.message);
        return;
      }
      if (result.reason === "already_confirmed") {
        setAlreadyConfirmed(true);
        return;
      }
      if (result.reason === "not_found") {
        setBannerError(
          "We couldn’t find a Bond Back account with that email. Check the spelling, or sign up to create one."
        );
        return;
      }
      if (result.reason === "rate_limited") {
        setBannerError(
          "Too many requests. Wait a minute and try again, or check your spam folder."
        );
        return;
      }
      setBannerError(result.message ?? "Could not send the email. Try again in a moment.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="page-inner flex min-h-[70vh] flex-col justify-center px-4 py-8 sm:min-h-[60vh] sm:py-12">
      <div className="mx-auto mb-4 w-full max-w-md">
        <AuthPageBackLink href="/login">Back to log in</AuthPageBackLink>
      </div>
      <Card className="mx-auto w-full max-w-md shadow-sm">
        <CardHeader className="space-y-1 pb-2 sm:pb-4">
          <CardTitle className="text-xl sm:text-2xl">Resend confirmation email</CardTitle>
          <p className="text-xs text-muted-foreground sm:text-sm">
            Enter the email you used to sign up. We&apos;ll send a fresh link so you can confirm your
            account — same bond-clean energy, fewer copy-paste mishaps.
          </p>
        </CardHeader>
        <CardContent className="space-y-4 pt-0">
          {successMessage && (
            <Alert variant="success" className="text-xs">
              {successMessage}
            </Alert>
          )}
          {alreadyConfirmed && (
            <Alert variant="destructive" className="text-xs leading-relaxed">
              Your account already exists and has been confirmed — use{" "}
              <Link
                href="/forgot-password"
                className="font-semibold underline underline-offset-2"
              >
                Forgot password
              </Link>{" "}
              to recover your account.
            </Alert>
          )}
          {bannerError && (
            <Alert variant="destructive" className="text-xs">
              {bannerError}
            </Alert>
          )}

          {!successMessage && (
            <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)} noValidate>
              <div className="space-y-2">
                <Label htmlFor="resend-email">Email</Label>
                <Input
                  id="resend-email"
                  type="email"
                  autoComplete="email"
                  inputMode="email"
                  className="min-h-11"
                  disabled={isSubmitting}
                  {...form.register("email")}
                />
                {form.formState.errors.email && (
                  <p className="text-xs text-destructive">{form.formState.errors.email.message}</p>
                )}
              </div>
              <Button type="submit" className="min-h-11 w-full" disabled={isSubmitting}>
                {isSubmitting ? "Sending…" : "Send confirmation link"}
              </Button>
            </form>
          )}

          <p className="text-center text-sm text-muted-foreground">
            <Link href="/login" className="text-primary underline underline-offset-2">
              Back to log in
            </Link>
          </p>
        </CardContent>
      </Card>
    </section>
  );
}
